import { NextRequest, NextResponse } from "next/server";
import { scheduledPostsInRange, withPinnedTopics } from "@/lib/schedule";
import { readCaptions } from "@/lib/store";
import { libraryFor } from "@/lib/library";
import { brandBySlug } from "@/lib/brands";
import { resolveArtwork, shareImagesForTopics } from "@/lib/post-artwork";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// No `revalidate` here on purpose. It used to be 3600, which silently overrode
// the force-dynamic above it and cached the whole response for an hour — so a
// caption written a minute ago didn't show up, and verifying a write by
// re-reading this route returned the same stale count either way.
//
// The hour of caching now lives on the sitemap and page-meta fetches in
// lib/sources.ts, which is the part that's actually expensive and actually
// slow to change. Captions stay live.

/**
 * The calendar's data source. Returns every scheduled post for a month, each
 * with its date/time/platform/brand/topic and — if the Monday run has written
 * it — the finished caption.
 *
 *   GET /api/schedule?month=YYYY-MM
 *
 * The grid shows whole weeks, so the range is padded to the Sunday before the
 * 1st and the Saturday after the last day.
 */
export async function GET(request: NextRequest) {
  const monthParam =
    new URL(request.url).searchParams.get("month") ??
    new Date().toISOString().slice(0, 7);

  const m = monthParam.match(/^(\d{4})-(\d{2})$/);
  if (!m) {
    return NextResponse.json(
      { error: "month must be YYYY-MM" },
      { status: 400 },
    );
  }

  const year = Number(m[1]);
  const month = Number(m[2]) - 1;

  // Pad to full calendar weeks (Sunday-start grid).
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay()));

  try {
    const [derived, captions] = await Promise.all([
      scheduledPostsInRange(start, end),
      readCaptions(),
    ]);

    // A written post keeps the topic it was written from, so its label, link
    // and picture can't drift onto whatever discovery returns today.
    const posts = withPinnedTopics(derived, captions);

    // One lookup per brand on screen, not one per post.
    const slugs = Array.from(new Set(posts.map((p) => p.brandSlug)));
    const libraries = new Map(
      await Promise.all(
        slugs.map(async (slug) => [slug, await libraryFor(slug)] as const),
      ),
    );

    // The topic pages' own share images — a villain portrait, a YODM card —
    // deduped to one fetch per distinct page and cached for a day. This route
    // used to skip them entirely and return only library artwork, which is why
    // MostHatedNBA and YODM showed no picture anywhere except inside the modal.
    const shareImages = await shareImagesForTopics(
      posts.flatMap((p) => {
        const brand = brandBySlug(p.brandSlug);
        return brand ? [{ brand, topic: p.topic }] : [];
      }),
    );

    return NextResponse.json({
      month: monthParam,
      posts: posts.map((p) => {
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
      }),
    }, {
      // Never let the edge hold this: a caption written seconds ago has to
      // show on the next load.
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("schedule route failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
