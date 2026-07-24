import { NextResponse } from "next/server";
import { buildDigest, sendDigest, renderDigestHtml, totalPosts } from "@/lib/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Where the digest goes. Override with REPORT_EMAIL without touching code. */
const OWNER_EMAIL = process.env.REPORT_EMAIL ?? "lamont@communitynyc.org";

/**
 * The Monday morning digest — every active brand's posts for the week, written
 * and ready to paste. Topics come from each brand's own sitemap (see
 * lib/sources.ts), so nothing needs typing in.
 *
 * Cron is `0 12 * * 1` UTC = 8am Monday in New York on Eastern Daylight Time.
 * Vercel crons have no timezone, so from November (EST) it lands at 7am.
 *
 * Triggered by Vercel Cron (see vercel.json), which sends
 * `Authorization: Bearer $CRON_SECRET`. Also callable by hand:
 *
 *   Send it now:          GET /api/cron/weekly-digest?secret=$CRON_SECRET
 *   Read the drafts
 *   without sending:      …&preview=1
 *   See the actual email: …&preview=html
 *   One brand only:       …&brand=yodm
 *   Send somewhere else:  …&to=someone@example.com
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET is not set" },
      { status: 500 },
    );
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const preview = params.get("preview");
  const brand = params.get("brand") ?? undefined;
  const to = params.get("to") ?? OWNER_EMAIL;

  try {
    const digest = await buildDigest(new Date(), brand);

    if (preview === "html") {
      return new NextResponse(renderDigestHtml(digest), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (preview) {
      return NextResponse.json({
        sent: false,
        week: digest.week,
        posts: totalPosts(digest),
        brands: digest.brands.map((b) => ({
          brand: b.brand.name,
          error: b.error,
          posts: b.posts.map((p) => ({
            platform: p.platform,
            source: p.topic.source,
            url: p.topic.url,
            caption: p.post.caption,
          })),
        })),
      });
    }

    await sendDigest(to, digest);

    return NextResponse.json({
      sent: true,
      to,
      week: digest.week,
      posts: totalPosts(digest),
      failed: digest.brands.filter((b) => b.error).map((b) => b.brand.name),
    });
  } catch (error) {
    console.error("weekly-digest failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Digest failed" },
      { status: 500 },
    );
  }
}
