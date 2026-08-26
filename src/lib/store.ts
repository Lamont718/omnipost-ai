import { GenerateResponse } from "./types";
import type { Topic } from "./sources";
import type { PinnedVideo } from "./video-library";

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
 *
 * ---------------------------------------------------------------------------
 * Why compaction keeps parts around for a while
 *
 * "Safe because the cron is the only caller and it runs alone" stopped being
 * true the moment three fill runs went out back to back, one per brand. On 11
 * August 2026 the second run wrote a 135-caption base and cleared the parts;
 * the third, seconds later, read a base that was still the 123-caption version
 * and wrote that back. Twelve freshly generated captions were gone.
 *
 * The stale read is not the part that hurts — merging is meant to survive it.
 * What made it fatal was deleting the parts, because that removed the copies
 * the stale read would otherwise have layered back on top. So a part is now
 * only deleted once it is BOTH present in the base that was just written AND
 * older than PART_GRACE_MS, which keeps a recent write recoverable for longer
 * than any propagation delay observed here.
 */

export interface StoredCaption extends GenerateResponse {
  /** ISO timestamp of when it was written. */
  generatedAt: string;
  /**
   * Set when a human changed the words afterwards, rather than regenerating.
   *
   * Kept separate from `generatedAt` so the two questions stay separate: how
   * old is this writing, and has anyone touched it since. A hand-edit that
   * moved `generatedAt` would make an edited caption look freshly written and
   * hide the fact that someone disagreed with what the model produced.
   */
  editedAt?: string;
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
  /**
   * The video clip this caption was written against, frozen the same way and
   * for the same reason.
   *
   * A Reel caption is composed knowing what is on screen — it is told the clip
   * shows Emeka at a spacecraft window, and it writes a first line that lands
   * against that. Re-picking the clip on every read would eventually hand that
   * caption a different five seconds, and the pairing the writer was working to
   * would quietly stop being true. Adding clips still re-rotates every slot
   * nobody has written yet, which is the behaviour worth keeping.
   *
   * Absent on captions written before video existed, and on every brand that
   * has no clips: those posts carry a still, exactly as before.
   */
  video?: PinnedVideo;
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
/**
 * How long a part must have existed before compaction may delete it. Covers the
 * window in which another run could still be holding a pre-write snapshot of the
 * base; ten minutes is far beyond the seconds-long lag seen in practice.
 */
const PART_GRACE_MS = 10 * 60 * 1000;

function hasBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function partPath(id: string): string {
  return `${PART_PREFIX}${encodeURIComponent(id)}.json`;
}

/**
 * Fetch a blob body as JSON, cache-busted. Null once it has genuinely failed.
 *
 * The retries are not defensive padding. A part blob that has just been written
 * answers **404 at the exact URL `list()` reports for it**, for a minute or two
 * after the write — measured on 26 August 2026, when 14 of 33 parts saved
 * moments earlier were unreadable while the other 19 were fine. Without a
 * retry, `readCaptions` skips that part and returns the copy in the base
 * instead, which is the version from before the edit. Nothing errors. The
 * caption simply appears not to have saved, then appears to save itself later,
 * and a caller re-editing in between overwrites work that was never lost.
 */
async function fetchJson<T>(url: string, attempts = 3): Promise<T | null> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(`${url}?t=${Date.now()}-${attempt}`, { cache: "no-store" });
      if (res.ok) return (await res.json()) as T;
    } catch {
      // Network-level failure; treated the same as a bad status.
    }
    if (attempt < attempts) await new Promise((r) => setTimeout(r, 250 * attempt));
  }
  return null;
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
    let unreadable = 0;
    for (const p of parts) {
      if (!p?.id) {
        unreadable++;
        continue;
      }
      const { id, ...caption } = p;
      merged[id] = caption as StoredCaption;
    }

    // Said out loud, because the consequence is invisible: every part that
    // could not be read is a caption served from the base at whatever it said
    // before that part was written. That is stale content presented as current,
    // and silence about it is what made it take an afternoon to notice.
    if (unreadable > 0) {
      console.error(
        `readCaptions: ${unreadable} of ${partList.blobs.length} parts unreadable — ` +
          `those slots are being served from the compacted base and may be out of date`,
      );
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
 * Fold everything into the single base file and retire the parts it now covers.
 *
 * This is the one place a read-merge-write happens. It cannot lose a caption
 * outright — see the note at the top of this file — because a part is only
 * deleted once the base demonstrably contains it and it has aged past the window
 * in which another run might still be working from an older snapshot.
 */
export async function compactCaptions(entries: CaptionMap = {}): Promise<{
  total: number;
  added: number;
  partsCleared: number;
  partsKept: number;
}> {
  if (!hasBlob()) return { total: 0, added: 0, partsCleared: 0, partsKept: 0 };

  const { put, del, list } = await import("@vercel/blob");

  // Snapshot the parts BEFORE reading, so a part written during the read is
  // never a deletion candidate: it would not be in `merged` and so could be
  // dropped without ever having been folded in.
  const before = await list({ prefix: PART_PREFIX });
  const existing = await readCaptions();
  const merged = { ...existing, ...entries };

  // Nothing new and nothing to tidy — rewriting the base here buys nothing and
  // risks everything, since a stale read would be written back over good data.
  // The run that cost twelve captions generated zero and still wrote.
  if (!Object.keys(entries).length && !before.blobs.length) {
    return {
      total: Object.keys(merged).length,
      added: 0,
      partsCleared: 0,
      partsKept: 0,
    };
  }

  await put(BASE_KEY, JSON.stringify(merged), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: NO_CACHE,
  });

  let partsCleared = 0;
  let partsKept = 0;
  try {
    const cutoff = Date.now() - PART_GRACE_MS;
    const retire = before.blobs.filter((b) => {
      const id = decodeURIComponent(b.pathname.slice(PART_PREFIX.length).replace(/\.json$/, ""));
      const covered = Object.prototype.hasOwnProperty.call(merged, id);
      const settled = new Date(b.uploadedAt).getTime() < cutoff;
      return covered && settled;
    });
    partsKept = before.blobs.length - retire.length;
    if (retire.length) {
      await del(retire.map((b) => b.url));
      partsCleared = retire.length;
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
    partsKept,
  };
}
