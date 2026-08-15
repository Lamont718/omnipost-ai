/**
 * Did the post do anything?
 *
 * The app has written a few hundred captions and has never once found out
 * whether any of them worked. Caption 227 is composed with exactly as much
 * knowledge as caption 1. This is the smallest honest fix: after a post has
 * gone out, one button says it did well and one says it fell flat, and the ones
 * marked good come back as tone examples the next time that brand is written.
 *
 * Deliberately his judgement, not platform metrics. MostHatedNBA's own numbers
 * were inflated 5.6x by bots — see lib/bot-filter.ts over in that repo — so
 * scraped engagement would teach this thing the wrong lesson with great
 * confidence. He can tell whether a post landed. The API can't.
 *
 * Storage is the same shape as posted.ts and published.ts: one blob per record,
 * written without reading first, so nothing can clobber anything.
 */

export type Verdict = "good" | "flat";

const PREFIX = "feedback/";

export interface FeedbackRecord {
  /** Slot id — brand:date:time:platform. */
  id: string;
  brandSlug: string;
  verdict: Verdict;
  /** ISO timestamp of when he judged it. */
  at: string;
}

function hasBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function recordPath(id: string): string {
  return `${PREFIX}${encodeURIComponent(id)}.json`;
}

export async function readFeedback(): Promise<Record<string, FeedbackRecord>> {
  if (!hasBlob()) return {};
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: PREFIX });

    const out: Record<string, FeedbackRecord> = {};
    const fetched = await Promise.all(
      blobs.map(async (b) => {
        try {
          const res = await fetch(`${b.url}?t=${Date.now()}`, { cache: "no-store" });
          return res.ok ? ((await res.json()) as FeedbackRecord) : null;
        } catch {
          return null;
        }
      }),
    );
    for (const record of fetched) {
      if (record?.id) out[record.id] = record;
    }
    return out;
  } catch (err) {
    console.error("readFeedback failed:", err);
    return {};
  }
}

export async function setFeedback(record: FeedbackRecord): Promise<boolean> {
  if (!hasBlob()) return false;
  try {
    const { put } = await import("@vercel/blob");
    await put(recordPath(record.id), JSON.stringify(record), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return true;
  } catch (err) {
    console.error(`setFeedback failed for ${record.id}:`, err);
    return false;
  }
}

/** Un-judge a post. Deleting something that was never there is not an error. */
export async function clearFeedback(id: string): Promise<boolean> {
  if (!hasBlob()) return false;
  try {
    const { del, head } = await import("@vercel/blob");
    const meta = await head(recordPath(id)).catch(() => null);
    if (!meta) return true;
    await del(meta.url);
    return true;
  } catch (err) {
    console.error(`clearFeedback failed for ${id}:`, err);
    return false;
  }
}
