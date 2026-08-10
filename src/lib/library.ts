/**
 * A brand's own marketing images, hosted publicly so a post can carry one.
 *
 * The topic page's share image is normally the best picture, but that assumes
 * pages have distinct ones. Emeka Explores doesn't: every page on the site —
 * lessons, parent guides, the index — returns the same /og-image.jpg, so a
 * month of posts would all carry one identical picture. Lamont has real
 * on-model artwork for that brand sitting on his machine, which is better than
 * anything this app could derive.
 *
 * So: images live in Blob under `library/<brand-slug>/`, and a brand that has
 * a library uses it in preference to its share image. Upload more by dropping
 * files into that prefix — nothing here needs changing.
 */

const PREFIX = "library/";

export interface LibraryImage {
  /** Public, direct URL — what goes in a post and in the Metricool CSV. */
  url: string;
  /** Filename without extension, used as alt text when nothing better exists. */
  name: string;
}

function hasBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** Every image for a brand, ordered by name so rotation is stable across reloads. */
export async function libraryFor(brandSlug: string): Promise<LibraryImage[]> {
  if (!hasBlob()) return [];
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: `${PREFIX}${brandSlug}/` });
    return blobs
      .map((b) => ({
        url: b.url,
        name: b.pathname.split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? "",
      }))
      .filter((i) => !!i.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error("libraryFor failed:", brandSlug, err);
    return [];
  }
}

/**
 * Which library image a given post gets.
 *
 * Deterministic, so the picture in the preview is the picture that posts, and
 * it doesn't change under him between looking and exporting. Keyed on the slot
 * id rather than an index, so adding a brand or shifting the schedule doesn't
 * reshuffle every image on the calendar.
 */
export function pickForSlot(images: LibraryImage[], slotId: string): LibraryImage | null {
  if (images.length === 0) return null;
  let hash = 0;
  for (let i = 0; i < slotId.length; i++) {
    hash = (hash * 31 + slotId.charCodeAt(i)) | 0;
  }
  return images[Math.abs(hash) % images.length];
}
