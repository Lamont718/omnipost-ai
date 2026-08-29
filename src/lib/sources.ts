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
  /**
   * Carried through from the source that yielded this topic — see
   * `TopicSource.pageImageWins`. It rides on the topic rather than being looked up
   * later because the topic is what gets pinned into a written caption, so a
   * book post keeps its cover even if the sources are re-shuffled afterwards.
   */
  pageImageWins?: boolean;
}

interface SitemapEntry {
  url: string;
  lastmod?: Date;
  /** From the source this entry came out of. */
  pageImageWins?: boolean;
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

/**
 * Sitemaps and page metadata change on the order of days, but the calendar
 * re-derives topics for every week it displays — a month view is roughly 30
 * brand-weeks, each costing a sitemap fetch plus a page fetch per slot. Left
 * uncached that was over a hundred round trips to Lamont's own sites on every
 * single calendar load, which is what made it take up to half a minute.
 *
 * `next.revalidate` puts them in Next's data cache, so the whole month is
 * served from a handful of real requests. This has to live on the fetch and
 * not on the route, or fresh captions get cached along with it.
 */
const SOURCE_CACHE_SECONDS = 3600;

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "OmniPost/1.0 (+https://omnipost-ai-phi.vercel.app)" },
      next: { revalidate: SOURCE_CACHE_SECONDS },
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
  return parseSitemap(xml)
    .filter((e) => matchesSource(e.url, source))
    .map((e) => (source.pageImageWins ? { ...e, pageImageWins: true } : e));
}

/**
 * How many distinct pages a brand can actually draw on.
 *
 * This is the number behind the repetition. MostHatedNBA picks 24 posts a month
 * out of ~97 villain pages and never repeats; WWSH picks 4 out of 5 and opened
 * three October posts with the same sentence. Same code, same prompt — the only
 * difference is the size of the pool.
 *
 * Sitemap fetches are cached for an hour, and this reads no page bodies, so
 * asking for every brand at once is cheap.
 */
export async function poolSizeFor(brand: Brand): Promise<number> {
  const urls = new Set<string>();
  for (const source of brand.sources) {
    for (const entry of await candidatesFor(source)) urls.add(entry.url);
  }
  return urls.size;
}

/**
 * A page description with the brand's site-wide furniture taken out.
 *
 * This runs on the way INTO the verified-facts block, which is the only place
 * lib/compose.ts lets a caption take specifics from. A sentence that is
 * identical on all 92 of a site's pages is not a specific about any of them,
 * but the writer has no way to know that — it reads as verified detail, it is
 * the only verified detail on offer, and so it goes into the post. Every time.
 *
 * Returns undefined rather than an empty string when nothing survives: an empty
 * context and a missing one mean the same thing to the prompt builder, and only
 * one of them is handled.
 */
