import { NextResponse } from "next/server";
import { missedPosts } from "@/lib/backlog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Everything written that never went out.
 *
 *   GET /api/backlog
 *
 * A read, so it stays open like the rest of the calendar surface. It is its own
 * route rather than a flag on /api/schedule because the answer spans every
 * month at once, and the schedule route is deliberately one month wide.
 */
export async function GET() {
  try {
    const missed = await missedPosts();
    return NextResponse.json(
      { count: missed.length, posts: missed },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
