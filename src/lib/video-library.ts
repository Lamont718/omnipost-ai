import { brandBySlug } from "./brands";
import type { Platform } from "./types";

/**
 * A brand's video clips, and which one a given post carries.
 *
 * Instagram reaches people who don't follow an account almost entirely through
 * Reels. A still image is shown to followers; a video is shown to strangers.
 * That distinction is the whole reason this file exists — Emeka Explores has
 * fifteen finished 1080x1920 clips that had never been posted once, while every
 * scheduled post went out as a picture.
 *
 * Layout mirrors the image library, one level down: clips live in Blob under
 * `library/<brand-slug>/video/`, and a poster frame sits beside each one with
 * the same name and a .jpg extension. The poster matters more than it looks —
 * a <video> with no poster renders as a blank box until it decodes, which is
 * exactly the "it looks like nothing is on it" bug the Emeka site home page
 * had. Every surface here shows the poster and plays the clip on demand.
 *
 * What a clip SHOWS cannot be read off a Blob listing, so it is declared in
 * brands.ts instead (`Brand.videoClips`). Two things depend on it: pairing a
 * clip with a topic it suits, and telling the caption writer what is on screen
 * so it doesn't describe something that isn't. A clip with no declaration still
 * works — it just gets no tags and the writer is told nothing about it, which
 * is the safe default rather than a guess.
 */

/**
 * Where a clip is used at all.
 *
 * Instagram only, for now, and deliberately in one place so the caption writer,
 * the calendar and the publisher cannot disagree about it. Video posts fine on
 * X; what does not exist yet is an X preview that plays one, and a surface that
 * shows a still where the sheet shows a clip is exactly the three-way drift this
 * app has fixed twice already.
 */
export function platformPlaysVideo(platform?: Platform): boolean {
  return !platform || platform === "instagram";
}

const PREFIX = "library/";
const VIDEO_DIR = "video/";
const VIDEO_EXT = /\.(mp4|mov|m4v|webm)$/i;

/** Declared in brands.ts: what a clip shows, and the topics it suits. */
export interface VideoClipMeta {
  /** Filename without extension, matching the blob under `video/`. */
  name: string;
  /**
   * What is actually on screen, in a sentence. Passed to the caption writer as
   * verified fact — so it must describe the clip, not sell it.
   */
  describes: string;
  /**
   * Topic words this clip suits, matched against the topic's URL. Keep them at
   * four characters or more: a two-letter tag matches half the sitemap.
   */
  tags?: string[];
}

export interface LibraryVideo {
  /** Public, direct URL of the clip itself. */
  url: string;
  /** The still frame shown before it plays. Null if none was uploaded. */
  poster: string | null;
  /** Filename without extension. */
  name: string;
  /** From brands.ts, when the clip is declared there. */
  describes?: string;
  tags?: string[];
}

function hasBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function baseName(pathname: string): string {
  return pathname.split("?")[0].split("/").pop()?.replace(/\.[a-z0-9]+$/i, "") ?? "";
}

/**
 * Every clip a brand has, each paired with its poster frame.
 *
 * Ordered by name so the rotation below is stable across reloads and across
 * machines — the clip in the preview has to be the clip that posts.
 */
