import { NextRequest, NextResponse } from "next/server";
import { clearFeedback, readFeedback, setFeedback, Verdict } from "@/lib/feedback";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Whether a post that went out actually did anything.
 *
 *   GET  /api/feedback                          → every judgement
 *   POST /api/feedback {id, brandSlug, verdict} → "good" | "flat"
 *   POST /api/feedback {id, verdict: null}      → un-judge
 *
 * Unauthenticated for the same reason /api/posted is: this is the surface he
 * uses from his phone, the old login is dead, and the stored data is a list of
 * slot ids with a thumbs up or down.
 */

const VERDICTS: Verdict[] = ["good", "flat"];

export async function GET() {
  const feedback = await readFeedback();
  return NextResponse.json(
    {
      feedback: Object.values(feedback),
      stored: !!process.env.BLOB_READ_WRITE_TOKEN,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  let body: { id?: unknown; brandSlug?: unknown; verdict?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  // An explicit null clears it — pressing the same thumb twice should undo,
  // not leave a judgement he can't take back.
  if (body.verdict === null) {
    const stored = await clearFeedback(id);
    return NextResponse.json({ id, verdict: null, stored });
  }

  const verdict = body.verdict as Verdict;
  if (!VERDICTS.includes(verdict)) {
    return NextResponse.json(
      { error: `verdict must be one of ${VERDICTS.join(", ")}, or null to clear` },
      { status: 400 },
    );
  }

  // The brand is in the slot id, but taking it from the caller keeps the id
  // format from becoming load-bearing in a second place.
  const brandSlug =
    typeof body.brandSlug === "string" && body.brandSlug ? body.brandSlug : id.split(":")[0];

  const stored = await setFeedback({
    id,
    brandSlug,
    verdict,
    at: new Date().toISOString(),
  });

  return NextResponse.json({ id, verdict, brandSlug, stored });
}
