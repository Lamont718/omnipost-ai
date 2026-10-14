import type { ListBlobResultBlob } from "@vercel/blob";

/**
 * Every blob under a prefix, across all pages.
 *
 * `list()` returns at most 1000 blobs and a cursor for the rest. Every caller
 * in this app used to take the first page and stop, which is invisible until a
 * prefix crosses 1000 — then ticks, publish records and caption parts past the
 * line silently stop existing, and a posted post comes back as due.
 */
export async function listAll(prefix: string): Promise<ListBlobResultBlob[]> {
  const { list } = await import("@vercel/blob");
  const out: ListBlobResultBlob[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}
