import { NextRequest, NextResponse } from "next/server";
import { BRANDS } from "@/lib/brands";

export const runtime = "nodejs";

/**
 * The artwork for a post.
 *
 * Every topic is a real page on one of Lamont's sites, and those pages already
 * carry a share image — MostHatedNBA renders a portrait per villain, the others
 * render an OG card. That image is exactly what a follower sees when the link
 * is shared, so it is the honest thing to preview, and it costs nothing to
 * generate because it already exists.
 *
 *   GET /api/og-image?url=https://…  ->  { image: string | null }
 *
 * Only hostnames that appear in brands.ts are fetchable — this route takes a
 * URL from the client, so without that check it would happily fetch anything
 * on the internal network.
 */

const FETCH_TIMEOUT_MS = 8_000;
/** Share images change rarely; a day of caching keeps the calendar quick. */
const CACHE_SECONDS = 86_400;

/** Hostnames of every brand's topic sources, plus their www/bare variants. */
function allowedHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const brand of BRANDS) {
    for (const source of brand.sources) {
      try {
        const host = new URL(source.sitemap).hostname.toLowerCase();
        hosts.add(host);
        hosts.add(host.replace(/^www\./, ""));
        if (!host.startsWith("www.")) hosts.add(`www.${host}`);
      } catch {
        // A malformed sitemap URL just means that brand contributes no host.
      }
    }
  }
  return hosts;
}

function extractImage(html: string, pageUrl: string): string | null {
  // og:image first, then twitter:image. Attribute order varies between the two
  // conventions (property=… content=… and content=… property=…), so try both.
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) {
      try {
        // Sites publish these both absolute and root-relative.
        return new URL(m[1], pageUrl).toString();
      } catch {
        return null;
      }
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "url is not a URL" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return NextResponse.json({ error: "unsupported protocol" }, { status: 400 });
  }
  if (!allowedHosts().has(parsed.hostname.toLowerCase())) {
    return NextResponse.json(
      { error: `${parsed.hostname} is not one of the brand sites` },
      { status: 403 },
    );
  }

  try {
    const res = await fetch(parsed.toString(), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "OmniPost/1.0 (+https://omnipost-ai-phi.vercel.app)" },
      next: { revalidate: CACHE_SECONDS },
    });
    if (!res.ok) {
      return NextResponse.json({ image: null }, { status: 200 });
    }
    const image = extractImage(await res.text(), parsed.toString());
    return NextResponse.json(
      { image },
      { headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` } },
    );
  } catch (error) {
    console.error("og-image failed:", parsed.hostname, error);
    return NextResponse.json({ image: null }, { status: 200 });
  }
}
