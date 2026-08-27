import { brandBySlug } from "./brands";

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

/**
 * The part of a filename that has to appear in the topic for it to match.
 *
 * A trailing `-1`, `-2`, `-3` is a numbering, not a subject: `basketball-2.jpg`
 * is a second basketball photograph, and it should match every post a plain
 * `basketball.jpg` matches. That is the whole convention — drop several photos
 * for one topic, number them, and the rotation below spreads them across the
 * posts on that topic rather than showing the first one every time.
 *
 * Only a trailing number counts. `08-emeka-welcome-smile` keeps its leading
 * number, because that one orders the clips and is part of the name.
 */
function matchKey(image: LibraryImage): string {
  return image.name.toLowerCase().replace(/-\d+$/, "");
}

/** Stable per-slot number: the same post always lands on the same picture. */
function slotHash(slotId: string): number {
  let hash = 0;
  for (let i = 0; i < slotId.length; i++) {
    hash = (hash * 31 + slotId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function nameOf(url: string): string {
  return url.split("?")[0].split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? "";
}

/**
 * Every image for a brand: the ones declared in brands.ts (artwork the brand's
 * own site already serves) plus anything uploaded to Blob. Ordered by name so
 * rotation is stable across reloads.
 */
export async function libraryFor(brandSlug: string): Promise<LibraryImage[]> {
  const declared: LibraryImage[] = (brandBySlug(brandSlug)?.imageLibrary ?? []).map(
    (url) => ({ url, name: nameOf(url) }),
  );

  let uploaded: LibraryImage[] = [];
  if (hasBlob()) {
    try {
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({ prefix: `${PREFIX}${brandSlug}/` });
      uploaded = blobs
        // Clips and their poster frames live one level down, under `video/`,
        // and a listing by prefix returns them too. Without this the posters
        // would join the still-image rotation and a Reel's thumbnail would
        // start appearing as a photo post in its own right.
        .filter((b) => !b.pathname.slice(`${PREFIX}${brandSlug}/`.length).includes("/"))
        .map((b) => ({ url: b.url, name: nameOf(b.pathname) }))
        .filter((i) => !!i.name);
    } catch (err) {
      console.error("libraryFor failed:", brandSlug, err);
    }
  }

  return [...declared, ...uploaded].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Which library image a given post gets.
 *
 * Deterministic, so the picture in the preview is the picture that posts, and
 * it doesn't change under him between looking and exporting. Keyed on the slot
 * id rather than an index, so adding a brand or shifting the schedule doesn't
 * reshuffle every image on the calendar.
 */
export function pickForSlot(
  images: LibraryImage[],
  slotId: string,
  /** The topic's URL or title. An image whose name matches it wins. */
  hint?: string,
): LibraryImage | null {
  if (images.length === 0) return null;

  // A post about oxtail should carry the oxtail photograph. Compare against a
  // flattened hint so "oxtail-heart-smart" still matches "oxtail", and prefer
  // the longest match so "friedchicken" beats a stray "chicken".
  if (hint) {
    const flat = hint.toLowerCase().replace(/[^a-z0-9]/g, "");
    const matches = images.filter(
      (i) => matchKey(i).length >= 4 && flat.includes(matchKey(i)),
    );
    if (matches.length > 0) {
      // Keep only the most specific matches, then rotate between them. Before
      // this it was `matches[0]` after a sort, which meant a brand with four
      // posts about the same topic showed the same photograph four times —
      // the exact "one identical picture all month" failure the library was
      // built to end, arriving through the matching rule instead of the
      // absence of pictures.
      const best = Math.max(...matches.map((i) => matchKey(i).length));
      const tied = matches.filter((i) => matchKey(i).length === best);
      return tied[slotHash(slotId) % tied.length];
    }
  }

  return images[slotHash(slotId) % images.length];
}
