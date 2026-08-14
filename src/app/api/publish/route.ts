import { NextRequest, NextResponse } from "next/server";
import { publishSlot } from "@/lib/publish";
import { readiness } from "@/lib/accounts";
import { readPublished } from "@/lib/published";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Post button.
 *
 *   GET  /api/publish            what's connected, and what has already gone out
 *   POST /api/publish  { id }    publish one scheduled post, now
 *
 * Deliberately not protected by CRON_SECRET, and deliberately not callable by
 * the cron. This app has never published anything on a timer and still doesn't:
 * a post goes out when a person presses a button on a post they are looking at.
 * A schedule that publishes by itself is a different product with a different
 * failure mode — the one where nobody notices for a week.
 *
 * The duplicate guard lives in lib/publish, not here, so it applies however the
 * route is called.
 */

export async function GET() {
  const [published] = await Promise.all([readPublished()]);
  return NextResponse.json(
    {
      brands: readiness(),
      published: Object.values(published).map((r) => ({
        id: r.id,
        publishedAt: r.publishedAt,
        permalink: r.permalink,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  let id: string;
  try {
    const body = await request.json();
    id = String(body?.id ?? "");
  } catch {
    return NextResponse.json({ error: "expected a JSON body with an id" }, { status: 400 });
  }

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    // The origin the platforms will fetch artwork from. Taken from the request
    // rather than an env var so preview deployments post their own pictures
    // instead of production's.
    const origin = new URL(request.url).origin;
    const outcome = await publishSlot(id, origin);

    // A refusal is a 409 when it's "this already went out" and a 422 when the
    // post itself can't go — both are the caller's situation to fix, neither is
    // a server fault, and the sheet shows the message either way.
    const status = outcome.published ? 200 : outcome.duplicate ? 409 : 422;
    return NextResponse.json(outcome, { status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("publish route failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "publishing failed" },
      { status: 500 },
    );
  }
}
