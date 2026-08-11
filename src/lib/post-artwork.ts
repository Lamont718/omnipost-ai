import { Brand } from "./brands";
import { Topic } from "./sources";
import { LibraryImage, pickForSlot } from "./library";
import { shareImageFor, mapWithConcurrency } from "./share-image";
import { generatedImageUrl, hookLine } from "./post-image-url";

/**
 * Which picture a post carries — decided in one place, for every surface.
 *
 * This used to be decided three times. The Metricool export resolved the topic
 * page's share image; the calendar's post modal fetched it in the browser one
 * post at a time; and /api/schedule did neither, returning only a brand's
 * uploaded library. So the calendar grid and the showroom showed nothing at all
 * for MostHatedNBA and YODM — the two brands whose sources were deliberately
 * narrowed to pages that carry a real picture (a villain portrait, a printed
 * debate card). The pictures were there the whole time; nothing asked for them.
 *
 * Order of preference:
 *
 *   1. The brand's own library. Artwork Lamont chose beats anything derived.
 *   2. The topic page's share image — the real, already-designed picture a
 *      follower would see if they opened the link.
 *   3. A generated branded card. The floor, so no post goes out bare.
 */

export type ArtworkSource = "library" | "page" | "generated";

export interface Artwork {
  url: string;
  source: ArtworkSource;
  /** Sensible alt text: the topic for a real picture, the hook for a card. */
  alt: string;
}

interface ResolveInput {
  brand: Brand;
  slotId: string;
  topic: Topic;
  caption: string;
  /** Set to make generated-card URLs absolute — Metricool fetches them itself. */
  origin?: string;
  library: LibraryImage[];
  /** Page share images, pre-fetched in bulk. Missing key = not looked up. */
  shareImages: Map<string, string | null>;
}

export function resolveArtwork({
  brand,
  slotId,
  topic,
  caption,
  origin,
  library,
  shareImages,
}: ResolveInput): Artwork {
  const fromLibrary = pickForSlot(library, slotId, topic.url ?? topic.title);
  if (fromLibrary) {
    return { url: fromLibrary.url, source: "library", alt: topic.title };
  }

  // Only when the site actually varies it per page — see the flag's own note.
  if (!brand.sitewideShareImage && topic.url) {
    const page = shareImages.get(topic.url);
    if (page) return { url: page, source: "page", alt: topic.title };
  }

  const generated = generatedImageUrl(brand.slug, caption);
  return {
    url: origin ? `${origin}${generated}` : generated,
    source: "generated",
    // Same text the card itself renders, so alt and image agree.
    alt: caption ? hookLine(caption) : topic.title,
  };
}

/**
 * Look up the share images a batch of posts might need, once per distinct page.
 *
 * A month reuses the same page across several slots and each lookup is an HTTP
 * fetch, so this dedupes first. Brands whose site serves one image everywhere
 * are skipped entirely — fetching would only produce a picture we must not use.
 */
export async function shareImagesForTopics(
  entries: Array<{ brand: Brand; topic: Topic }>,
): Promise<Map<string, string | null>> {
  const pages = Array.from(
    new Set(
      entries
        .filter((e) => !e.brand.sitewideShareImage)
        .map((e) => e.topic.url)
        .filter((u): u is string => !!u),
    ),
  );
  const found = await mapWithConcurrency(pages, 8, shareImageFor);
  return new Map(pages.map((url, i) => [url, found[i]]));
}
