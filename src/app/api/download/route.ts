import { NextRequest, NextResponse } from "next/server";
import { isAllowedHost } from "@/lib/brand-hosts";

export const runtime = "nodejs";

/**
 * Hand back a post's artwork as a file the browser saves.
 *
 * A plain `<a download>` does not work here. The share images live on the brand
 * sites, so they are cross-origin, and browsers ignore the download attribute on
 * a cross-origin link — the picture opens in a new tab instead, and saving it
 * becomes a right-click and a guess at a filename. Streaming it back through
 * this app makes it same-origin, so `Content-Disposition` is honoured and the
 * file lands in Downloads with a name that says what it is.
 *
 *   GET /api/download?url=https://…&name=wwsh-2026-08-12
 *
 * Only brand hostnames are fetchable, and the generated-card route is allowed as
 * a same-origin relative path. Everything else is refused.
 */

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 12 * 1024 * 1024;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/** Keep a caller-supplied filename to something safe to write to disk. */
function safeName(raw: string | null): string {
  const cleaned = (raw ?? "post").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 80) || "post";
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const target = requestUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let resolved: URL;
  try {
    // Relative targets are our own generated cards; absolute ones are brand sites.
    resolved = new URL(target, requestUrl.origin);
  } catch {
    return NextResponse.json({ error: "url is not a URL" }, { status: 400 });
  }

  const sameOrigin = resolved.origin === requestUrl.origin;
  if (sameOrigin) {
    if (!resolved.pathname.startsWith("/api/post-image")) {
      return NextResponse.json({ error: "only generated post images may be fetched locally" }, { status: 403 });
    }
  } else {
    if (resolved.protocol !== "https:" && resolved.protocol !== "http:") {
      return NextResponse.json({ error: "unsupported protocol" }, { status: 400 });
    }
    if (!isAllowedHost(resolved.hostname)) {
      return NextResponse.json(
        { error: `${resolved.hostname} is not one of the brand sites` },
        { status: 403 },
      );
    }
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

  const contentType = (upstream.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: `not an image (${contentType || "unknown"})` }, { status: 415 });
  }

  const declared = Number(upstream.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) {
    return NextResponse.json({ error: "image is too large" }, { status: 413 });
  }

  const bytes = new Uint8Array(await upstream.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "image is too large" }, { status: 413 });
  }

  const filename = `${safeName(requestUrl.searchParams.get("name"))}.${EXT[contentType] ?? "png"}`;

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