function withoutSitewideCopy(
  description: string | undefined,
  brand: Brand,
): string | undefined {
  if (!description || !brand.sitewidePageCopy) return description;
  const stripped = description
    .replace(brand.sitewidePageCopy, " ")
    // A description built as "<Category> · <boilerplate>" leaves a dangling
    // separator behind, and a fact block that opens with a bullet reads like
    // something went missing.
    .replace(/[·—–-]\s*$/, "")
    .replace(/^\s*[·—–-]/, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || undefined;
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
 * How far the window moves from one week to the next.
 *
 * `take` is the obvious answer and it is right whenever a brand fills several
 * slots a week: three picks a week move on by three, and the catalogue is
 * covered without overlap. It is wrong for a brand with ONE slot a week, where
 * moving on by one means walking the sitemap top to bottom — and sitemaps group
 * related pages together. That is why The Conductor posted the B37 and then the
 * B38 the following week, and why the twelve Emeka books would have gone out as
 * six consecutive Ignites titles before reaching anything else.
 *
 * A step co-prime with the list length still visits every item exactly once per
 * full cycle, so nothing is lost or repeated — it just arrives in an order that
 * doesn't mirror the file. Falls back to 1 when nothing co-prime is available
 * (short lists), which is the old behaviour.
 */
function weekStep(len: number, take: number): number {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

  if (take <= 1) {
    for (const candidate of [5, 7, 3, 11]) {
      if (candidate < len && gcd(candidate, len) === 1) return candidate;
    }
    return 1;
  }

  // `take` is the honest step for a multi-slot brand and it is usually fine —
  // but only because gcd(take, len) usually happens to be 1. When it isn't, the
  // window lands on the same residues every week and the rest of the catalogue
  // is not deprioritised, it is UNREACHABLE. WWSH ran two slots a week against
  // four pages: stepping by 2 through 4 only ever reaches positions 0 and 2, so
  // /beyond-chess-enrichment and /mentorship were never once posted in the
  // months this ran. Emeka Explores is the same shape and costs more — two
  // lesson slots against 48 pages, so 24 lessons could never be chosen, which
  // halves the cycle and doubles how often the brand repeats itself.
  //
  // So the co-prime reasoning above is not a special case for one-slot brands.
  // It is the whole reason the rotation covers anything. Step up from `take`
  // to the next number sharing no factor with the pool: still at least as fast
  // as the week consumes, so weeks don't overlap, and now every page is
  // reachable.
  if (gcd(take, len) === 1) return take;
  for (let step = take + 1; step < len; step++) {
    if (gcd(step, len) === 1) return step;
  }
  return 1;
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
    let idx = (week * weekStep(list.length, take) + i * stride) % list.length;
    // Stride can collide once the list wraps; walk forward to the next free slot.
    while (seen.has(idx)) idx = (idx + 1) % list.length;
    seen.add(idx);
    picked.push(list[idx]);
  }
  return picked;
}

/**
 * Pick `want` topics out of one pool: anything genuinely new first, then a
 * rotating slice of the back catalogue.
 *
 * Split out of `topicsForBrand` when slots got their own pools — the fresh/rest
 * reasoning below is per pool, not per brand. Twelve book pages all stamped
 * with one deploy date must not make the lessons look stale, and vice versa.
 */
async function topicsFromPool(
  sources: TopicSource[],
  want: number,
  week: number,
  now: Date,
  /** Only for `sitewidePageCopy` — which of this brand's page copy is furniture. */
  brand: Brand,
): Promise<Topic[]> {
  if (want <= 0 || sources.length === 0) return [];

  const all: SitemapEntry[] = [];
  for (const source of sources) {
    all.push(...(await candidatesFor(source)));
  }

  const freshCutoff = now.getTime() - FRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const fresh = all
    .filter((e) => e.lastmod && e.lastmod.getTime() >= freshCutoff)
    .sort((a, b) => b.lastmod!.getTime() - a.lastmod!.getTime());

  const freshUrls = new Set(fresh.map((e) => e.url));
  const rest = all.filter((e) => !freshUrls.has(e.url));

  /**
   * A site-wide rebuild stamps every page with the same recent lastmod, and
   * then "fresh" means nothing — it's the whole catalogue. Taking the newest
   * few would pin the brand to the same handful of pages forever, and leave
   * `rest` empty so the remaining slots fell through to evergreens.
   *
   * yodm.com is exactly this: all 92 cards carry one deploy date, so YODM was
   * posting cards 0 and 1 every single week and filling its third slot with a
   * generic angle. Freshness only earns its place when it identifies a genuine
   * minority of the site.
   */
  const newsIsMeaningful = fresh.length > 0 && fresh.length <= all.length / 2;

  // Never let "new" crowd out everything else — at most half the week is news.
  const picked: SitemapEntry[] = (
    newsIsMeaningful
      ? [...fresh.slice(0, Math.ceil(want / 2)), ...rotate(rest, want, week)]
      : rotate(all, want, week)
  ).slice(0, want);

  // In parallel: these were serial, and a slow page held up the whole week.
  return Promise.all(
    picked.map(async (entry) => {
      const meta = await fetchPageMeta(entry.url);
      return {
        url: entry.url,
        source: "site" as const,
        title: meta.title ?? pathOf(entry.url).replace(/[-/]/g, " ").trim(),
        context: withoutSitewideCopy(meta.description, brand),
        ...(entry.pageImageWins ? { pageImageWins: true } : {}),
      };
    }),
  );
}

/**
 * Choose this week's topics for a brand — one per slot, returned in slot order.
 *
 * Each slot draws from the pool its `topics` tag names, and untagged slots draw
 * from the untagged sources. A brand with no tags anywhere is one pool and
 * behaves exactly as it did before lanes existed.
 *
 * Anything a pool can't fill falls through to evergreens, same as always: a
 * site being down should cost a post its specifics, not its slot.
 */
export async function topicsForBrand(
  brand: Brand,
  now: Date = new Date(),
): Promise<Topic[]> {
  const week = weekIndex(now);
  if (brand.schedule.length === 0) return [];

  // Each distinct slot tag is a lane: the pool it draws from, and the slot
  // positions it fills. "" is the untagged pool every brand had before.
  const lanes: { tag: string; slotIndexes: number[] }[] = [];
  brand.schedule.forEach((slot, i) => {
    const tag = slot.topics ?? "";
    const lane = lanes.find((l) => l.tag === tag);
    if (lane) lane.slotIndexes.push(i);
    else lanes.push({ tag, slotIndexes: [i] });
  });

  const bySlot: (Topic | undefined)[] = new Array(brand.schedule.length).fill(
    undefined,
  );

  await Promise.all(
    lanes.map(async ({ tag, slotIndexes }) => {
      const sources = brand.sources.filter((s) => (s.tag ?? "") === tag);
      const picked = await topicsFromPool(
        sources,
        slotIndexes.length,
        week,
        now,
        brand,
      );
      slotIndexes.forEach((slotIndex: number, k: number) => {
        if (picked[k]) bySlot[slotIndex] = picked[k];
      });
    }),
  );

  // Top up from evergreens if a pool gave us less than its slots wanted. A bare
  // string carries no context (the model gets no specifics to invent from); a
  // `{ title, facts }` entry passes verified canon through as context.
  const gaps = bySlot
    .map((topic, i) => (topic ? -1 : i))
    .filter((i) => i >= 0);
  if (gaps.length > 0 && brand.evergreenTopics.length > 0) {
    const fill = rotate(brand.evergreenTopics, gaps.length, week);
    gaps.forEach((slotIndex, k) => {
      const e: EvergreenTopic | undefined = fill[k];
      if (!e) return;
      bySlot[slotIndex] =
        typeof e === "string"
          ? { title: e, source: "evergreen" }
          : { title: e.title, context: e.facts, source: "evergreen" };
    });
  }

  /**
   * Slot order is the contract — `brandPostsInRange` indexes this array by slot
   * position, so a hole must not shift every later slot onto the wrong topic.
   * A pool that came up empty with no evergreen left to spare falls back to the
   * brand name, which is what the caller used to substitute anyway.
   */
  return bySlot.map(
    (topic) => topic ?? { title: brand.name, source: "evergreen" as const },
  );
}