export async function videosFor(brandSlug: string): Promise<LibraryVideo[]> {
  if (!hasBlob()) return [];

  let clips: LibraryVideo[] = [];
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: `${PREFIX}${brandSlug}/${VIDEO_DIR}` });

    // Posters are addressed by name, not by position — a listing that returns
    // them in another order must still pair them correctly.
    const posters = new Map(
      blobs
        .filter((b) => /\.(jpe?g|png|webp)$/i.test(b.pathname))
        .map((b) => [baseName(b.pathname), b.url] as const),
    );

    const declared = new Map(
      (brandBySlug(brandSlug)?.videoClips ?? []).map((c) => [c.name, c] as const),
    );

    clips = blobs
      .filter((b) => VIDEO_EXT.test(b.pathname))
      .map((b) => {
        const name = baseName(b.pathname);
        const meta = declared.get(name);
        return {
          url: b.url,
          poster: posters.get(name) ?? null,
          name,
          describes: meta?.describes,
          tags: meta?.tags,
        };
      })
      .filter((v) => !!v.name);
  } catch (err) {
    console.error("videosFor failed:", brandSlug, err);
    return [];
  }

  return clips.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Where a slot sits in the rotation: which number post this is for its brand,
 * counting from a fixed week.
 *
 * Deliberately not the hash used for images, and not a count of days either.
 * Both leave the rotation lumpy — the first draft counted days, and across
 * thirty-one Emeka slots it used one clip five times and three clips never,
 * because a Mon/Wed/Fri schedule steps by 12, then -8, then 3, and none of
 * that is coprime with anything useful. Counting POSTS steps by exactly one,
 * so a library of fifteen cycles cleanly through all fifteen.
 *
 * The brand's own schedule is what turns a date back into a post number, and
 * the slot id carries the brand slug in front of the date — the same parse
 * lib/publish does. A slot that doesn't match the schedule (one that has been
 * moved, an id from an older shape) falls back to a hash rather than to
 * nothing.
 */
function rotationIndex(slotId: string): number {
  const match = slotId.match(/^([a-z0-9-]+):(\d{4})-(\d{2})-(\d{2}):(\d{2}):(\d{2}):([a-z]+)$/);
  if (match) {
    const [, slug, y, m, d, hh, mm, platform] = match;
    const week = brandBySlug(slug)?.schedule ?? [];
    if (week.length > 0) {
      const utc = Date.UTC(Number(y), Number(m) - 1, Number(d));
      const ordered = [...week].sort(
        (a, b) => a.day - b.day || a.time.localeCompare(b.time),
      );
      const position = ordered.findIndex(
        (slot) =>
          slot.day === new Date(utc).getUTCDay() &&
          slot.time === `${hh}:${mm}` &&
          slot.platform === platform,
      );
      if (position >= 0) {
        // +4 puts the week boundary on a Sunday, which is where the schedule
        // already puts it (Weekday 0 is Sunday). Without the shift the buckets
        // run Thursday to Wednesday, and a Mon/Wed/Fri brand steps -2, 1, 4
        // instead of 1, 1, 1 — it still spreads, but only by luck.
        const weeks = Math.floor((utc / 86_400_000 + 4) / 7);
        return weeks * ordered.length + position;
      }
    }
  }

  let hash = 0;
  for (let i = 0; i < slotId.length; i++) hash = (hash * 31 + slotId.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function flatten(hint: string): string {
  return hint.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Which clip a given post carries.
 *
 * A tag match comes first, so a post about Mae Jemison gets the clip of Emeka
 * at a spacecraft window rather than whatever the rotation happened to land on.
 * When several clips share the matching tag the rotation picks between them, so
 * three school posts in a month don't all open on the same face.
 */
export function pickVideoForSlot(
  videos: LibraryVideo[],
  slotId: string,
  /** The topic's URL, or its title when there is no page. */
  hint?: string,
): LibraryVideo | null {
  if (videos.length === 0) return null;

  const index = rotationIndex(slotId);

  if (hint) {
    const flat = flatten(hint);
    const tagged = videos.filter((v) =>
      (v.tags ?? []).some((t) => t.length >= 4 && flat.includes(flatten(t))),
    );
    if (tagged.length > 0) return tagged[index % tagged.length];
  }

  return videos[index % videos.length];
}

/**
 * The clip as it is written down beside a caption.
 *
 * Same reason topics are pinned: what a slot carries is decided once, when the
 * post is written, and re-derived pairings drift. Add a clip to the library and
 * every unwritten slot re-rotates — which is correct — while everything already
 * written keeps the clip its caption was composed against. Tags are deliberately
 * not stored; they are how a clip was chosen, not part of the choice.
 */
export interface PinnedVideo {
  url: string;
  poster: string | null;
  name: string;
  describes?: string;
}

export function pinnable(video: LibraryVideo): PinnedVideo {
  return {
    url: video.url,
    poster: video.poster,
    name: video.name,
    ...(video.describes ? { describes: video.describes } : {}),
  };
}
