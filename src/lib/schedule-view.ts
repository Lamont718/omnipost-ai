import { scheduledPostsInRange, withPinnedTopics } from "./schedule";
import { readCaptions } from "./store";
import { libraryFor } from "./library";
import { brandBySlug } from "./brands";
import { resolveArtwork, shareImagesForTopics } from "./post-artwork";
import type { Platform } from "./types";
import type { Topic } from "./sources";

/**
 * One place that turns "a range of dates" into "the posts, written, with their
 * pictures".
 *
 * This exists because every time two readers assembled this independently they
 * eventually disagreed. The calendar and the export once resolved artwork
 * differently, so MostHatedNBA showed a villain portrait in one and nothing in
 * the other; the modal fetched its own and made a third answer. Topics had the
 * same history before `withPinnedTopics` became the single helper.
 *
 * So the schedule API and the daily email both call this, and the email cannot
 * quietly describe a different day than the sheet does.
 */

export interface SlotView {
  id: string;
  date: string;
  time: string;
  platform: Platform;
  brand: { slug: string; name: string; colorHex: string };
  topic: Topic;
  caption: string | null;
  image: string | null;
  imageAlt: string | null;
  imageSource: string | null;
}

export async function buildSlotViews(start: Date, end: Date): Promise<SlotView[]> {
  const [derived, captions] = await Promise.all([
    scheduledPostsInRange(start, end),
    readCaptions(),
  ]);

  // A written post keeps the topic it was written from, so its label, link and
  // picture can't drift onto whatever discovery returns today.
  const posts = withPinnedTopics(derived, captions);

  // One lookup per brand on screen, not one per post.
  const slugs = Array.from(new Set(posts.map((p) => p.brandSlug)));
  const libraries = new Map(
    await Promise.all(slugs.map(async (slug) => [slug, await libraryFor(slug)] as const)),
  );

  // The topic pages' own share images — a villain portrait, a YODM card —
  // deduped to one fetch per distinct page.
  const shareImages = await shareImagesForTopics(
    posts.flatMap((p) => {
      const brand = brandBySlug(p.brandSlug);
      return brand ? [{ brand, topic: p.topic }] : [];
    }),
  );

  return posts.map((p) => {
    const brand = brandBySlug(p.brandSlug);
    const caption = captions[p.id]?.caption ?? null;
    const artwork =
      brand && caption
        ? resolveArtwork({
            brand,
            slotId: p.id,
            topic: p.topic,
            caption,
            library: libraries.get(p.brandSlug) ?? [],
            shareImages,
          })
        : null;

    return {
      id: p.id,
      date: p.date,
      time: p.time,
      platform: p.platform,
      brand: { slug: p.brandSlug, name: p.brandName, colorHex: p.colorHex },
      topic: p.topic,
      caption,
      // Null until there's a caption: the generated card is built from the
      // caption's opening line, so there is nothing to draw before then.
      image: artwork?.url ?? null,
      imageAlt: artwork?.alt ?? null,
      imageSource: artwork?.source ?? null,
    };
  });
}
