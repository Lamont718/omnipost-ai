import { Platform, PostSlot, Weekday } from "./types";
import { activeBrands, Brand } from "./brands";
import { topicsForBrand, Topic, weekIndex } from "./sources";
import type { CaptionMap } from "./store";

export type { PostSlot, Weekday } from "./types";

/**
 * The posting schedule and how it becomes dated calendar entries.
 *
 * A brand's `schedule` is a list of weekly slots — "post on this weekday, at
 * this time, to this platform". That is the whole schedule model: no database
 * row per post, just a recurring pattern in code that the calendar projects
 * onto real dates. Editing when a brand posts means editing its slots in
 * brands.ts and nothing else.
 */

/** One concrete, dated post the calendar can render. */
export interface ScheduledPost {
  /** Stable across reloads — used as the caption-store key. */
  id: string;
  brandSlug: string;
  brandName: string;
  colorHex: string;
  /** Real @handle, when the brand has one. Undefined means "don't claim one". */
  handle?: string;
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
  time: string;
  platform: Platform;
  /** Which slot in the brand's week this is — picks the topic. */
  slotIndex: number;
  topic: Topic;
}

const WEEKDAY_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function weekdayLabel(day: Weekday): string {
  return WEEKDAY_LABEL[day];
}

function iso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** A slot's stable id — same slot on the same date always resolves the same. */
export function slotId(brandSlug: string, date: string, slot: PostSlot): string {
  return `${brandSlug}:${date}:${slot.time}:${slot.platform}`;
}

/**
 * Every scheduled post for one brand between `start` and `end` (inclusive).
 *
 * Topics rotate by week, so all posts within the same ISO week share that
 * week's topic set and `slotIndex` picks which one — a Tuesday and a Thursday
 * slot in the same week get different topics, and next week they both advance.
 * Discovery runs once per (brand, week), not once per post.
 */
async function brandPostsInRange(
  brand: Brand,
  start: Date,
  end: Date,
): Promise<ScheduledPost[]> {
  if (brand.schedule.length === 0) return [];

  const out: ScheduledPost[] = [];
  const topicsByWeek = new Map<number, Topic[]>();

  const cursor = new Date(start);
  while (cursor <= end) {
    const weekday = cursor.getDay() as Weekday;

    for (let i = 0; i < brand.schedule.length; i++) {
      const slot = brand.schedule[i];
      if (slot.day !== weekday) continue;

      const wk = weekIndex(cursor);
      let topics = topicsByWeek.get(wk);
      if (!topics) {
        topics = await topicsForBrand(brand, new Date(cursor));
        topicsByWeek.set(wk, topics);
      }
      // Slots can outnumber topics if discovery came up short; wrap around.
      const topic = topics[i % Math.max(topics.length, 1)] ?? {
        title: brand.name,
        source: "evergreen" as const,
      };

      const date = iso(cursor);
      // A brand's handle can differ by network — YODM is @y_o_d_m on TikTok and
      // @yodm_debate on Instagram and X — so resolve against this slot's own
      // platform. Carrying one brand-wide name onto every mock-up would put a
      // real handle on the wrong network, which reads as correct and isn't.
      const handle = brand.handles?.[slot.platform] ?? brand.handle;
      out.push({
        id: slotId(brand.slug, date, slot),
        brandSlug: brand.slug,
        brandName: brand.name,
        colorHex: brand.colorHex,
        ...(handle ? { handle } : {}),
        date,
        time: slot.time,
        platform: slot.platform,
        slotIndex: i,
        topic,
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return out;
}

/**
 * Replace each post's freshly-derived topic with the one its caption was
 * actually written from, where there is one.
 *
 * Discovery is a moving target: sitemaps grow, `lastmod` dates shift, and any
 * edit to a brand's `sources` re-shuffles which page lands in which slot. A
 * written caption must not move with it — the words are about one specific
 * thing, and the label, the link and the picture all have to keep pointing at
 * that thing. So a caption's own topic wins, and rotation only governs slots
 * nobody has written yet.
 *
 * Every reader of the store goes through here — the calendar, the showroom and
 * the Metricool export — so none of them can disagree about what a post is
 * about. Captions written before topics were pinned have none, and keep the
 * derived one.
 */
export function withPinnedTopics(
  posts: ScheduledPost[],
  captions: CaptionMap,
): ScheduledPost[] {
  return posts.map((post) => {
    const pinned = captions[post.id]?.topic;
    return pinned ? { ...post, topic: pinned } : post;
  });
}

/** Every active brand's scheduled posts across a date range, brands in parallel. */
export async function scheduledPostsInRange(
  start: Date,
  end: Date,
): Promise<ScheduledPost[]> {
  const perBrand = await Promise.all(
    activeBrands().map((b) => brandPostsInRange(b, start, end)),
  );
  return perBrand
    .flat()
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
