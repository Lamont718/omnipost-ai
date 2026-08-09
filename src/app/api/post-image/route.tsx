import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { brandBySlug } from "@/lib/brands";

export const runtime = "nodejs";

/**
 * Artwork for a post that has no artwork.
 *
 * `/api/og-image` returns the share image off the topic's own page, which is the
 * best possible picture because it is the real thing a follower sees. But three
 * active brands have no website at all — WWSH, Iris & Sage and Emeka Ignites all
 * carry `sources: []` and write from evergreen angles — so there is no page and
 * there never will be a share image. Those posts were going out with nothing
 * attached, and a caption with no picture is not a post you can publish.
 *
 * So this draws one: the brand's own colour, the hook line of its caption, and
 * the brand name. Not a placeholder — a finished graphic sized for the platform,
 * which is what makes the difference between a caption and something postable.
 *
 *   GET /api/post-image?brand=wwsh&text=…&shape=square|wide
 *
 * The colour comes from brands.ts via the slug, never from the query string, so
 * a mangled URL cannot produce off-brand artwork. Text is clamped rather than
 * rejected: a too-long line should still render, just smaller.
 */

const SHAPES = {
  square: { width: 1080, height: 1080 },
  wide: { width: 1200, height: 675 },
} as const;

const MAX_TEXT = 220;

/** Bigger type for a short hook, smaller for a long one. */
function fontSizeFor(text: string, wide: boolean): number {
  const base = wide ? 58 : 72;
  if (text.length <= 60) return base;
  if (text.length <= 110) return Math.round(base * 0.82);
  if (text.length <= 160) return Math.round(base * 0.68);
  return Math.round(base * 0.56);
}

/** Readable text on the brand colour, whichever end of the range it sits at. */
function readableOn(hex: string): string {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.45 ? "#101014" : "#ffffff";
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;

  const brand = brandBySlug(params.get("brand") ?? "");
  if (!brand) {
    return new Response("unknown brand", { status: 404 });
  }

  const shape = params.get("shape") === "wide" ? "wide" : "square";
  const { width, height } = SHAPES[shape];
  const wide = shape === "wide";

  const raw = (params.get("text") ?? "").trim();
  const text = raw.length > MAX_TEXT ? `${raw.slice(0, MAX_TEXT - 1).trimEnd()}…` : raw;

  const ink = readableOn(brand.colorHex);
  const dim = ink === "#ffffff" ? "rgba(255,255,255,0.62)" : "rgba(16,16,20,0.55)";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: brand.colorHex,
          color: ink,
          padding: wide ? "64px 72px" : "84px 88px",
          fontFamily: "sans-serif",
        }}
      >
        {/* A rule rather than a logo: there is no logo file this app can reach,
            and a fake wordmark would be worse than an honest bar of colour. */}
        <div
          style={{
            display: "flex",
            width: wide ? 120 : 150,
            height: 8,
            background: ink,
            opacity: 0.85,
          }}
        />

        <div
          style={{
            display: "flex",
            fontSize: fontSizeFor(text, wide),
            lineHeight: 1.18,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            maxWidth: "100%",
          }}
        >
          {text || brand.tagline}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", fontSize: wide ? 30 : 36, fontWeight: 700 }}>
            {brand.name}
          </div>
          <div style={{ display: "flex", fontSize: wide ? 24 : 28, color: dim }}>
            {brand.tagline}
          </div>
        </div>
      </div>
    ),
    {
      width,
      height,
      headers: {
        // The same brand + text always draws the same picture, so it can cache
        // hard. This is also what makes the download button feel instant.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
