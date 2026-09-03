import { Resend } from "resend";
import { activeBrands, Brand, BRANDS } from "./brands";
import { topicsForBrand, Topic, weekIndex } from "./sources";
import { composePost } from "./compose";
import { Platform, GenerateResponse } from "./types";

/**
 * The Monday digest: one email containing every post for every active brand,
 * already written, ready to paste.
 *
 * This is deliberately not a publishing pipeline. Getting write access to the
 * platform APIs is weeks of app review and real monthly cost; pasting from your
 * phone is thirty seconds. If the pasting habit sticks, automating it is worth
 * paying for — and this file is where those drafts would come from anyway.
 */

export interface DigestPost {
  platform: Platform;
  topic: Topic;
  post: GenerateResponse;
}

export interface DigestBrand {
  brand: Brand;
  posts: DigestPost[];
  /** Set when the brand produced nothing, so failures are visible not silent. */
  error?: string;
}

export interface Digest {
  generatedAt: Date;
  week: number;
  brands: DigestBrand[];
}

export function totalPosts(digest: Digest): number {
  return digest.brands.reduce((n, b) => n + b.posts.length, 0);
}

async function buildBrand(brand: Brand, now: Date): Promise<DigestBrand> {
  try {
    const topics = await topicsForBrand(brand, now);
    const posts: DigestPost[] = [];

    for (let i = 0; i < topics.length; i++) {
      // Topic i fills schedule slot i; use that slot's platform.
      const platform = brand.schedule[i % brand.schedule.length].platform;
      const post = await composePost({
        brand,
        topic: { title: topics[i].title, context: topics[i].context, url: topics[i].url },
        platform,
      });
      posts.push({ platform, topic: topics[i], post });
    }

    return { brand, posts };
  } catch (err) {
    return {
      brand,
      posts: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Write every active brand's week. Brands run concurrently — sequentially this
 * overruns the function timeout once there are more than a handful of posts.
 * Each brand is independent, so one failing shows up as a note in the email
 * rather than killing the send.
 */
export async function buildDigest(
  now: Date = new Date(),
  only?: string,
): Promise<Digest> {
  // `only` searches every brand, not just active ones, so you can test a
  // brand you haven't switched on yet.
  const selected = only ? BRANDS.filter((b) => b.slug === only) : activeBrands();

  const brands = await Promise.all(selected.map((b) => buildBrand(b, now)));
  return { generatedAt: now, week: weekIndex(now), brands };
}

// ------------------------------------------------------------------ rendering

const PLATFORM_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
  tiktok: "TikTok",
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderPost(entry: DigestPost, color: string): string {
  const { platform, topic, post } = entry;
  const caption = escapeHtml(post.caption ?? "");

  return `
    <div style="border:1px solid #e5e7eb;border-radius:10px;margin:0 0 14px;overflow:hidden;">
      <div style="background:#f9fafb;padding:8px 12px;border-bottom:1px solid #e5e7eb;font:600 12px/1.4 -apple-system,Segoe UI,Arial,sans-serif;color:#374151;">
        <span style="color:${color};">${PLATFORM_LABEL[platform]}</span>
        <span style="color:#9ca3af;font-weight:400;"> · suggested ${escapeHtml(
          post.recommended_post_time ?? "",
        )}</span>
      </div>
      <div style="padding:12px;">
        <div style="font:400 15px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#111827;white-space:pre-wrap;background:#fff;border:1px dashed #d1d5db;border-radius:8px;padding:12px;">${caption}</div>
        ${
          topic.url
            ? `<div style="margin-top:8px;font:400 12px/1.5 -apple-system,Segoe UI,Arial,sans-serif;">
                 <a href="${escapeHtml(topic.url)}" style="color:#6b7280;">${escapeHtml(topic.url)}</a>
               </div>`
            : ""
        }
      </div>
    </div>`;
}

function renderBrand(section: DigestBrand): string {
  const { brand, posts, error } = section;

  const body = error
    ? `<div style="padding:12px;font:400 14px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#b91c1c;">Couldn't draft this week: ${escapeHtml(
        error,
      )}</div>`
    : posts.length === 0
      ? `<div style="padding:12px;font:400 14px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#6b7280;">No topics found this week.</div>`
      : posts.map((p) => renderPost(p, brand.colorHex)).join("");

  return `
    <div style="margin:0 0 28px;">
      <h2 style="font:700 17px/1.3 -apple-system,Segoe UI,Arial,sans-serif;color:#111827;margin:0 0 4px;border-left:4px solid ${
        brand.colorHex
      };padding-left:10px;">${escapeHtml(brand.name)}</h2>
      <div style="font:400 12px/1.5 -apple-system,Segoe UI,Arial,sans-serif;color:#9ca3af;margin:0 0 12px;padding-left:14px;">${
        posts.length
      } post${posts.length === 1 ? "" : "s"}</div>
      ${body}
    </div>`;
}

export function renderDigestHtml(digest: Digest): string {
  const date = digest.generatedAt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/New_York",
  });

  return `
  <div style="max-width:640px;margin:0 auto;padding:24px 16px;background:#ffffff;">
    <div style="margin:0 0 24px;">
      <h1 style="font:700 22px/1.3 -apple-system,Segoe UI,Arial,sans-serif;color:#111827;margin:0;">This week's posts</h1>
      <p style="font:400 14px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#6b7280;margin:6px 0 0;">
        ${escapeHtml(date)} · ${totalPosts(digest)} drafts across ${
          digest.brands.length
        } brands. Copy, paste, post.
      </p>
    </div>
    ${digest.brands.map(renderBrand).join("")}
    <div style="border-top:1px solid #e5e7eb;padding-top:14px;font:400 12px/1.6 -apple-system,Segoe UI,Arial,sans-serif;color:#9ca3af;">
      Written by OmniPost. Edit voices in <code>src/lib/brands.ts</code>; toggle a brand with <code>active</code>.
    </div>
  </div>`;
}

// -------------------------------------------------------------------- sending

export async function sendDigest(to: string, digest: Digest): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");

  const resend = new Resend(apiKey);
  const from = process.env.DIGEST_FROM ?? "OmniPost <onboarding@resend.dev>";

  const { error } = await resend.emails.send({
    from,
    to,
    subject: `${totalPosts(digest)} posts ready — week of ${digest.generatedAt.toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric", timeZone: "America/New_York" },
    )}`,
    html: renderDigestHtml(digest),
  });

  if (error) throw new Error(`Resend: ${error.message}`);
}
