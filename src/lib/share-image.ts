import { isAllowedHost } from "./brand-hosts";

/**
 * The share image a page publishes, read from its own meta tags.
 *
 * Lives here rather than in the route because two callers need it: /api/og-image
 * answers the browser one post at a time, and the Metricool export needs the
 * same answer for every post in a month before it can write a row. Going
 * through HTTP for the second case would mean the server calling itself sixty
 * times.
 */

const FETCH_TIMEOUT_MS = 8_000;
/** Share images change rarely; a day of caching keeps the calendar quick. */
export const SHARE_IMAGE_CACHE_SECONDS = 86_400;

export function extractImage(html: string, pageUrl: string): string | null {
  // og:image first, then twitter:image. Attribute order varies between the two
  // conventions (property=… content=… and content=… property=…), so try both.
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      try {
        // Sites publish these both absolute and root-relative.
        return new URL(m[1], pageUrl).toString();
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Null for anything that isn't a fetchable brand page, or a page with no share
 * image. Never throws — a missing picture is a fallback, not a failure.
 */
export async function shareImageFor(pageUrl: string | undefined): Promise<string | null> {
  if (!pageUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(pageUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!isAllowedHost(parsed.hostname)) return null;

  try {
    const res = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "OmniPost/1.0 (+https://omnipost-ai-phi.vercel.app)" },
      next: { revalidate: SHARE_IMAGE_CACHE_SECONDS },
    });
    if (!res.ok) return null;
    return extractImage(await res.text(), parsed.toString());
  } catch (error) {
    console.error("shareImageFor failed:", parsed.hostname, error);
    return null;
  }
}

/** Run `work` over `items` a few at a time, so a month of posts isn't 60 serial fetches. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await work(items[i]);
    }
  });
  await Promise.all(runners);
  return out;
}
