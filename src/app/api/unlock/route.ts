import { NextRequest, NextResponse } from "next/server";
import { GATE_COOKIE, gateConfigured, keyAccepted } from "@/lib/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unlocking a device, once.
 *
 *   GET  /api/unlock?key=…&next=/sheet   follow it from the morning email
 *   POST /api/unlock  { key }            type it into the page
 *
 * Both do the same thing: check the key, then leave a cookie that lasts a year.
 * A year because the alternative is him meeting a password on the morning he
 * finally has thirty seconds to post something, and that is the morning the
 * habit dies.
 *
 * The cookie is httpOnly, so nothing running on the page can read the key back
 * out of it — including anything that ends up in the client bundle by accident,
 * which has happened in this account before.
 */

const YEAR = 60 * 60 * 24 * 365;

function setCookie(response: NextResponse, key: string): NextResponse {
  response.cookies.set(GATE_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: YEAR,
  });
  return response;
}

/** Only ever somewhere inside this app — never an absolute URL from a stranger. */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/sheet";
  return raw;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const key = params.get("key") ?? params.get("secret");
  const next = safeNext(params.get("next"));

  if (!gateConfigured()) {
    return NextResponse.json({ error: "No key is set on this deployment." }, { status: 503 });
  }
  if (!keyAccepted(key)) {
    // Back to the page rather than a bare 401, because the person following a
    // stale link is almost always him, on a phone, with no way to retype it.
    return NextResponse.redirect(new URL("/unlock?bad=1", request.nextUrl.origin));
  }

  return setCookie(NextResponse.redirect(new URL(next, request.nextUrl.origin)), key!);
}

export async function POST(request: NextRequest) {
  let key = "";
  try {
    const body = await request.json();
    key = String(body?.key ?? "");
  } catch {
    return NextResponse.json({ error: "expected a JSON body with a key" }, { status: 400 });
  }

  if (!gateConfigured()) {
    return NextResponse.json({ error: "No key is set on this deployment." }, { status: 503 });
  }
  if (!keyAccepted(key)) {
    return NextResponse.json({ error: "That key doesn't match." }, { status: 401 });
  }

  return setCookie(NextResponse.json({ unlocked: true }), key);
}
