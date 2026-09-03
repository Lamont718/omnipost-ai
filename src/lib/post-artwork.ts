import { Brand, postImageUrlFor } from "./brands";
import { Topic } from "./sources";
import { LibraryImage, pickForSlot } from "./library";
import {
  LibraryVideo,
  PinnedVideo,
  pickVideoForSlot,
  platformPlaysVideo,
} from "./video-library";
import { shareImageFor, mapWithConcurrency } from "./share-image";
import { generatedImageUrl, hookLine } from "./post-image-url";
import type { Platform } from "./types";

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
 *
 * A brand with video clips is a separate question asked first. A Reel is not a
 * better-looking post, it is a different distribution: Instagram shows a still
 * to followers and a Reel to people who have never heard of the account. So a
 * clip wins over every picture when the brand has one, and the picture that
 * would have been chosen stays on as the poster frame when the clip has none.
 */

export type ArtworkSource = "library" | "page" | "generated";

/**
 * Whether the post carries a still or a clip. `url` is a still either way — the
 * poster frame for a video — so every surface that only knows how to show a
 * picture keeps working, and the ones that can play a video read `videoUrl`.
 */
export type ArtworkKind = "image" | "video";

export interface Artwork {
  url: string;
  source: ArtworkSource;
  /** Sensible alt text: the topic for a real picture, the hook for a card. */
  alt: string;
  kind: ArtworkKind;
  /** The clip itself. Set only when kind is "video". */
  videoUrl?: string;
  /** What the clip shows, for a caption on screen and for the writer. */
  videoDescribes?: string;
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
  /** Which platform this slot posts to — a clip is only used where it plays. */
  platform?: Platform;
  /** The brand's clips. Empty for every brand that has none. */
  videos?: LibraryVideo[];
  /** The clip stored with the caption, which outranks a fresh rotation. */
  pinnedVideo?: PinnedVideo | null;
  /** The still stored with the caption — a picture chosen, not derived. */
  pinnedImage?: LibraryImage | null;
}

export function resolveArtwork(input: ResolveInput): Artwork {
  const { slotId, topic, videos, pinnedVideo, platform } = input;

  /**
   * `pageImageWins` topics never take a clip, even a pinned one.
   *
   * The clip-beats-picture rule below is right when the picture is a share
   * image derived from a page — a moving Emeka outperforms a static card. It is
   * wrong when the picture IS the product. Every Emeka Books topic is marked
   * still-only for that reason: a post about My Crown has to show the cover of
   * My Crown, and the fifteen clips in the library show none of the books.
   */
  const clip =
    platformPlaysVideo(platform) && !topic.pageImageWins
      ? pinnedVideo ?? pickVideoForSlot(videos ?? [], slotId, topic.url ?? topic.title)
      : null;

  if (clip) {
    return {
      // A clip uploaded without its poster frame borrows the still this post
      // would otherwise have carried, rather than showing an empty box.
      url: clip.poster ?? resolveStill(input).url,
      source: "library",
      alt: clip.describes ?? topic.title,
      kind: "video",
      videoUrl: clip.url,
      ...(clip.describes ? { videoDescribes: clip.describes } : {}),
    };
  }

  return { ...resolveStill(input), kind: "image" };
}

function resolveStill({
  brand,
  slotId,
  topic,
  caption,
  origin,
  library,
  shareImages,
  platform,
  pinnedImage,
}: ResolveInput): Omit<Artwork, "kind"> {
  /*
   * A picture somebody chose for this post, which outranks every rule below —
   * including the brand's own card renderer.
   *
   * Everything else here is a ranking of guesses: this page's share image, the
   * library by hash, a generated card. A human looking at the post and picking
   * the photograph is not a guess, and no automatic rule should be able to
   * overrule it tomorrow.
   */
  if (pinnedImage) {
    return { url: pinnedImage.url, source: "library", alt: topic.title };
  }

  // Only when the site actually varies it per page — see the flag's own note.
  const pageImage =
    !brand.sitewideShareImage && topic.url ? shareImages.get(topic.url) : null;

  /**
   * A picture the brand's own site can build for this exact topic at post size.
   *
   * Ranked above everything, including the library, because it is not a derived
   * or borrowed graphic: it is this card, in this brand's design, in the shape
   * the platform actually shows. There is no case where a generic library
   * photograph beats the card the post is about.
   */
  const postImage = postImageUrlFor(brand, topic.url, platform);
  if (postImage) {
    return { url: postImage, source: "page", alt: topic.title };
  }

  /**
   * Normally the brand library wins: artwork Lamont chose beats anything
   * derived from a page. A `pageImageWins` topic inverts that, and it has to,
   * because for these the page image is not a derived share graphic — it is the
   * subject. Emeka Explores has a Blob library of Emeka artwork, so without
   * this a post about the cover of My Crown would be illustrated with a picture
   * of Emeka and the cover would never appear.
   *
   * The library is still the fallback if the page turns out to have no image,
   * so a book with a missing cover degrades to brand art rather than to the
   * generated text card.
   */
  if (topic.pageImageWins && pageImage) {
    return { url: pageImage, source: "page", alt: topic.title };
  }

  const fromLibrary = pickForSlot(library, slotId, topic.url ?? topic.title);
  if (fromLibrary) {
    return { url: fromLibrary.url, source: "library", alt: topic.title };
  }

  if (pageImage) return { url: pageImage, source: "page", alt: topic.title };

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
