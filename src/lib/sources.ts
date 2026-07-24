import { Brand, EvergreenTopic, TopicSource } from "./brands";

/**
 * Topic discovery.
 *
 * The old flow made you type a topic before it would write anything, which
 * meant the hard part was still yours. This reads your own live sites instead:
 * pull the sitemap, keep the pages worth posting about, and hand Claude the
 * real page title and description as context.
 *
 * There is no database, so "don't repeat last week" is handled arithmetically —
 * see `weekIndex`. Same week always produces the same picks (re-running the
 * cron is safe); the following week moves along the list.
 */

export interface Topic {
  /** What the post is about — a page title, or an evergreen angle. */
  title: string;
  /**
   * Verified copy lifted from the page itself. This is the ONLY place the model
   * is allowed to get specifics (prices, counts, dates), so it must never
   * contain anything we didn't actually read off the site.
   */
  context?: string;
  /** Page this came from, so the digest can link it. Absent for evergreens. */
  url?: string;
  source: "site" | "evergreen";
}

interface SitemapEntry {
  url: string;
  lastmod?: Date;
}

const FETCH_TIMEOUT_MS = 15_000;
/** A page modified within this window counts as news worth leading with. */
const FRESH_WINDOW_DAYS = 21;

/**
 * Weeks since the epoch. Stable within a week, +1 the next — this is what makes
 * rotation deterministic without storing anything.
 */
export function weekIndex(now: Date = new Date()): number {
  return Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "OmniPost/1.0 (+https://omnipost-ai-phi.vercel.app)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Pull `<loc>`/`<lastmod>` pairs out of a sitemap. */
function parseSitemap(xml: string): SitemapEntry[] {
  const entries: SitemapEntry[] = [];
  const blocks = xml.match(/<url>[\s\S]*?<\/url>/g) ?? [];

  for (const block of blocks) {
    const loc = block.match(/<loc>\s*([^<\s]+)\s*<\/loc>/)?.[1];
    if (!loc) continue;
    const lastmodRaw = block.match(/<lastmod>\s*([^<\s]+)\s*<\/lastmod>/)?.[1];
    const lastmod = lastmodRaw ? new Date(lastmodRaw) : undefined;
    entries.push({
      url: loc,
      lastmod: lastmod && !isNaN(lastmod.getTime()) ? lastmod : undefined,
    });
  }
  return entries;
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function matchesSource(url: string, source: TopicSource): boolean {
  const path = pathOf(url);
  // The homepage is never a topic — it says nothing specific.
  if (path === "/" || path === "") return false;
  if (source.exclude?.some((re) => re.test(path))) return false;
  if (source.include && !source.include.some((re) => re.test(path))) return false;
  return true;
}

async function candidatesFor(source: TopicSource): Promise<SitemapEntry[]> {
  const xml = await fetchText(source.sitemap);
  if (!xml) return [];
  return parseSitemap(xml).filter((e) => matchesSource(e.url, source));
}

/** Title and meta description, for context. Cheap enough at ~10 pages/week. */
async function fetchPageMeta(
  url: string,
): Promise<{ title?: string; description?: string }> {
  const html = await fetchText(url);
  if (!html) return {};

  const decode = (s: string) =>
    s
      .replace(/&amp;/g, "&")
      .replace(/&#x27;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;/g, " ")
      .trim();

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const description =
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
    )?.[1] ??
    html.match(
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i,
    )?.[1];

  return {
    title: title ? decode(title) : undefined,
    description: description ? decode(description) : undefined,
  };
}

/**
 * Rotate `count` items out of `list` for a given week, wrapping around. Weeks
 * advance the window, so a brand works through its whole catalogue instead of
 * posting about the same three pages forever.
 *
 * Picks are spread by a stride rather than taken consecutively. Sitemaps group
 * related pages together, so consecutive picks produce a week of near-duplicates
 * — four "Most Hated <Team> Players" posts in a row reads as spam.
 */
function rotate<T>(list: T[], count: number, week: number): T[] {
  if (list.length === 0) return [];
  const take = Math.min(count, list.length);
  const stride = Math.max(1, Math.floor(list.length / take));
  const picked: T[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < take; i++) {
    let idx = (week * take + i * stride) % list.length;
    // Stride can collide once the list wraps; walk forward to the next free slot.
    while (seen.has(idx)) idx = (idx + 1) % list.length;
    seen.add(idx);
    picked.push(list[idx]);
  }
  return picked;
}

/**
 * Choose this week's topics for a brand: anything genuinely new first, then a
 * rotating slice of the back catalogue, then evergreens if the site is down or
 * the brand has no site at all.
 */
export async function topicsForBrand(
  brand: Brand,
  now: Date = new Date(),
): Promise<Topic[]> {
  const want = brand.postsPerWeek;
  const week = weekIndex(now);

  const all: SitemapEntry[] = [];
  for (const source of brand.sources) {
    all.push(...(await candidatesFor(source)));
  }

  const freshCutoff = now.getTime() - FRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const fresh = all
    .filter((e) => e.lastmod && e.lastmod.getTime() >= freshCutoff)
    .sort((a, b) => b.lastmod!.getTime() - a.lastmod!.getTime());

  const freshUrls = new Set(fresh.map((e) => e.url));
  const rest = all.filter((e) => !freshUrls.has(e.url));

  // Never let "new" crowd out everything else — at most half the week is news.
  const picked: SitemapEntry[] = [
    ...fresh.slice(0, Math.ceil(want / 2)),
    ...rotate(rest, want, week),
  ].slice(0, want);

  const topics: Topic[] = [];
  for (const entry of picked) {
    const meta = await fetchPageMeta(entry.url);
    topics.push({
      url: entry.url,
      source: "site",
      title: meta.title ?? pathOf(entry.url).replace(/[-/]/g, " ").trim(),
      context: meta.description,
    });
  }

  // Top up from evergreens if the site gave us less than we wanted. A bare
  // string carries no context (the model gets no specifics to invent from); a
  // `{ title, facts }` entry passes verified canon through as context.
  if (topics.length < want && brand.evergreenTopics.length > 0) {
    for (const entry of rotate(
      brand.evergreenTopics,
      want - topics.length,
      week,
    )) {
      const e: EvergreenTopic = entry;
      topics.push(
        typeof e === "string"
          ? { title: e, source: "evergreen" }
          : { title: e.title, context: e.facts, source: "evergreen" },
      );
    }
  }

  return topics;
}
