import { NextRequest, NextResponse } from "next/server";
import { brandBySlug } from "@/lib/brands";
import { composePost } from "@/lib/compose";
import { writeCaptions } from "@/lib/store";
import { loadExampleBank, pickExamples } from "@/lib/examples";
import { Platform } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PLATFORMS: Platform[] = ["instagram", "facebook", "linkedin", "x"];

/**
 * Write (or rewrite) the caption for one calendar slot, on demand.
 *
 * The Monday run fills the whole week ahead; this is the "write this one now"
 * button for any slot that isn't filled yet, or a reroll of one you don't like.
 * It persists to the same store the calendar reads, so the caption sticks.
 *
 *   POST /api/slot
 *   { "id": "...", "brand": "yodm", "platform": "x",
 *     "topic": { "title": "...", "context"?, "url"?, "source"? },
 *     "tone_override"?: "..." }
 *
 * The whole topic is stored with the caption, url included, so the calendar can
 * keep showing this exact subject however discovery shifts afterwards. That is
 * why the caller should send back the full topic object it was given and not
 * just the title.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, brand: slug, platform, topic, tone_override } = body ?? {};

    if (!id || !slug || !platform || !topic?.title) {
      return NextResponse.json(
        { error: "Missing required fields: id, brand, platform, topic.title" },
        { status: 400 },
      );
    }
    if (!PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: "invalid platform" }, { status: 400 });
    }

    const brand = brandBySlug(slug);
    if (!brand) {
      return NextResponse.json({ error: `Unknown brand: ${slug}` }, { status: 404 });
    }

    const post = await composePost({
      brand,
      topic: { title: topic.title, context: topic.context },
      platform,
      toneOverride: tone_override,
      examples: pickExamples(await loadExampleBank(), slug, platform),
    });

    // Timestamps can't come from the runtime clock inside some contexts, but a
    // plain new Date() is fine in a request handler.
    const stored = await writeCaptions({
      [id]: {
        ...post,
        generatedAt: new Date().toISOString(),
        topic: {
          title: topic.title,
          context: topic.context,
          url: topic.url,
          // Older callers don't send it; a topic with a page behind it is a
          // site topic by definition, and one without is evergreen.
          source: topic.source === "evergreen" || !topic.url ? "evergreen" : "site",
        },
      },
    });

    return NextResponse.json({ ...post, persisted: stored > 0 });
  } catch (error) {
    console.error("slot route failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
