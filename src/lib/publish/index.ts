import { brandBySlug } from "../brands";
import { libraryFor } from "../library";
import { resolveArtwork, shareImagesForTopics } from "../post-artwork";
import { scheduledPostsInRange, withPinnedTopics } from "../schedule";
import { readCaptions } from "../store";
import { alreadyPublished, recordPublished } from "../published";
import { facebookAccount, instagramAccount, isPublishable, xAccount } from "../accounts";
import { publishToFacebook, publishToInstagram } from "./meta";
import { publishToX } from "./x";
import { PLATFORM_LIMIT } from "../compose";

/**
 * Publishing one scheduled post, for real.
 *
 * Everything else in this app produces something a human then acts on. This is
 * the one path with no human between the call and an audience, so the order of
 * operations matters more than usual:
 *
 *   1. Resolve the post exactly the way the sheet resolved it. Not "regenerate
 *      it", not "look it up a second way" — the same functions, so what goes out
 *      is what he read before pressing the button.
 *   2. Refuse if it has already been published. This is checked against durable
 *      storage, not the browser, because there is no way to unpublish.
 *   3. Refuse if it can't be posted as written — an over-length X post is the
 *      only real case, and it would be rejected by X anyway with a worse error.
 *   4. Publish, then record. In that order, because a publish that succeeds and
 *      then fails to record is recoverable by a human, while a record written
 *      before the attempt would hide a post that never went out.
 *
 * There is deliberately no scheduling and no cron in here. Publishing happens
 * when a person presses a button, once, on a post they are looking at.
 */

export interface PublishOutcome {
  id: string;
  published: boolean;
  remoteId?: string;
  permalink?: string;
  publishedAt?: string;
  /** Set when nothing was published, in words meant for the person posting. */
  error?: string;
  /** True when the reason was "this already went out". */
  duplicate?: boolean;
}

/**
 * The absolute URL a platform should fetch the artwork from.
 *
 * Meta and X both fetch the picture from their own servers, so a relative path
 * is useless to them and the app's own origin has to be baked in. Everything is
 * routed through the JPEG converter: Instagram accepts nothing else, and
 * sending all three platforms identical bytes removes a whole class of "it
 * worked on Facebook" confusion.
 */
function publishableImageUrl(imageUrl: string, origin: string, square: boolean): string {
  const params = new URLSearchParams({ url: imageUrl });
  if (square) params.set("fit", "square");
  return `${origin}/api/image-jpeg?${params.toString()}`;
}

/** Find one slot the same way the calendar and the sheet find it. */
async function resolvePost(id: string, origin: string) {
  const match = id.match(/^(.+):(\d{4}-\d{2}-\d{2}):(\d{2}:\d{2}):(instagram|facebook|linkedin|x)$/);
  if (!match) throw new Error(`"${id}" is not a slot id`);

  const [, brandSlug, date] = match;
  const brand = brandBySlug(brandSlug);
  if (!brand) throw new Error(`unknown brand: ${brandSlug}`);

  // One day either side, because the schedule is generated in New York time and
  // a slot near midnight can land outside a single-day window.
  const day = new Date(`${date}T12:00:00`);
  const start = new Date(day);
  start.setDate(day.getDate() - 1);
  const end = new Date(day);
  end.setDate(day.getDate() + 1);

  const [derived, captions] = await Promise.all([
    scheduledPostsInRange(start, end),
    readCaptions(),
  ]);

  const post = withPinnedTopics(derived, captions).find((p) => p.id === id);
  if (!post) throw new Error("that slot is not on the schedule");

  const caption = captions[id]?.caption ?? null;
  if (!caption) throw new Error("that slot has no caption yet");

  const [library, shareImages] = await Promise.all([
    libraryFor(brandSlug),
    shareImagesForTopics([{ brand, topic: post.topic }]),
  ]);

  const artwork = resolveArtwork({
    brand,
    slotId: id,
    topic: post.topic,
    caption,
    origin,
    library,
    shareImages,
  });

  return { brand, post, caption, artwork };
}

export async function publishSlot(id: string, origin: string): Promise<PublishOutcome> {
  const existing = await alreadyPublished(id);
  if (existing) {
    return {
      id,
      published: false,
      duplicate: true,
      publishedAt: existing.publishedAt,
      permalink: existing.permalink,
      error: `already published on ${new Date(existing.publishedAt).toLocaleString("en-US")}`,
    };
  }

  const { brand, post, caption, artwork } = await resolvePost(id, origin);
  const platform = post.platform;

  if (!isPublishable(platform)) {
    return { id, published: false, error: `${platform} publishing isn't supported` };
  }

  const limit = PLATFORM_LIMIT[platform as keyof typeof PLATFORM_LIMIT];
  if (limit && caption.length > limit) {
    return {
      id,
      published: false,
      error: `caption is ${caption.length - limit} characters over the ${limit} limit — rewrite it first`,
    };
  }

  try {
    let remoteId: string;
    let permalink: string | undefined;

    if (platform === "instagram") {
      const account = instagramAccount(brand.slug);
      if (!account) throw new Error(`${brand.name} has no Instagram account connected`);
      // Square, because Instagram refuses anything outside roughly 4:5–1.91:1
      // and a brand page's banner is often wider than that.
      const image = publishableImageUrl(artwork.url, origin, true);
      ({ remoteId, permalink } = await publishToInstagram(account, caption, image));
    } else if (platform === "facebook") {
      const account = facebookAccount(brand.slug);
      if (!account) throw new Error(`${brand.name} has no Facebook Page connected`);
      const image = publishableImageUrl(artwork.url, origin, false);
      ({ remoteId, permalink } = await publishToFacebook(account, caption, image));
    } else {
      const account = xAccount(brand.slug);
      if (!account) throw new Error(`${brand.name} has no X account connected`);
      const image = publishableImageUrl(artwork.url, origin, false);
      ({ remoteId, permalink } = await publishToX(account, caption, image));
    }

    const publishedAt = new Date().toISOString();

    // The post is live from here on. A failure to write the record is worth
    // shouting about in the logs, but it is not a failed publish and must never
    // be reported as one — that would invite a second attempt at something that
    // already went out.
    const recorded = await recordPublished({
      id,
      brandSlug: brand.slug,
      platform,
      publishedAt,
      remoteId,
      permalink,
    });
    if (!recorded) {
      console.error(`published ${id} but could not record it — duplicate guard is blind to it`);
    }

    return { id, published: true, remoteId, permalink, publishedAt };
  } catch (error) {
    return {
      id,
      published: false,
      error: error instanceof Error ? error.message : "publishing failed",
    };
  }
}
