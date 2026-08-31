import { NextRequest, NextResponse } from "next/server";
import { brandBySlug, BRANDS } from "@/lib/brands";
import { composePost } from "@/lib/compose";
import { PLATFORMS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";



/**
 * Draft a single post on demand.
 *
 * Takes a brand slug (see lib/brands.ts) rather than the old `org_id` UUID, and
 * no longer writes to Supabase — voices live in code now and the weekly digest
 * is how drafts reach you. Restoring a database is not a prerequisite for this
 * endpoint to work.
 *
 *   POST /api/generate
 *   { "brand": "yodm", "topic": "...", "platform": "x", "tone_override": "..." }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { brand: slug, topic, platform, tone_override } = body ?? {};

    if (!slug || !topic || !platform) {
      return NextResponse.json(
        {
          error: "Missing required fields: brand, topic, platform",
          brands: BRANDS.map((b) => b.slug),
        },
        { status: 400 },
      );
    }

    if (!(PLATFORMS as readonly string[]).includes(platform)) {
      return NextResponse.json(
        { error: `platform must be one of: ${PLATFORMS.join(", ")}` },
        { status: 400 },
      );
    }

    const brand = brandBySlug(slug);
    if (!brand) {
      return NextResponse.json(
        { error: `Unknown brand: ${slug}`, brands: BRANDS.map((b) => b.slug) },
        { status: 404 },
      );
    }

    const post = await composePost({
      brand,
      // `context` is optional verified copy; without it the model is barred
      // from inventing specifics. See the grounding rule in lib/compose.ts.
      topic: { title: topic, context: body.context },
      platform,
      toneOverride: tone_override,
    });

    return NextResponse.json(post);
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 },
    );
  }
}
