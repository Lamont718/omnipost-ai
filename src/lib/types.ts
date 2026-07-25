export type PostStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "published"
  | "rejected";

export type Platform = "instagram" | "facebook" | "linkedin" | "x";

export type EmojiStyle = "minimal" | "moderate" | "none";

/** 0 = Sunday … 6 = Saturday, matching JS `Date.getDay()`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** One recurring weekly posting slot for a brand. */
export interface PostSlot {
  day: Weekday;
  /** 24h local time, "HH:MM". Interpreted as America/New_York. */
  time: string;
  platform: Platform;
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

