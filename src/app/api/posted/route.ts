import { NextRequest, NextResponse } from "next/server";
import { markPosted, readPosted, unmarkPosted } from "@/lib/posted";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The manual "posted" ticks, shared across every device.
 *
 *   GET  /api/posted                      → every tick
 *   POST /api/posted {id, posted:boolean} → tick or un-tick one
 *   POST /api/posted {marks:{id:when}}    → adopt a browser's existing ticks
 *
 * No auth, matching the rest of the calendar surface: the old Supabase login is
 * dead and this stores nothing sensitive — a list of slot ids someone has
 * already published to their own public accounts. Adding a login here would
 * only stop him ticking things off from his phone, which is the entire point.
 *
 * `stored: false` in the response means the write went nowhere because there's
 * no blob token. The client shows that rather than pretending it synced.
 */

export async function GET() {
  const posted = await readPosted();
  return NextResponse.json(
    {
      posted: Object.values(posted),
      stored: !!process.env.BLOB_READ_WRITE_TOKEN,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  let body: { id?: unknown; posted?: unknown; marks?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  // Bulk adopt: the one-time hand-over of ticks a browser accumulated while
  // this was localStorage-only. Only ever adds — a tick that exists here but
  // not in the browser is a tick from another device, and dropping those is the
  // exact bug this route was built to fix.
  if (body.marks && typeof body.marks === "object") {
    const marks = body.marks as Record<string, unknown>;
    const ids = Object.keys(marks).slice(0, 2000);
    const existing = await readPosted();
    const missing = ids.filter((id) => !existing[id]);

    const results = await Promise.all(
      missing.map((id) => {
        const when = typeof marks[id] === "string" ? (marks[id] as string) : undefined;
        const valid = when && !Number.isNaN(Date.parse(when)) ? when : undefined;
        return markPosted(id, valid);
      }),
    );
    const adopted = results.filter(Boolean).length;

    return NextResponse.json({
      adopted,
      alreadyKnown: ids.length - missing.length,
      stored: !!process.env.BLOB_READ_WRITE_TOKEN,
    });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const wantsPosted = body.posted !== false;
  const stored = wantsPosted ? await markPosted(id) : await unmarkPosted(id);

  return NextResponse.json({
    id,
    posted: wantsPosted,
    stored,
  });
}
