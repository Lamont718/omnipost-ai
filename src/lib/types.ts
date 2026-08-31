export type PostStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected";

/**
 * Every platform, and the type derived from it — in that order, deliberately.
 *
 * Platform used to be a hand-written union, and the list of platforms was
 * hand-written again in six other files as `Platform[]` or a regex. Adding
 * TikTok updated the union, so every `Record<Platform, …>` failed to compile
 * and got fixed — and every one of those six arrays kept its old four members
 * without a word, because a short array is still assignable to Platform[].
 * /api/slot answered "invalid platform" for a slot the calendar was happily
 * showing.
 *
 * Deriving the type from the array inverts that: the array is the thing you
 * edit, and it cannot be out of date with itself.
 */
export const PLATFORMS = ["instagram", "facebook", "linkedin", "x", "tiktok"] as const;

export type Platform = (typeof PLATFORMS)[number];

/** `instagram|facebook|linkedin|x|tiktok` — for parsing a slot id. */
export const PLATFORM_PATTERN = PLATFORMS.join("|");

export type EmojiStyle = "minimal" | "moderate" | "none";

/** 0 = Sunday … 6 = Saturday, matching JS `Date.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** One recurring weekly posting slot for a brand. */
export interface PostSlot {
  day: Weekday;
  /** 24h local time, "HH:MM". Interpreted as America/New_York. */
  time: string;
  platform: Platform;
  /**
   * Draw this slot's topic only from sources carrying this tag, and never from
   * the untagged ones.
   *
   * Without this a brand has one pool and every slot eats from it, which is
   * wrong the moment two of a brand's sources are different kinds of thing.
   * Emeka Explores posts lessons three times a week and now also has twelve
   * book pages; dropping the books into the same pool would have meant a week
   * of three books and then a month of none, at the rotation's discretion.
   * Tagging one slot `books` reserves it, and leaves the other two on lessons.
   */
  topics?: string;
}

/**
 * A rule that only applies to some of a brand's topics, matched against the
 * topic title and its verified facts.
 *
 * `cultural_context` is prose, and prose gets weighed rather than obeyed. YODM's
 * profile has spelled out for weeks that only "For It or Against It" cards use
 * the die, and a Social Matters card still went out telling people to roll. A
 * constraint that is selected per topic and stated as a flat prohibition is a
 * different kind of instruction from a paragraph of background.
 */
export interface TopicConstraint {
  /** Apply only when the topic title or its verified facts match. */
  when?: RegExp;
  /** Apply only when they do NOT match. */
  unless?: RegExp;
  /** Stated as an instruction, not as background. */
  rule: string;
}

export interface VoiceProfile {
  tone: string;
  audience: string;
  keywords?: string[];
  banned_words: string[];
  hashtags: string[];
  example_posts?: string[];
  cultural_context: string;
  emoji_style: EmojiStyle;
  /** Rules that switch on per topic — see TopicConstraint. */
  topic_constraints?: TopicConstraint[];
  /**
   * Phrases this brand may never write, checked after the caption comes back.
   *
   * `banned_words` covers single marketing words and is only ever ASKED for.
   * This is for whole phrases, and it is MEASURED — because the failure it
   * exists for was not the model ignoring an instruction, it was the model
   * obeying one. YODM's card pages carry a single site-wide description ("Pick
   * a side and make your case in 30 seconds. One of 92 cards…"), the grounding
   * rule says the facts block is the only place specifics may come from, and so
   * every caption recited it: 39 of 39 said "30 seconds", 36 said "92 cards",
   * 33 said "pick a side". The deck itself was the only thing being posted and
   * the caption underneath added nothing to it.
   *
   * Put here only phrases that are already printed on the artwork or already
   * true of every post — the point is to force the caption to carry something
   * the picture cannot.
   */
  banned_phrases?: string[];
  /**
   * Rules that apply to EVERY post for this brand, as opposed to
   * `topic_constraints`, which switch on per topic.
   *
   * These sit with the hard constraints in the prompt rather than in
   * `cultural_context`, for the reason given on TopicConstraint: prose gets
   * weighed, an instruction gets obeyed.
   */
  house_rules?: string[];
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  website_url: string | null;
  voice_profile: VoiceProfile;
  color_hex: string;
  created_at: string;
}

export interface SocialAccount {
  id: string;
  org_id: string;
  platform: Platform;
  access_token: string;
  account_name: string;
  connected_at: string;
}

export interface Post {
  id: string;
  org_id: string;
  caption: string;
  image_url: string | null;
  platform: Platform;
  status: PostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  ai_generated: boolean;
  created_at: string;
  organization?: Organization;
}

export interface GenerateRequest {
  org_id: string;
  topic: string;
  platform: Platform;
  tone_override?: string;
}

export interface GenerateResponse {
  caption: string;
  suggested_hashtags: string[];
  recommended_post_time: string;
  platform_notes: string;
}

