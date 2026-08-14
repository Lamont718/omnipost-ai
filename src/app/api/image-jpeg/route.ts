import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { isAllowedImageHost } from "@/lib/brand-hosts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A post's artwork, re-encoded as a JPEG that Instagram will accept.
 *
 *   GET /api/image-jpeg?url=https://…[&fit=square]
 *
 * Two problems this exists to solve, both of which only show up at the moment
 * of publishing and both of which fail with unhelpful errors:
 *
 *  1. **Instagram accepts JPEG only.** `next/og` renders PNG, so every one of
 *     the generated branded cards — the artwork floor for posts with no real
 *     picture — would be rejected. The brand sites serve a mix of PNG and JPEG
 *     too. Normalising everything here means the publish path never has to care
 *     what the source format was.
 *
 *  2. **Instagram rejects extreme aspect ratios**, roughly outside 4:5 to
 *     1.91:1. A tall portrait or a wide banner from a brand page is refused
 *     with a message about the image being invalid, which sounds like a
 *     corruption problem and is not.
 *
 * `fit=square` handles the second by fitting the picture inside a 1080 square
 * and letterboxing the remainder. It fits, it never crops — the same rule the
 * previews and the sheet already follow, and for the same reason: a square crop
 * cut a YODM card through the middle of its question. A letterboxed card is
 * still readable; a cropped one is not a card any more. The letterbox is the
 * same neutral grey used everywhere else, so it never reads as brand colour.
 */

const FETCH_TIMEOUT_MS = 20_000;
const MAX_BYTES = 12 * 1024 * 1024;
const SQUARE = 1080;
/** Matches the letterbox in PostPreview and the sheet. */
const LETTERBOX = { r: 241, g: 245, b: 249 };
const JPEG_QUALITY = 88;

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get("url");
  const square = requestUrl.searchParams.get("fit") === "square";

  if (!target) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let resolved: URL;
  try {
    resolved = new URL(target, requestUrl.origin);
  } catch {
    return NextResponse.json({ error: "url is not a URL" }, { status: 400 });
  }

  // Same guard as /api/download: a route that fetches a caller-supplied URL is
  // an SSRF unless something narrows it to hosts we meant.
  if (resolved.origin === requestUrl.origin) {
    if (!resolved.pathname.startsWith("/api/post-image")) {
      return NextResponse.json(
        { error: "only generated post images may be fetched locally" },
        { status: 403 },
      );
    }
  } else if (resolved.protocol !== "https:" && resolved.protocol !== "http:") {
    return NextResponse.json({ error: "unsupported protocol" }, { status: 400 });
  } else if (!isAllowedImageHost(resolved.hostname)) {
    return NextResponse.json(
      { error: `${resolved.hostname} is not a brand site or image host` },
      { status: 403 },
    );
  }

  let upstream: Response;
  try {
    upstream = await fetch(resolved.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "OmniPost/1.0 (+https://omnipost-ai-phi.vercel.app)" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "fetch failed" },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json({ error: `source returned ${upstream.status}` }, { status: 502 });
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "image is too large" }, { status: 413 });
  }

  try {
    // `flatten` matters: a PNG with transparency becomes black, not white,
    // when it is converted to JPEG without a background to composite onto.
    let pipeline = sharp(buffer).flatten({ background: LETTERBOX });

    if (square) {
      pipeline = pipeline.resize(SQUARE, SQUARE, {
        fit: "contain",
        background: LETTERBOX,
        withoutEnlargement: false,
      });
    }

    const jpeg = await pipeline.jpeg({ quality: JPEG_QUALITY, progressive: true }).toBuffer();

    return new NextResponse(jpeg as unknown as BodyInit, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(jpeg.byteLength),
        // Meta and X fetch this URL themselves, sometimes more than once for a
        // single post. An hour of caching saves the re-encode without ever
        // being long enough to serve a stale picture for a rewritten post.
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "could not convert the image" },
      { status: 500 },
    );
  }
}
