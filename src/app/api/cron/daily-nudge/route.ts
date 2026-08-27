import { NextResponse } from "next/server";
import { hourInZone, planForDay, renderDailyHtml, sendDaily, todayInZone } from "@/lib/daily";
import { recordSend } from "@/lib/sent-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * The 8am email: what still has to go out today.
 *
 *   Send it now:        GET /api/cron/daily-nudge?secret=$CRON_SECRET&force=1
 *   See it, send nothing: …&preview=1        (returns the HTML)
 *   A different day:      …&date=2026-08-20
 *
 * ---------------------------------------------------------------------------
 * Why the cron fires twice and usually does nothing
 *
 * Vercel crons are UTC and have no notion of a timezone, so a single fixed
 * expression drifts by an hour twice a year: `0 12 * * *` is 8am in New York in
 * summer and 7am in winter. Rather than quietly shifting under him, this is
 * scheduled at both 11:00 and 12:00 UTC and returns immediately unless it is
 * actually the 8 o'clock hour in New York. Exactly one of the two runs sends,
 * in either half of the year.
 *
 * `force=1` skips that gate, which is how it gets tested at any hour.
 *
 * The address is DIGEST_TO. Sending needs RESEND_API_KEY; without it the route
 * still builds the plan and reports what it would have sent, so everything
 * except the final hop can be verified before the key exists.
 */

const SEND_HOUR = 8;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const force = params.get("force") === "1";
  const preview = params.get("preview") === "1";
  const dateParam = params.get("date");

  if (dateParam && !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const hour = hourInZone();
  if (!force && !preview && hour !== SEND_HOUR) {
    // The other half of the twice-daily pair. Reported rather than silent, so a
    // cron that runs and does nothing can be told apart from one that didn't
    // run at all.
    return NextResponse.json({ skipped: true, reason: `hour ${hour} in New York, not ${SEND_HOUR}` });
  }

  const date = dateParam ?? todayInZone();

  try {
    const plan = await planForDay(date);

    // The origin the links and pictures resolve against, taken from the request
    // so a preview deployment links to itself rather than to production.
    const origin = process.env.PUBLIC_ORIGIN ?? new URL(request.url).origin;

    if (preview) {
      return new NextResponse(renderDailyHtml(plan, origin), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    }

    // Not yet configured is a pending state, not a failure. Returning 500 here
    // would mark the cron failed every morning until the key exists, which
    // trains you to ignore exactly the alert that should mean something.
    const to = process.env.DIGEST_TO;
    if (!to || !process.env.RESEND_API_KEY) {
      const reason = !to ? "DIGEST_TO is not set" : "RESEND_API_KEY is not set";
      // Recorded, not just returned. "The email never arrived because nobody
      // ever set the address" is the single most useful thing this log can say,
      // and it is invisible unless a morning that sent nothing leaves a mark.
      await recordSend({
        kind: "daily",
        date,
        at: new Date().toISOString(),
        sent: false,
        reason,
        due: plan.due.length,
        to: to ?? "(unset)",
      });
      return NextResponse.json({
        skipped: true,
        reason,
        wouldHaveSent: { date, due: plan.due.length, alreadyDone: plan.doneCount },
      });
    }

    const result = await sendDaily(to, plan, origin);

    // After the send, never before: a record written first would describe an
    // email that might not exist. The hour-gate skip above is deliberately not
    // logged — that one is the twice-daily no-op working as designed, and
    // logging it would bury the mornings that matter.
    await recordSend({
      kind: "daily",
      date,
      at: new Date().toISOString(),
      sent: result.sent,
      reason: result.sent ? undefined : result.reason,
      due: plan.due.length,
      to,
    });

    return NextResponse.json(
      {
        date,
        due: plan.due.length,
        alreadyDone: plan.doneCount,
        unwritten: plan.unwrittenCount,
        brands: Array.from(new Set(plan.due.map((p) => p.brand.name))),
        ...result,
      },
      { status: result.sent ? 200 : 500, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("daily-nudge failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
