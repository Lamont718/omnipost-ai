import { NextRequest, NextResponse } from "next/server";
import { GATE_COOKIE, gateConfigured, keyAccepted, presentedKey } from "@/lib/gate";

/**
 * One place that decides whether a request is allowed to *change* anything.
 *
 * The rule is a whitelist, not a blacklist: every write is locked unless it is
 * named below as harmless. A route added later is therefore protected on the
 * day it is written, without anyone having to remember. The last time this app
 * enumerated the dangerous cases instead of the safe ones — the topic filter —
 * the list went stale within a week.
 *
 * Reads stay open. The calendar, the sheet and the daily email's pictures are
 * all GETs on a public URL, and locking them would put a password screen in
 * front of the one thing he actually opens each morning. What that leaves
 * exposed is the content plan, which is his own captions — worth closing one
 * day, not worth breaking the morning over today.
 */

/** Writes that cost nothing and matter if they fail. */
const OPEN_WRITES = new Set([
  // Ticking a post off. Gating this would mean the single action the whole app
  // exists to record could fail with a 401 — the exact opposite of the point.
  "/api/posted",
  // Same reasoning: telling the app a post did well is free and worth having.
  "/api/feedback",
  // The lock's own door. Obviously cannot require the key.
  "/api/unlock",
]);

/** Reads worth locking anyway: this one hands over the entire calendar as CSV. */
const LOCKED_READS = new Set(["/api/export"]);

function needsKey(method: string, pathname: string): boolean {
  if (LOCKED_READS.has(pathname)) return true;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return false;
  return !OPEN_WRITES.has(pathname);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!needsKey(request.method, pathname)) return NextResponse.next();

  if (!gateConfigured()) {
    // Deliberately not "allowed through with a warning". A deploy that lost its
    // env vars would otherwise publish and spend with no lock at all, and would
    // look completely normal while doing it.
    return NextResponse.json(
      {
        error:
          "This app has no key set, so writing is switched off. Set APP_KEY (or CRON_SECRET) in the project's environment and redeploy.",
      },
      { status: 503 },
    );
  }

  const presented = presentedKey(request, request.cookies.get(GATE_COOKIE)?.value);
  if (keyAccepted(presented)) return NextResponse.next();

  return NextResponse.json(
    {
      error: "Locked. Open /unlock on this device once and this will stop happening.",
      unlock: new URL("/unlock", request.nextUrl.origin).toString(),
    },
    { status: 401 },
  );
}

export const config = {
  // Only the API. Pages are reads and are handled above.
  matcher: ["/api/:path*"],
};
