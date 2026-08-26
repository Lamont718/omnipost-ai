import { NextRequest, NextResponse } from "next/server";
import { authorizationHeader } from "@/lib/publish/oauth1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Does this credential work, and whose account is it?
 *
 * The point of this route is the second half of that question. A token that
 * authenticates is not the same as a token for the right account, and the way
 * this app has failed before is precisely there: it showed six Instagram
 * handles that belonged to strangers because a fallback made one up. So this
 * never answers "valid" — it answers with the **username the platform says the
 * credential belongs to**, and lets him read it.
 *
 * Nothing is stored. Not in Blob, not in a cookie, not in a log line. The
 * credential arrives, is used once against the platform, and is dropped when
 * the request ends. Turning it into a live account is a separate, deliberate
 * step: setting it as an environment variable and redeploying.
 *
 *   POST /api/connect/verify
 *   { platform: "instagram", igUserId, token }
 *   { platform: "facebook",  pageId,  pageToken }
 *   { platform: "x",         apiKey, apiSecret, accessToken, accessSecret }
 *
 * Behind the app key like every other write — it isn't a write, but it will
 * happily make outbound calls on someone else's behalf if left open, and one of
 * them costs money.
 */

const TIMEOUT_MS = 15_000;

interface Verdict {
  ok: boolean;
  username?: string;
  /** Which of Instagram's two publishing routes this credential is on. */
  route?: "page" | "direct";
  error?: string;
  /** Anything true and useful that isn't pass/fail — e.g. when a token expires. */
  note?: string;
}

function fail(error: string): NextResponse {
  // 200, not 4xx. A credential that doesn't work is a normal answer to this
  // question, and the page renders it as an answer rather than as a crash.
  return NextResponse.json({ ok: false, error } as Verdict, {
    headers: { "Cache-Control": "no-store" },
  });
}

async function verifyInstagram(igUserId: string, token: string): Promise<Verdict> {
  // Try the Instagram-Login host first: it is the route that matches accounts
  // with no Facebook Page, which is every account he has. Falling back to the
  // Page host means a pasted Page token still identifies itself correctly
  // rather than being reported as broken.
  const hosts: Array<{ host: string; route: "direct" | "page" }> = [
    { host: "https://graph.instagram.com", route: "direct" },
    { host: "https://graph.facebook.com", route: "page" },
  ];

  let lastError = "no response";
  for (const { host, route } of hosts) {
    try {
      const url = new URL(`${host}/${igUserId}`);
      url.searchParams.set("fields", "username");
      url.searchParams.set("access_token", token);

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) });
      const body = (await res.json().catch(() => ({}))) as {
        username?: string;
        error?: { message?: string };
      };

      if (res.ok && body.username) {
        return {
          ok: true,
          username: body.username,
          route,
          note:
            route === "direct"
              ? "Instagram Login tokens last 60 days. This app will say so before it lapses."
              : "Page tokens don't expire while the Page permission stands.",
        };
      }
      lastError = body.error?.message ?? `HTTP ${res.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "request failed";
    }
  }
  return { ok: false, error: lastError };
}

async function verifyFacebook(pageId: string, pageToken: string): Promise<Verdict> {
  try {
    const url = new URL(`https://graph.facebook.com/${pageId}`);
    url.searchParams.set("fields", "name");
    url.searchParams.set("access_token", pageToken);

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    const body = (await res.json().catch(() => ({}))) as {
      name?: string;
      error?: { message?: string };
    };
    if (res.ok && body.name) return { ok: true, username: body.name, route: "page" };
    return { ok: false, error: body.error?.message ?? `HTTP ${res.status}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "request failed" };
  }
}

async function verifyX(
  apiKey: string,
  apiSecret: string,
  accessToken: string,
  accessSecret: string,
): Promise<Verdict> {
  const url = "https://api.twitter.com/2/users/me";
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: authorizationHeader("GET", url, {
          consumerKey: apiKey,
          consumerSecret: apiSecret,
          accessToken,
          accessSecret,
        }),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const raw = await res.text();
    if (!res.ok) {
      let detail = raw.slice(0, 200);
      try {
        const parsed = JSON.parse(raw) as { detail?: string; title?: string };
        detail = parsed.detail ?? parsed.title ?? detail;
      } catch {
        // Non-JSON body; the truncated text is the message.
      }
      return { ok: false, error: `X returned ${res.status}: ${detail}` };
    }

    const body = JSON.parse(raw) as { data?: { username?: string } };
    return body.data?.username
      ? { ok: true, username: `@${body.data.username}` }
      : { ok: false, error: "X answered without a username" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "request failed" };
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, string>;
  try {
    body = (await request.json()) as Record<string, string>;
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const trim = (name: string) => String(body?.[name] ?? "").trim();
  const platform = trim("platform");

  let verdict: Verdict;
  if (platform === "instagram") {
    const igUserId = trim("igUserId");
    const token = trim("token");
    if (!igUserId || !token) return fail("Both the Instagram account id and the token are needed.");
    verdict = await verifyInstagram(igUserId, token);
  } else if (platform === "facebook") {
    const pageId = trim("pageId");
    const pageToken = trim("pageToken");
    if (!pageId || !pageToken) return fail("Both the Page id and the Page token are needed.");
    verdict = await verifyFacebook(pageId, pageToken);
  } else if (platform === "x") {
    const apiKey = trim("apiKey");
    const apiSecret = trim("apiSecret");
    const accessToken = trim("accessToken");
    const accessSecret = trim("accessSecret");
    if (!apiKey || !apiSecret || !accessToken || !accessSecret) {
      return fail("All four X keys are needed: API key and secret, access token and secret.");
    }
    verdict = await verifyX(apiKey, apiSecret, accessToken, accessSecret);
  } else {
    return NextResponse.json(
      { error: 'platform must be "instagram", "facebook" or "x"' },
      { status: 400 },
    );
  }

  return NextResponse.json(verdict, { headers: { "Cache-Control": "no-store" } });
}
