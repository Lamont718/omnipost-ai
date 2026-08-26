import { NextRequest, NextResponse } from "next/server";
import { readCaptions, writeCaptions } from "@/lib/store";
import { PLATFORM_LIMIT } from "@/lib/compose";
import type { Platform } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Change the words of one post, without rewriting it.
 *
 * Until now the only way to alter a caption was `POST /api/slot`, which throws
 * the caption away and generates a new one — it costs money, and it loses the
 * version you were happy with in order to fix the one word you weren't. So the
 * one-word fix has been happening outside the app: on 24 August a caption was
 * hand-edited into a folder on the desktop, and the copy that went out by email
 * was the unedited one. Two versions of the same post, and the app knew about
 * neither edit.
 *
 *   POST /api/caption
 *   { "id": "<slot id>", "caption": "the new words" }
 *
 * Everything else about the record is preserved — the topic it was written
 * from, the clip it was written against, when it was generated. Those are what
 * keep the caption paired with its subject and its picture, and an edit to the
 * wording is not a reason to lose them.
 *
 * Behind the app key, like every other write.
 */

const MAX_CAPTION = 8000;

/** The platform is the last segment of a slot id: brand:date:HH:MM:platform. */
function platformOf(id: string): Platform | null {
  const match = id.match(/:(instagram|facebook|linkedin|x)$/);
  return match ? (match[1] as Platform) : null;
}

export async function POST(request: NextRequest) {
  let id = "";
  let caption = "";
  try {
    const body = await request.json();
    id = String(body?.id ?? "").trim();
    caption = String(body?.caption ?? "");
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  if (!id || !caption.trim()) {
    return NextResponse.json({ error: "id and caption are both required" }, { status: 400 });
  }
  if (caption.length > MAX_CAPTION) {
    return NextResponse.json({ error: "that caption is implausibly long" }, { status: 400 });
  }

  // Refuse to write a post that the platform will reject. The sheet shows the
  // character count for exactly this reason, and letting an over-length caption
  // be saved would move the failure to the moment of posting.
  const platform = platformOf(id);
  const limit = platform ? PLATFORM_LIMIT[platform as keyof typeof PLATFORM_LIMIT] : undefined;
  if (limit && caption.length > limit) {
    return NextResponse.json(
      { error: `that is ${caption.length - limit} characters over the ${limit} limit for ${platform}` },
      { status: 422 },
    );
  }

  try {
    const existing = (await readCaptions())[id];
    if (!existing) {
      // Not a 404 by accident: writing a caption for a slot that was never
      // generated would create a record with no topic and no clip, and the
      // calendar would then show a post about nothing.
      return NextResponse.json(
        { error: "no caption has been written for that slot yet — generate it first" },
        { status: 404 },
      );
    }

    const written = await writeCaptions({
      [id]: { ...existing, caption, editedAt: new Date().toISOString() },
    });
    if (!written) {
      return NextResponse.json({ error: "could not save that" }, { status: 500 });
    }

    return NextResponse.json(
      { id, saved: true, length: caption.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("caption edit failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}
