import { GenerateResponse } from "./types";

/**
 * Where written captions live between the Monday generation run and the calendar
 * that displays them.
 *
 * Backed by Vercel Blob — a single JSON object keyed by slot id (see
 * schedule.ts). Blob is object storage, not a database: one file, put and get,
 * no schema. If BLOB_READ_WRITE_TOKEN is not set the store degrades to empty
 * (get returns {}, put is a no-op), and the calendar simply shows scheduled
 * slots with their topic and lets you generate a caption on demand. Nothing
 * breaks without it — it only pre-fills.
 */

export interface StoredCaption extends GenerateResponse {
  /** ISO timestamp of when it was written. */
  generatedAt: string;
}

export type CaptionMap = Record<string, StoredCaption>;

const BLOB_KEY = "captions.json";

function hasBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** Read the whole caption map. Returns {} when the store is empty or absent. */
export async function readCaptions(): Promise<CaptionMap> {
  if (!hasBlob()) return {};
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: BLOB_KEY });
    const hit = blobs.find((b) => b.pathname === BLOB_KEY);
    if (!hit) return {};
    // Cache-bust: Blob URLs are CDN-cached, and we want the latest write.
    const res = await fetch(`${hit.url}?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return {};
    return (await res.json()) as CaptionMap;
  } catch (err) {
    console.error("readCaptions failed:", err);
    return {};
  }
}

/** Merge new captions into the stored map. No-op without a Blob token. */
export async function writeCaptions(entries: CaptionMap): Promise<number> {
  if (!hasBlob()) return 0;
  const { put } = await import("@vercel/blob");
  const current = await readCaptions();
  const merged = { ...current, ...entries };
  await put(BLOB_KEY, JSON.stringify(merged), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return Object.keys(entries).length;
}
