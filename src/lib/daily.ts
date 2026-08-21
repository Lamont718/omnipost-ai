import { Resend } from "resend";
import { buildSlotViews, SlotView } from "./schedule-view";
import { readPosted } from "./posted";
import { readPublished } from "./published";
import type { Platform } from "./types";

/**
 * The morning nudge: what has to go out today, in an email, at 8am.
 *
 * The app had every other piece of this already — the captions, the pictures,
 * the sheet that puts them in order — and still nothing was ever posted from
 * it, because it was entirely passive. It waited to be opened. Three months of
 * finished work sat behind a URL nobody had a reason to type on a Tuesday.
 *
 * So this goes the other way: the work arrives. The captions are in the email
 * in full, selectable, so a phone can post from the email alone without loading
 * anything, and the pictures are inline so they can be long-pressed and saved
 * the same way.
 *
 * Anything already ticked off is left out. An email that lists work you've
 * finished is one you learn to skim, and skimming is how the 8am email becomes
 * as ignorable as the URL was.
 */

const ZONE = "America/New_York";

const PLATFORM_NAME: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
};

/** Today's date in New York, as YYYY-MM-DD. */
export function todayInZone(now = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which is the format the slot ids use.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The hour of the day in New York, 0–23. Used to pick the right cron run. */
export function hourInZone(now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: ZONE, hour: "2-digit", hour12: false }).format(now),
  );
}

export interface DailyPlan {
  date: string;
  /** Written, not yet ticked off — the actual work. */
  due: SlotView[];
  /** Already posted today, counted but not listed. */
  doneCount: number;
  /** Scheduled today with no caption written, so a gap is visible not silent. */
  unwrittenCount: number;
}

/**
 * What's left to post today.
 *
 * The range is padded by a day either side because the server runs in UTC and
 * the day being asked about is a New York one; the filter on `date` is what
 * actually selects it.
 */
export async function planForDay(date: string): Promise<DailyPlan> {
  const [y, m, d] = date.split("-").map(Number);
  const start = new Date(y, m - 1, d - 1);
  const end = new Date(y, m - 1, d + 1);

  const [views, posted, published] = await Promise.all([
    buildSlotViews(start, end),
    readPosted(),
    readPublished(),
  ]);

  const today = views.filter((p) => p.date === date);
  const written = today.filter((p) => p.caption);
  const isDone = (p: SlotView) => !!posted[p.id] || !!published[p.id];

  const due = written.filter((p) => !isDone(p));
  due.sort((a, b) => a.time.localeCompare(b.time));

  return {
    date,
    due,
    doneCount: written.filter(isDone).length,
    unwrittenCount: today.length - written.length,
  };
}

// ------------------------------------------------------------------ rendering

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function to12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const SANS = "-apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif";

