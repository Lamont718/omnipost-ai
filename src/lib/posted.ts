/**
 * "I posted this myself" — the manual tick, kept on the server.
 *
 * This is deliberately a different thing from `published.ts`. That file records
 * what the app published through a platform API and carries a remote id and a
 * permalink to prove it. This one records a human saying "done", which has no
 * remote id and never will, because the posting happened in the Instagram app
 * on a phone.
 *
 * It used to live in `localStorage` under `omnipost.posted`, which was fine
 * while the sheet was a single-device checklist and wrong the moment it wasn't.
 * He posts from his phone and reviews on the laptop; a per-browser tick meant
 * the laptop showed a month of finished work as still to do, and "12 of 40
 * posted" — the one number the sheet exists to give — was wrong on every device
 * but one.
 *
 * Same storage shape as published.ts and for the same reason: one blob per
 * record, written without reading anything first, so two devices ticking at
 * once cannot erase each other. Un-ticking deletes the blob rather than writing
 * a false flag, so absence always means "not posted" and there is only ever one
 * way to represent it.
 *
 * localStorage is still written by the client, but only as a cache for the
 * first paint and a fallback for when there's no blob store. The server is the
 * truth.
 */

const PREFIX = "posted/";

export interface PostedRecord {
  /** Slot id — brand:date:time:platform. */
  id: string;
  /** ISO timestamp of when it was ticked off. */
  markedAt: string;
}

function hasBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function recordPath(id: string): string {
  return `${PREFIX}${encodeURIComponent(id)}.json`;
}

/** Every manual tick, keyed by slot id. */
export async function readPosted(): Promise<Record<string, PostedRecord>> {
  if (!hasBlob()) return {};
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: PREFIX });

    const out: Record<string, PostedRecord> = {};
    const fetched = await Promise.all(
      blobs.map(async (b) => {
        try {
          const res = await fetch(`${b.url}?t=${Date.now()}`, { cache: "no-store" });
          return res.ok ? ((await res.json()) as PostedRecord) : null;
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
    console.error("readPosted failed:", err);
    return {};
  }
}

/**
 * Tick one slot off. Returns false when there's nowhere to write, so a caller
 * that reports "saved" is reporting something true rather than assuming.
 */
export async function markPosted(id: string, markedAt = new Date().toISOString()): Promise<boolean> {
  if (!hasBlob()) return false;
  try {
    const { put } = await import("@vercel/blob");
    await put(recordPath(id), JSON.stringify({ id, markedAt } satisfies PostedRecord), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return true;
  } catch (err) {
    console.error(`markPosted failed for ${id}:`, err);
    return false;
  }
}

/** Un-tick a slot. Deleting something that was never there is not an error. */
export async function unmarkPosted(id: string): Promise<boolean> {
  if (!hasBlob()) return false;
  try {
    const { del, head } = await import("@vercel/blob");
    const meta = await head(recordPath(id)).catch(() => null);
    if (!meta) return true;
    await del(meta.url);
    return true;
  } catch (err) {
    console.error(`unmarkPosted failed for ${id}:`, err);
    return false;
  }
}
