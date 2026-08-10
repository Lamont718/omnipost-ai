import { NextRequest, NextResponse } from "next/server";
import { scheduledPostsInRange } from "@/lib/schedule";
import { readCaptions } from "@/lib/store";
import { brandBySlug } from "@/lib/brands";
import { shareImageFor, mapWithConcurrency } from "@/lib/share-image";
import { libraryFor, pickForSlot } from "@/lib/library";
import { generatedImageUrl, hookLine } from "@/lib/post-image-url";
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
    const [scheduled, captions] = await Promise.all([
      scheduledPostsInRange(range.start, range.end),
      readCaptions(),
    ]);

    const eligible = scheduled.filter(
      (p) =>
        (!brandSlug || p.brandSlug === brandSlug) &&
        p.date >= from &&
        !!captions[p.id]?.caption,
    );

    // Distinct topic pages only — a month reuses the same page across several
    // slots, and each lookup is an HTTP fetch.
    const pages = Array.from(
      new Set(eligible.map((p) => p.topic.url).filter((u): u is string => !!u)),
    );
    const found = await mapWithConcurrency(pages, 8, shareImageFor);
    const imageByPage = new Map(pages.map((url, i) => [url, found[i]]));

    // Brand artwork, where a brand has a library. Same order of preference the
    // previews use, so the picture he approved on screen is the one that posts.
    const slugs = Array.from(new Set(eligible.map((p) => p.brandSlug)));
    const libraries = new Map(
      await Promise.all(slugs.map(async (s) => [s, await libraryFor(s)] as const)),
    );

    const origin = new URL(request.url).origin;
    const rows: ExportPost[] = eligible.map((p) => {
      const caption = captions[p.id].caption;
      const fromLibrary = pickForSlot(
        libraries.get(p.brandSlug) ?? [],
        p.id,
        p.topic.url ?? p.topic.title,
      );
      const shareImage = p.topic.url ? imageByPage.get(p.topic.url) : null;
      // Same fallback the previews use, but absolute — Metricool fetches these
      // from its own servers, so a root-relative path would be meaningless.
      const generated = `${origin}${generatedImageUrl(p.brandSlug, caption)}`;
      return {
        caption,
        date: p.date,
        time: p.time,
        platform: p.platform,
        imageUrl: fromLibrary?.url ?? shareImage ?? generated,
        imageAlt: fromLibrary
          ? p.topic.title
          : shareImage
            ? p.topic.title
            : hookLine(caption),
        brandName,
      };
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
