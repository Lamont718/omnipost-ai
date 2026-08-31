import { PLATFORM_PATTERN } from "../types";
import { brandBySlug } from "../brands";
import { libraryFor } from "../library";
import { videosFor } from "../video-library";
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
  const match = id.match(
    new RegExp(`^(.+):(\\d{4}-\\d{2}-\\d{2}):(\\d{2}:\\d{2}):(${PLATFORM_PATTERN})$`),
  );
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

  const [library, videos, shareImages] = await Promise.all([
    libraryFor(brandSlug),
    videosFor(brandSlug),
    shareImagesForTopics([{ brand, topic: post.topic }]),
  ]);

  // Resolved with the clips, not without them. Leaving them out would not have
  // failed — it would have quietly resolved the still underneath and published
  // a photo of a post he was looking at as a Reel, which is worse than an error.
  const artwork = resolveArtwork({
    brand,
    slotId: id,
    topic: post.topic,
    caption,
    origin,
    library,
    shareImages,
    platform: post.platform,
    videos,
    pinnedVideo: captions[id]?.video ?? null,
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

  // A slot id that doesn't parse, isn't on the schedule, or has no caption yet
  // is the caller's mistake, not a server fault. Letting it throw made the route
  // answer 500, which reads in the logs as "the publisher is broken" when it
  // means "that post doesn't exist".
  let resolved: Awaited<ReturnType<typeof resolvePost>>;
  try {
    resolved = await resolvePost(id, origin);
  } catch (error) {
    return {
      id,
      published: false,
      error: error instanceof Error ? error.message : "could not find that post",
    };
  }

  const { brand, post, caption, artwork } = resolved;
  const platform = post.platform;

  if (!isPublishable(platform)) {
    return { id, published: false, error: `${platform} publishing isn't supported` };
  }

  // Reels are not wired. Publishing a video through the Instagram API is a
  // different call — a REELS container, then polling until Meta finishes
  // processing it — and none of that is built. The important part is that this
  // refuses instead of falling through: the image path would happily post the
  // poster frame, so a post he is looking at as a video would go out as a
  // still, with a caption written for a video. He posts these by hand anyway.
  if (artwork.kind === "video") {
    return {
      id,
      published: false,
      error:
        "this one is a video — Reels aren't wired up, so save the clip and post it by hand",
    };
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
    } else if (platform === "x") {
      const account = xAccount(brand.slug);
      if (!account) throw new Error(`${brand.name} has no X account connected`);
      const image = publishableImageUrl(artwork.url, origin, false);
      ({ remoteId, permalink } = await publishToX(account, caption, image));
    } else {
      // Named, not defaulted. This used to be a bare `else` that sent
      // anything unrecognised to X — which was harmless only while X was the
      // last platform in the union. It stopped being harmless the moment
      // TikTok was added: a vertical clip and a caption written for TikTok
      // would have gone out as a tweet, under his name, with nothing saying
      // so. LinkedIn had the same hole and nobody had hit it yet.
      throw new Error(
        `${brand.name}: publishing to ${platform} is not built yet — post it by hand from /sheet`,
      );
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