function renderPost(p: SlotView, origin: string): string {
  const caption = p.caption ?? "";
  const deepLink = `${origin}/calendar?post=${encodeURIComponent(p.id)}`;

  // No email client plays video, so a Reel shows its poster frame and links to
  // the file itself. Same-origin through /api/download, which is what makes a
  // phone save an .mp4 rather than open a tab it can do nothing with.
  const clipLink = p.video
    ? `${origin}/api/download?url=${encodeURIComponent(p.video)}&name=${encodeURIComponent(
        `${p.brand.slug}-${p.date}-${p.platform}`,
      )}`
    : null;

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-left:3px solid ${escapeHtml(
    p.brand.colorHex,
  )};border-radius:10px;margin:0 0 14px;background:#ffffff;">
    <tr>
      <td style="padding:14px 16px;">
        <div style="font:600 12px/1.5 ${SANS};color:#0f172a;margin:0 0 8px;">
          <span style="background:${escapeHtml(
            p.brand.colorHex,
          )};color:#ffffff;border-radius:5px;padding:2px 7px;font-weight:700;">${escapeHtml(
            p.video && p.platform === "instagram" ? "Reel" : PLATFORM_NAME[p.platform],
          )}</span>
          &nbsp;${escapeHtml(p.brand.name)}
          <span style="color:#94a3b8;font-weight:400;">&nbsp;·&nbsp;${escapeHtml(
            to12h(p.time),
          )}</span>
        </div>

        ${
          p.image
            ? `<div style="margin:0 0 10px;">${
                clipLink ? `<a href="${escapeHtml(clipLink)}">` : ""
              }<img src="${escapeHtml(p.image)}" alt="${escapeHtml(
                p.imageAlt ?? p.topic.title,
              )}" width="150" style="width:150px;max-width:100%;border-radius:8px;background:#f1f5f9;display:block;" />${
                clipLink ? "</a>" : ""
              }</div>`
            : ""
        }
        ${
          clipLink
            ? `<div style="font:600 12px/1.6 ${SANS};color:#4f46e5;margin:0 0 10px;"><a href="${escapeHtml(
                clipLink,
              )}" style="color:#4f46e5;text-decoration:none;">Save the clip &darr;</a><span style="color:#94a3b8;font-weight:400;">&nbsp;&middot;&nbsp;5s, silent &mdash; add music in Instagram</span></div>`
            : ""
        }

        <div style="font:400 14px/1.6 ${SANS};color:#1f2937;white-space:pre-wrap;background:#f8fafc;border:1px solid #eef2f7;border-radius:8px;padding:11px 13px;">${escapeHtml(
          caption,
        )}</div>

        <div style="font:400 12px/1.6 ${SANS};color:#94a3b8;margin:9px 0 0;">
          ${escapeHtml(p.topic.title)}
          &nbsp;·&nbsp;<a href="${escapeHtml(
            deepLink,
          )}" style="color:#4f46e5;text-decoration:none;font-weight:600;">copy &amp; tick off ↗</a>
        </div>
      </td>
    </tr>
  </table>`;
}

export function renderDailyHtml(plan: DailyPlan, origin: string): string {
  const count = plan.due.length;

  const header = `
    <div style="margin:0 0 18px;">
      <h1 style="font:700 22px/1.3 ${SANS};color:#0f172a;margin:0;">${
        count === 0 ? "Nothing left to post today" : `${count} post${count === 1 ? "" : "s"} to send today`
      }</h1>
      <p style="font:400 14px/1.6 ${SANS};color:#64748b;margin:6px 0 0;">${escapeHtml(
        longDate(plan.date),
      )}${
        plan.doneCount > 0
          ? ` · ${plan.doneCount} already ticked off`
          : ""
      }</p>
    </div>`;

  // Nothing to do is worth saying in one line rather than in silence — silence
  // is indistinguishable from the cron having broken.
  const body =
    count === 0
      ? `<p style="font:400 14px/1.6 ${SANS};color:#64748b;margin:0 0 18px;">${
          plan.doneCount > 0
            ? "Everything scheduled for today is done. 🎉"
            : "Nothing is scheduled for today."
        }</p>`
      : plan.due.map((p) => renderPost(p, origin)).join("");

  const gap =
    plan.unwrittenCount > 0
      ? `<p style="font:400 12.5px/1.6 ${SANS};color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:9px 12px;margin:0 0 18px;">${
          plan.unwrittenCount
        } slot${plan.unwrittenCount === 1 ? " has" : "s have"} no caption written for today.</p>`
      : "";

  return `<div style="max-width:620px;margin:0 auto;padding:22px;background:#f8fafc;">
    ${header}
    ${gap}
    ${body}
    <div style="margin:20px 0 0;">
      <a href="${escapeHtml(
        origin,
      )}/sheet" style="display:inline-block;background:#4f46e5;color:#ffffff;font:700 14px/1 ${SANS};text-decoration:none;border-radius:8px;padding:13px 20px;">Open the posting sheet</a>
    </div>
    <p style="font:400 11.5px/1.6 ${SANS};color:#94a3b8;margin:18px 0 0;">
      Sent by OmniPost each morning at 8am. Ticking a post off — here, on the sheet, or on the
      calendar — takes it out of tomorrow's email.
    </p>
  </div>`;
}

// ------------------------------------------------------------------- sending

export interface SendResult {
  sent: boolean;
  reason?: string;
}

export async function sendDaily(to: string, plan: DailyPlan, origin: string): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY is not set" };

  const resend = new Resend(apiKey);
  const from = process.env.DIGEST_FROM ?? "OmniPost <onboarding@resend.dev>";
  const count = plan.due.length;

  const { error } = await resend.emails.send({
    from,
    to,
    // The subject is the whole notification on a lock screen, so it carries the
    // number and the brands rather than the word "digest".
    subject:
      count === 0
        ? `Nothing to post today — ${longDate(plan.date)}`
        : `${count} to post today: ${Array.from(new Set(plan.due.map((p) => p.brand.name))).join(", ")}`,
    html: renderDailyHtml(plan, origin),
  });

  if (error) return { sent: false, reason: `Resend: ${error.message}` };
  return { sent: true };
}
