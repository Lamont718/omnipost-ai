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
 * Instagram and TikTok, and deliberately in one place so the caption writer,
 * the calendar and the publisher cannot disagree about it. Video posts fine on
 * X; what does not exist yet is an X preview that plays one, and a surface that
 * shows a still where the sheet shows a clip is exactly the three-way drift this
 * app has fixed twice already.
 */
export function platformPlaysVideo(platform?: Platform): boolean {
  return !platform || platform === "instagram" || platform === "tiktok";
}

/**
 * Where a clip is not optional.
 *
 * Instagram takes a photo or a Reel, so a still is a worse post but a post. On
 * TikTok there is no still to fall back to — the video IS the post, and a
 * caption written for a slot with no clip is a post that cannot be made. That
 * has to fail loudly at write time: this app has already shipped 36 captions
 * for slots nothing renders, and the way that happened was something being
 * written anyway and nobody being told.
 */
export function platformRequiresVideo(platform?: Platform): boolean {
  return platform === "tiktok";
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
 * Where a slot sits in the rotation: which clip in the pool this post takes.
 *
 * Deliberately not the hash used for images, and not a count of days either.
 * Both leave the rotation lumpy — the first draft counted days, and across
 * thirty-one Emeka slots it used one clip five times and three clips never,
 * because a Mon/Wed/Fri schedule steps by 12, then -8, then 3, and none of
 * that is coprime with anything useful.
 *
 * ⚠️ Counting POSTS — `weeks * slotsInTheWeek + position` — was the second
 * draft and it has the SAME disease one level up. Between two airings of ONE
 * slot the count steps by the number of slots in the week, so the clip a
 * Monday can reach is `weeks * slots + position (mod poolSize)`: when slots
 * and poolSize share a factor, that slot can only ever reach poolSize/gcd of
 * the library. Measured on Emeka Explores, 4 slots a week and 14 clips in
 * Blob: **each slot reached 7 of the 14, and Monday and Wednesday reached the
 * SAME 7** — half the library was unpostable on Instagram and the other half
 * came round twice as often as it should. The docstring's own claim, that
 * "a library of fifteen cycles cleanly through all fifteen", was true only
 * because fifteen happens to be coprime with four; the fifteenth clip had
 * never been uploaded, and dropping to fourteen silently halved the rotation.
 * This is the third appearance of one bug — `weekStep` in sources.ts for
 * topics, the tagged-group modulo below for clips, and this.
 *
 * So the step is ONE PER WEEK for a given slot, which is coprime with every
 * pool size there can be, and the slots within a week are spread across the
 * pool by an offset instead. Every slot reaches every clip, whatever the
 * library size, and two slots in the same week never open on the same face.
 *
 * The brand's own schedule is what turns a date back into a post number, and
 * the slot id carries the brand slug in front of the date — the same parse
 * lib/publish does. A slot that doesn't match the schedule (one that has been
 * moved, an id from an older shape) falls back to a hash rather than to
 * nothing.
 */
function rotationIndex(slotId: string, poolSize: number): number {
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
        // One step per week for this slot; the slots within a week start at
        // different points in the pool so they don't all show the same clip.
        return weeks + Math.round((position * poolSize) / ordered.length);
      }
    }
  }

  return hashOf(slotId);
}

/*
 * The slot ids that reach the line above are not arbitrary strings: they are
 * dates exactly `poolSize` weeks apart, differing in two or three digits. A
 * `hash * 31 + charCode` rolling hash barely moves its low bits across inputs
 * that similar, and it is only the low bits the modulo reads — over three
 * years of the Tuesday slot that gave trust-forgive one airing and trust-hell-no
 * seven, out of the same four-clip group. This is a standard 32-bit avalanche
 * (two xorshift-multiply rounds); it does not make the choice a rotation, it
 * makes an unlucky group stop being unlucky.
 */
function spread(n: number): number {
  let x = n | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Stable, well-spread integer for a slot id. */
function hashOf(slotId: string): number {
  let hash = 0;
  for (let i = 0; i < slotId.length; i++) hash = (hash * 31 + slotId.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function flatten(hint: string): string {
  return hint.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Does this tag apply to this hint?
 *
 * A plain substring test, with one guard: a tag that ends in a digit must not
 * be followed by another digit in the hint. Without it the tag "card/7" —
 * flattened to "card7" — matches yodm.com/card/70 through /card/79, and the
 * game-night clip of somebody arguing "would you break the law" gets stapled
 * to a completely different card. That is the exact failure this brand's
 * `clipsMustMatchSubject` was added to stop, so the tag matcher must not
 * reintroduce it one digit at a time. Single-digit deck cards only became
 * reachable on 8 Sep 2026, when card 7 got footage.
 */
function tagMatches(flatHint: string, tag: string): boolean {
  const flatTag = flatten(tag);
  if (flatTag.length < 4) return false;
  const endsInDigit = /[0-9]$/.test(flatTag);
  let at = flatHint.indexOf(flatTag);
  while (at !== -1) {
    const next = flatHint[at + flatTag.length];
    if (!endsInDigit || next === undefined || !/[0-9]/.test(next)) return true;
    at = flatHint.indexOf(flatTag, at + 1);
  }
  return false;
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

  const index = rotationIndex(slotId, videos.length);

  if (hint) {
    const flat = flatten(hint);
    const tagged = videos.filter((v) =>
      (v.tags ?? []).some((t) => tagMatches(flat, t)),
    );
    /*
     * Which one, when several clips are about the same subject.
     *
     * NOT `index`. `rotationIndex` returns weeks * slotsInTheWeek + position,
     * so between two weeks it steps by the number of slots the brand has — and
     * a topic only comes back round every `poolSize` weeks, so between two
     * appearances of one subject it steps by poolSize * slots. Both are
     * frequently multiples of the group size, and then the modulo is constant
     * and every clip but one is UNREACHABLE. Measured on YODM: four clips argue
     * the broken-trust question, its topic returns every 8 weeks, the brand has
     * 4 slots — 8 * 4 mod 4 = 0, so trust-forgive posted every time and the
     * other three never posted at all. This is the same failure `weekStep` in
     * sources.ts documents for topics, one level down.
     *
     * A hash of the slot id has no period to collide with: the date is in it,
     * so it moves on every occurrence, and it is stable for a given date so the
     * preview and the post agree. It is not a round-robin — the same clip can
     * come up twice in a row — but every clip is reachable, which the strict
     * rotation was not.
     */
    if (tagged.length > 0) return tagged[spread(hashOf(slotId)) % tagged.length];
  }

  /*
   * No clip is about this subject, and this brand has said that means no clip.
   *
   * The rotation fallback below is right for a brand whose clips are ABOUT the
   * brand — Emeka waving, Emeka reading — where any clip suits any lesson. It
   * is wrong for a brand whose clips are each about one specific thing. YODM's
   * three game-night clips open on the card being argued, so rotating one onto
   * a different card puts a question on screen that the caption is not asking.
   *
   * That is not hypothetical: it is how fourteen podcast clips came to sit
   * under twenty-eight debate cards, and why the TikTok slot was pulled on 2
   * September. Lamont's call on 3 September, once the game clips existed: "only
   * use the clips that was made yesterday." A brand set this way gets footage
   * when the footage is about the post, and its card graphic the rest of the
   * time — never a clip about something else.
   *
   * The slot id carries the brand slug, so no caller has to know the rule.
   */
  const slug = slotId.match(/^([a-z0-9-]+):/)?.[1];
  if (slug && brandBySlug(slug)?.clipsMustMatchSubject) return null;

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
