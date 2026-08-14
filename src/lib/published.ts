import { Platform } from "./types";

/**
 * The durable record of what has actually been published.
 *
 * Until now "posted" was a tick in `localStorage` — fine when it only greyed a
 * row out, and completely inadequate the moment a button can really publish.
 * localStorage is per-browser: post from the laptop, open the sheet on the
 * phone, and every post looks unposted. With a Post button that would mean
 * posting the same thing twice to a real audience, and there is no undo for
 * that on Instagram.
 *
 * So a successful publish writes a blob, and the publish path refuses any slot
 * that already has one. The record is the guard, not the UI.
 *
 * Layout follows the same rule the captions store had to learn the hard way:
 * one blob per record, written without reading anything first, so two publishes
 * racing each other cannot erase one another. There is no compaction here —
 * records are small, there are at most a few thousand a year, and nothing reads
 * them in a hot path except one `list()` per sheet load.
 */

const PREFIX = "published/";

export interface PublishRecord {
  /** Slot id — brand:date:time:platform. */
  id: string;
  brandSlug: string;
  platform: Platform;
  /** ISO timestamp of when it actually went out. */
  publishedAt: string;
  /** The platform's own id for the post, so it can be found again. */
  remoteId: string;
  /** A link to the live post where the platform gives us one. */
  permalink?: string;
}

function hasBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function recordPath(id: string): string {
  return `${PREFIX}${encodeURIComponent(id)}.json`;
}

/** Every published record, keyed by slot id. */
export async function readPublished(): Promise<Record<string, PublishRecord>> {
  if (!hasBlob()) return {};
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: PREFIX });

    const out: Record<string, PublishRecord> = {};
    const fetched = await Promise.all(
      blobs.map(async (b) => {
        try {
          const res = await fetch(`${b.url}?t=${Date.now()}`, { cache: "no-store" });
          return res.ok ? ((await res.json()) as PublishRecord) : null;
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
    console.error("readPublished failed:", err);
    return {};
  }
}

/**
 * Has this exact slot already gone out?
 *
 * Checked immediately before publishing rather than trusting the caller, and
 * deliberately reading the one blob instead of the whole list — a single object
 * read is both faster and less likely to be stale than a `list()`, and this is
 * the check standing between one post and two.
 */
export async function alreadyPublished(id: string): Promise<PublishRecord | null> {
  if (!hasBlob()) return null;
  try {
    const { head } = await import("@vercel/blob");
    const meta = await head(recordPath(id));
    const res = await fetch(`${meta.url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PublishRecord;
  } catch {
    // head() throws a BlobNotFoundError when there is no record, which is the
    // ordinary case for anything unpublished.
    return null;
  }
}

export async function recordPublished(record: PublishRecord): Promise<boolean> {
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
    console.error(`recordPublished failed for ${record.id}:`, err);
    return false;
  }
}
