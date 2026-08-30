import { Platform } from "./types";

/**
 * Metricool's bulk-scheduling CSV.
 *
 * OmniPost deliberately doesn't publish to any platform — that's app review
 * with Meta and X, tokens to keep alive, and a monthly bill. Metricool already
 * holds the account connections, and it imports a CSV. So the handoff is a
 * file: this app writes the posts, Metricool posts them.
 *
 * ⚠️ The header row must match the template Metricool gives you under
 * Planning → Import CSV → Download template, exactly and in order — their
 * importer matches on column names and the docs say not to add or remove
 * columns. If an import is rejected, download a fresh template and compare it
 * against COLUMNS below; that is the first thing to check, before anything in
 * this file's logic.
 *
 * Docs: https://help.metricool.com/en/article/how-to-schedule-posts-in-batch-with-a-csv-file-in-metricool-3wihqx/
 */

/** Column order of the Metricool import template. */
export const COLUMNS = [
  "Text",
  "Date",
  "Time",
  "Draft",
  "Facebook",
  "Twitter",
  "LinkedIn",
  "GBP",
  "Instagram",
  "Pinterest",
  "TikTok",
  "YouTube",
  "Threads",
  "Bluesky",
  "Picture Url 1",
  "Alt text picture 1",
  "Brand name",
] as const;

/** Which of Metricool's network columns each of our platforms maps to. */
const NETWORK_COLUMN: Record<Platform, string> = {
  facebook: "Facebook",
  x: "Twitter",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  tiktok: "TikTok",
};

/** Every network column, so the ones we aren't posting to can be set FALSE. */
const NETWORK_COLUMNS = [
  "Facebook",
  "Twitter",
  "LinkedIn",
  "GBP",
  "Instagram",
  "Pinterest",
  "TikTok",
  "YouTube",
  "Threads",
  "Bluesky",
];

export interface ExportPost {
  caption: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM, 24h */
  time: string;
  platform: Platform;
  /** Public, direct link to the image. Metricool rejects anything else. */
  imageUrl: string | null;
  /** Alt text — the topic title reads well and is already written. */
  imageAlt?: string;
  /** Leave empty to import into whichever brand is open in Metricool. */
  brandName?: string;
}

function cell(value: string): string {
  // Quote everything with a comma, quote or newline, and double any inner
  // quotes. Captions routinely contain all three.
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function row(post: ExportPost, draft: boolean): string {
  const on = NETWORK_COLUMN[post.platform];
  const values: Record<string, string> = {
    Text: post.caption,
    Date: post.date,
    // Metricool's template uses HH:MM:SS.
    Time: `${post.time}:00`,
    Draft: draft ? "TRUE" : "FALSE",
    "Picture Url 1": post.imageUrl ?? "",
    "Alt text picture 1": post.imageUrl ? (post.imageAlt ?? "") : "",
    "Brand name": post.brandName ?? "",
  };
  for (const col of NETWORK_COLUMNS) {
    values[col] = col === on ? "TRUE" : "FALSE";
  }
  return COLUMNS.map((c) => cell(values[c] ?? "")).join(",");
}

/**
 * A UTF-8 CSV, BOM included — Metricool's guidance is explicit that the file
 * must be UTF-8 or emoji and curly quotes arrive mangled, and Excel on Windows
 * will re-save it as the system codepage without the BOM to tell it otherwise.
 */
export function toMetricoolCsv(posts: ExportPost[], draft = false): string {
  const lines = [COLUMNS.join(","), ...posts.map((p) => row(p, draft))];
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** Metricool recommends importing at most 50 posts at a time. */
export const RECOMMENDED_MAX_ROWS = 50;
