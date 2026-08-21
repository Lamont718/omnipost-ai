import { NextRequest, NextResponse } from "next/server";
import { scheduledPostsInRange, withPinnedTopics } from "@/lib/schedule";
import { readCaptions } from "@/lib/store";
import { brandBySlug } from "@/lib/brands";
import { libraryFor } from "@/lib/library";
import { videosFor } from "@/lib/video-library";
import { resolveArtwork, shareImagesForTopics } from "@/lib/post-artwork";
import { toMetricoolCsv, ExportPost, RECOMMENDED_MAX_ROWS } from "@/lib/metricool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A month of written posts as a Metricool bulk-import CSV.
 *
 *   GET /api/export?month=2026-09&brand=yodm[&draft=1][&from=2026-09-10]
 *
 * One brand at a time by default, because Metricool's "Brand name" column has
 * to match its own brand names exactly, case included, and we don't know what
 * Lamont called them in there. Leaving it blank imports into whichever brand is
 * open, which is the reliable path. Pass ?brandName= to fill it in once the
 * names are known.
 *
 * Only posts that have actually been written are exported — a row with no text
 * is a post Metricool would schedule as an empty message.
 *
 * Reels are left out, and counted in the X-Skipped-Video-Rows header rather
 * than dropped quietly. Metricool's import template carries "Picture Url 1" and
 * their documentation describes images; there is no column this app can put a
 * clip in and be sure of. Exporting the poster frame instead would be worse
 * than omitting the row, because the CSV would schedule a photo post carrying a
 * caption written for a video, and nothing downstream would ever say so.
 */

function monthRange(month: string): { start: Date; end: Date } | null {
  const m = month.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const mon = Number(m[2]) - 1;
  return { start: new Date(year, mon, 1), end: new Date(year, mon + 1, 0) };
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const month = params.get("month") ?? new Date().toISOString().slice(0, 7);
  const brandSlug = params.get("brand");
  const draft = params.get("draft") === "1";
  const brandName = params.get("brandName") ?? undefined;
  /** Skip anything before this date — no point scheduling posts into the past. */
  const from = params.get("from") ?? new Date().toISOString().slice(0, 10);

  const range = monthRange(month);
  if (!range) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }
  if (brandSlug && !brandBySlug(brandSlug)) {
    return NextResponse.json({ error: `unknown brand: ${brandSlug}` }, { status: 404 });
  }

  try {
    const [derived, captions] = await Promise.all([
      scheduledPostsInRange(range.start, range.end),
      readCaptions(),
    ]);

    // Pin before anything else reads a topic: the row's image and alt text have
    // to describe the caption sitting next to them, not a re-derived page.
    const scheduled = withPinnedTopics(derived, captions);

    const eligible = scheduled.filter(
      (p) =>
        (!brandSlug || p.brandSlug === brandSlug) &&
        p.date >= from &&
        !!captions[p.id]?.caption,
    );

    // Same resolver, same order of preference the calendar previews use, so the
    // picture he approved on screen is the picture that posts.
    const withBrand = eligible.flatMap((p) => {
      const brand = brandBySlug(p.brandSlug);
      return brand ? [{ post: p, brand }] : [];
    });
    const shareImages = await shareImagesForTopics(
      withBrand.map(({ post, brand }) => ({ brand, topic: post.topic })),
    );

    const slugs = Array.from(new Set(eligible.map((p) => p.brandSlug)));
    const libraries = new Map(
      await Promise.all(slugs.map(async (s) => [s, await libraryFor(s)] as const)),
    );
    // Resolved with the clips so a Reel is recognisable as one here. Without
    // them this route would resolve the still underneath and export the post as
    // a photo, which is the failure this is trying to avoid.
    const videos = new Map(
      await Promise.all(slugs.map(async (s) => [s, await videosFor(s)] as const)),
    );

    // Absolute — Metricool fetches these from its own servers, so a
    // root-relative path would be meaningless.
    const origin = new URL(request.url).origin;
    let skippedVideo = 0;
    const rows: ExportPost[] = withBrand.flatMap(({ post: p, brand }) => {
      const caption = captions[p.id].caption;
      const artwork = resolveArtwork({
        brand,
        slotId: p.id,
        topic: p.topic,
        caption,
        origin,
        library: libraries.get(p.brandSlug) ?? [],
        shareImages,
        platform: p.platform,
        videos: videos.get(p.brandSlug) ?? [],
        pinnedVideo: captions[p.id]?.video ?? null,
      });
      if (artwork.kind === "video") {
        skippedVideo++;
        return [];
      }
      return [
        {
          caption,
          date: p.date,
          time: p.time,
          platform: p.platform,
          imageUrl: artwork.url,
          imageAlt: artwork.alt,
          brandName,
        },
      ];
    });

    rows.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

    const csv = toMetricoolCsv(rows, draft);
    const filename = `metricool-${brandSlug ?? "all-brands"}-${month}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // Metricool advises importing in blocks of 50; surfaced as a header so
        // the calendar can warn rather than letting a big file fail quietly.
        "X-Row-Count": String(rows.length),
        // Reels this file could not carry. Surfaced so "8 posts exported" is
        // never read as "everything for that month is in here".
        "X-Skipped-Video-Rows": String(skippedVideo),
        "X-Row-Limit": String(RECOMMENDED_MAX_ROWS),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("export failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
