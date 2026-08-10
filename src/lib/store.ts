import { GenerateResponse } from "./types";
import type { Topic } from "./sources";

/**
 * Where written captions live between generation and the calendar that shows them.
 *
 * Backed by Vercel Blob — object storage, not a database: put and get, no schema.
 * If BLOB_READ_WRITE_TOKEN is not set the store degrades to empty (reads return
 * {}, writes are no-ops) and the calendar simply shows scheduled slots with their
 * topic. Nothing breaks without it; it only pre-fills.
 *
 * ---------------------------------------------------------------------------
 * Why there are two blob layouts
 *
 * There used to be one file, `captions.json`, and every save was read-merge-write
 * against it. That loses data, and it did: on 7 August 2026, 134 successful
 * generations left 19 surviving captions. Two causes, and only fixing both helps.
 *
 *   1. The read came back stale. Blob objects are CDN-cached, and the write set
 *      no cache lifetime, so a save could merge into a snapshot minutes old and
 *      write the gap back over everything since.
 *   2. Two saves that overlap both read, both merge, and both write. The second
 *      erases the first. Serialising to one request at a time was tried and did
 *      not fix it, because cause 1 is enough on its own.
 *
 * So on-demand saves no longer read anything. Each caption is written to its own
 * blob under `caption-parts/`, which cannot overwrite a neighbour no matter how
 * many run at once. Reads merge the parts over the base file.
 *
 * Parts would pile up and make reads slow, so the weekly cron calls
 * `compactCaptions` instead: it folds everything into one `captions.json` and
 * deletes the parts. One batched write, which was always the safe path.
 */

export interface StoredCaption extends GenerateResponse {
  /** ISO timestamp of when it was written. */
  generatedAt: string;
  /**
   * The topic this caption was actually written from, frozen at the moment it
   * was written.
   *
   * Captions are stored by slot id — brand, date, time, platform — but topics
   * are re-derived from the live sitemap on every read. So the pairing between
   * a caption and its subject was never stored anywhere: change a brand's
   * sources, or let a site add a page, and yesterday's caption gets re-paired
   * with today's topic. The caption still talks about a YODM card while the
   * calendar labels it something else, links somewhere else, and picks its
   * picture from the wrong page. It happened three times in one session and
   * cost about forty regenerated captions.
   *
   * Writing the topic down alongside the caption fixes it, because the caption
   * is the truth and the topic is only how it was derived. Readers use this in
   * preference to whatever discovery returns now — see `withPinnedTopics`.
   *
   * Optional because captions written before this existed don't have one; they
   * fall back to the derived topic, exactly as before.
   */
  topic?: Topic;
}

export type CaptionMap = Record<string, StoredCaption>;

/** The compacted map. Written only by compactCaptions. */
const BASE_KEY = "captions.json";
/** One blob per caption, written by on-demand saves. */
const PART_PREFIX = "caption-parts/";
/** Blobs are CDN-cached; without this a fresh read can return an old body. */
const NO_CACHE = 0;
/** How many part blobs to fetch at once when reading. */
const READ_CONCURRENCY = 12;

function hasBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function partPath(id: string): string {
  return `${PART_PREFIX}${encodeURIComponent(id)}.json`;
}

/** Fetch a blob body as JSON, cache-busted. Null on any failure. */
async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function inChunks<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))));
  }
  return out;
}

/**
 * Read the whole caption map: the compacted base, with any individually saved
 * parts layered on top. Parts win — they are always the newer write.
 */
export async function readCaptions(): Promise<CaptionMap> {
  if (!hasBlob()) return {};
  try {
    const { list } = await import("@vercel/blob");

    const [baseList, partList] = await Promise.all([
      list({ prefix: BASE_KEY }),
      list({ prefix: PART_PREFIX }),
    ]);

    const baseHit = baseList.blobs.find((b) => b.pathname === BASE_KEY);
    const base = baseHit ? ((await fetchJson<CaptionMap>(baseHit.url)) ?? {}) : {};

    const parts = await inChunks(partList.blobs, READ_CONCURRENCY, async (b) =>
      fetchJson<{ id: string } & StoredCaption>(b.url),
    );

    const merged: CaptionMap = { ...base };
    for (const p of parts) {
      if (!p?.id) continue;
      const { id, ...caption } = p;
      merged[id] = caption as StoredCaption;
    }
    return merged;
  } catch (err) {
    console.error("readCaptions failed:", err);
    return {};
  }
}

/**
 * Save captions without reading anything first.
 *
 * Each entry becomes its own blob, so concurrent saves cannot clobber each
 * other and a stale read cannot erase work — there is no read and no merge.
 * The returned count is how many blobs were actually written, so a caller that
 * reports "persisted" is reporting something true.
 */
export async function writeCaptions(entries: CaptionMap): Promise<number> {
  if (!hasBlob()) return 0;
  const ids = Object.keys(entries);
  if (!ids.length) return 0;

  const { put } = await import("@vercel/blob");

  const results = await inChunks(ids, READ_CONCURRENCY, async (id) => {
    try {
      await put(partPath(id), JSON.stringify({ id, ...entries[id] }), {
        access: "public",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: NO_CACHE,
      });
      return true;
    } catch (err) {
      console.error(`writeCaptions failed for ${id}:`, err);
      return false;
    }
  });

  return results.filter(Boolean).length;
}

/**
 * Fold everything into the single base file and clear the parts.
 *
 * This is the one place a read-merge-write happens, and it is safe here because
 * the weekly cron is the only caller and it runs alone. Parts are deleted only
 * after the base write succeeds, so a failure loses nothing.
 */
export async function compactCaptions(entries: CaptionMap = {}): Promise<{
  total: number;
  added: number;
  partsCleared: number;
}> {
  if (!hasBlob()) return { total: 0, added: 0, partsCleared: 0 };

  const { put, del, list } = await import("@vercel/blob");

  const existing = await readCaptions();
  const merged = { ...existing, ...entries };

  await put(BASE_KEY, JSON.stringify(merged), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: NO_CACHE,
  });

  let partsCleared = 0;
  try {
    const { blobs } = await list({ prefix: PART_PREFIX });
    if (blobs.length) {
      await del(blobs.map((b) => b.url));
      partsCleared = blobs.length;
    }
  } catch (err) {
    // The base file already holds everything, so leftover parts are harmless —
    // they just get merged again on the next read.
    console.error("compactCaptions: could not clear parts:", err);
  }

  return {
    total: Object.keys(merged).length,
    added: Object.keys(entries).length,
    partsCleared,
  };
}
