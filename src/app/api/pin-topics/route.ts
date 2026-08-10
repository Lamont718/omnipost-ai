import { NextRequest, NextResponse } from "next/server";
import { scheduledPostsInRange } from "@/lib/schedule";
import { readCaptions, writeCaptions, CaptionMap } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Backfill: attach the current topic to captions that were written before
 * topics were stored alongside them.
 *
 *   GET /api/pin-topics?secret=$CRON_SECRET&month=2026-08[&dry=1]
 *
 * Every caption written from now on carries its own topic, but the ones already
 * in the store don't, so they still re-derive one on every read and can still
 * drift. Discovery is deterministic for a given date — same week, same sitemap,
 * same picks — so what it returns today for an August slot is what it returned
 * when that caption was written, as long as the brand's sources haven't changed
 * since. Writing that down turns "probably still right" into "fixed".
 *
 * Which is also the limit of it: run this BEFORE editing a brand's `sources`,
 * never after. Afterwards, discovery returns the new pages and the backfill
 * would freeze the wrong pairing permanently. Anything already carrying a topic
 * is left alone, so re-running is safe and costs nothing.
 *
 * No generation happens here — it only copies topics onto existing captions, so
 * it spends no tokens.
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const monthParam = params.get("month") ?? new Date().toISOString().slice(0, 7);
  const dry = params.get("dry") === "1";

  const m = monthParam.match(/^(\d{4})-(\d{2})$/);
  if (!m) {
    return NextResponse.json({ error: "month must be YYYY-MM" }, { status: 400 });
  }

  // Same padding as the calendar: its grid spills into the neighbouring months,
  // and those spilled slots hold captions too.
  const first = new Date(Number(m[1]), Number(m[2]) - 1, 1);
  const last = new Date(Number(m[1]), Number(m[2]), 0);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - last.getDay()));

  try {
    const [posts, captions] = await Promise.all([
      scheduledPostsInRange(start, end),
      readCaptions(),
    ]);

    const updates: CaptionMap = {};
    let alreadyPinned = 0;
    let uncaptioned = 0;

    for (const post of posts) {
      const stored = captions[post.id];
      if (!stored?.caption) {
        uncaptioned++;
        continue;
      }
      if (stored.topic) {
        alreadyPinned++;
        continue;
      }
      updates[post.id] = { ...stored, topic: post.topic };
    }

    const pending = Object.keys(updates).length;
    const written = dry ? 0 : await writeCaptions(updates);

    return NextResponse.json({
      month: monthParam,
      range: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
      slots: posts.length,
      uncaptioned,
      alreadyPinned,
      pinned: dry ? 0 : written,
      wouldPin: dry ? pending : undefined,
      // A short look at what got attached to what, so the pairing can be eyeballed
      // rather than trusted.
      sample: Object.entries(updates)
        .slice(0, 10)
        .map(([id, c]) => ({ id, topic: c.topic?.title, url: c.topic?.url })),
      failed: dry ? 0 : pending - written,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("pin-topics failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
