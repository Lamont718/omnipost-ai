import { NextRequest, NextResponse } from "next/server";
import { readCaptions, writeCaptions } from "@/lib/store";
import { brandBySlug } from "@/lib/brands";
import { pinnable, videosFor } from "@/lib/video-library";
import { libraryFor } from "@/lib/library";
import { PLATFORM_LIMIT } from "@/lib/compose";
import { PLATFORM_PATTERN, type Platform } from "@/lib/types";

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
 *   { "id": "<slot id>", "caption": "the new words",
 *     "videoName"?: "13-emeka-moon", "imageName"?: "basketball-2" }
 *
 * `videoName` swaps which clip a Reel carries. On a Reel the clip is the post —
 * it is what a stranger sees before a word of the caption — and until now the
 * only way to change it was to regenerate the caption and hope the rotation
 * landed somewhere else.
 *
 * `imageName` does the same for a still. The clip has been swappable since
 * Reels existed and the picture never was, which is what "change the image in
 * this post" ran into on 3 September: every surface derived the still from the
 * library by hash, so the only lever was renaming files — and that moves every
 * other post on the same subject too. A named still is stored on the record and
 * outranks every derivation, because a person who looked at the post and chose
 * the photograph is not guessing.
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
  const match = id.match(new RegExp(`:(${PLATFORM_PATTERN})$`));
  return match ? (match[1] as Platform) : null;
}

/** The brand is the first. */
function brandOf(id: string): string {
  return id.split(":")[0] ?? "";
}

export async function POST(request: NextRequest) {
  let id = "";
  let caption = "";
  let videoName = "";
  let imageName = "";
  try {
    const body = await request.json();
    id = String(body?.id ?? "").trim();
    caption = String(body?.caption ?? "");
    videoName = String(body?.videoName ?? "").trim();
    imageName = String(body?.imageName ?? "").trim();
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

    // Resolved against the brand's real library rather than trusted from the
    // body: a made-up name would otherwise be written straight onto the post and
    // the Reel would render a broken video with a caption composed for it.
    let video = existing.video;
    if (videoName) {
      const slug = brandOf(id);
      const brand = brandBySlug(slug);
      if (!brand) {
        return NextResponse.json({ error: `unknown brand: ${slug}` }, { status: 404 });
      }
      const match = (await videosFor(slug)).find((v) => v.name === videoName);
      if (!match) {
        return NextResponse.json(
          { error: `${brand.name} has no clip called "${videoName}"` },
          { status: 404 },
        );
      }
      video = pinnable(match);
    }

    // Same resolution rule as the clip, and for the same reason: a name that
    // isn't in the library must be an error here, not a broken picture later.
    let image = existing.image;
    if (imageName) {
      const slug = brandOf(id);
      const brand = brandBySlug(slug);
      if (!brand) {
        return NextResponse.json({ error: `unknown brand: ${slug}` }, { status: 404 });
      }
      const match = (await libraryFor(slug)).find((v) => v.name === imageName);
      if (!match) {
        return NextResponse.json(
          { error: `${brand.name} has no picture called "${imageName}"` },
          { status: 404 },
        );
      }
      image = { url: match.url, name: match.name };
    }

    const written = await writeCaptions({
      [id]: {
        ...existing,
        caption,
        ...(video ? { video } : {}),
        ...(image ? { image } : {}),
        editedAt: new Date().toISOString(),
      },
    });
    if (!written) {
      return NextResponse.json({ error: "could not save that" }, { status: 500 });
    }

    return NextResponse.json(
      {
        id,
        saved: true,
        length: caption.length,
        video: video?.name ?? null,
        image: image?.name ?? null,
      },
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
