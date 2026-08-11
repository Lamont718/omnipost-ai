"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { generatedImageUrl, PLATFORM_LIMIT } from "@/components/PostPreview";
import { Platform } from "@/lib/types";

/**
 * The posting sheet: a work-list you get through, rather than a view you look at.
 *
 * The calendar answers "what is scheduled" and /designs answers "what will it
 * look like". Neither answers the question that actually blocks posting, which
 * is "what do I do next, and what do I paste". So this is one column, in the
 * order the posts go out, each one carrying the two things a post needs — the
 * words and the picture — with a button for each and a tick when it's done.
 *
 * Deliberately not a table. A table means scrolling sideways on a phone to
 * reach the caption, and the phone is where he posts from.
 *
 * The tick shares `omnipost.posted` with the calendar, so marking something
 * here greys it out there too. Print styles are real: this page is meant to
 * survive being printed or saved as a PDF and worked through on paper.
 */

interface SlotPost {
  id: string;
  date: string;
  time: string;
  platform: Platform;
  brand: { slug: string; name: string; colorHex: string };
  topic: { title: string; url?: string; source: string };
  caption: string | null;
  image?: string | null;
}

const LS_POSTED = "omnipost.posted";

const PLATFORM_TAG: Record<Platform, string> = {
  instagram: "IG",
  facebook: "FB",
  linkedin: "LI",
  x: "X",
};

function loadPosted(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LS_POSTED) || "{}");
  } catch {
    return {};
  }
}

function to12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

/** The month options: this month and the five after it. */
function monthChoices(): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    out.push(format(new Date(now.getFullYear(), now.getMonth() + i, 1), "yyyy-MM"));
  }
  return out;
}

export default function SheetPage() {
  const [posts, setPosts] = useState<SlotPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [brandSlug, setBrandSlug] = useState<string>("all");
  const [posted, setPosted] = useState<Record<string, string>>({});
  const [hidePosted, setHidePosted] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => setPosted(loadPosted()), []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/schedule?month=${month}`)
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .finally(() => setLoading(false));
  }, [month]);

  const brands = useMemo(() => {
    const seen = new Map<string, SlotPost["brand"]>();
    for (const p of posts) if (!seen.has(p.brand.slug)) seen.set(p.brand.slug, p.brand);
    return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [posts]);

  /**
   * Only written posts reach the sheet. An empty slot is not something you can
   * post, so listing it would only pad the work-list with things you can't do —
   * the count of them is reported instead.
   */
  const { rows, unwritten } = useMemo(() => {
    const mine = posts.filter((p) => brandSlug === "all" || p.brand.slug === brandSlug);
    const written = mine.filter((p) => p.caption);
    const visible = hidePosted ? written.filter((p) => !posted[p.id]) : written;
    visible.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return { rows: visible, unwritten: mine.length - written.length };
  }, [posts, brandSlug, hidePosted, posted]);

  const doneCount = rows.filter((p) => posted[p.id]).length;

  function togglePosted(id: string) {
    const next = { ...posted };
    if (next[id]) delete next[id];
    else next[id] = new Date().toISOString();
    setPosted(next);
    localStorage.setItem(LS_POSTED, JSON.stringify(next));
  }

  function copyCaption(p: SlotPost) {
    if (!p.caption) return;
    navigator.clipboard.writeText(p.caption);
    setCopied(p.id);
    window.setTimeout(() => setCopied((c) => (c === p.id ? null : c)), 1400);
  }

  // Group into day headings so the sheet reads as a run of days, not 80 cards.
  const byDay = useMemo(() => {
    const map = new Map<string, SlotPost[]>();
    for (const p of rows) {
      if (!map.has(p.date)) map.set(p.date, []);
      map.get(p.date)!.push(p);
    }
    return Array.from(map.entries());
  }, [rows]);

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <style>{printCss}</style>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px 80px" }}>
        <div className="no-print">
          <Link href="/calendar" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>
            ← Back to the calendar
          </Link>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "14px 0 6px", color: "#0f172a" }}>
          Posting sheet
        </h1>
        <p style={{ color: "#64748b", fontSize: 14, margin: 0, lineHeight: 1.55 }}>
          Every written post, in the order it goes out. Copy the words, save the picture, tick it
          off.
        </p>

        {/* Controls */}
        <div
          className="no-print"
          style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "20px 0 6px" }}
        >
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={selectStyle}
            aria-label="Month"
          >
            {monthChoices().map((m) => (
              <option key={m} value={m}>
                {format(parseISO(`${m}-01`), "MMMM yyyy")}
              </option>
            ))}
          </select>

          <select
            value={brandSlug}
            onChange={(e) => setBrandSlug(e.target.value)}
            style={selectStyle}
            aria-label="Brand"
          >
            <option value="all">All brands</option>
            {brands.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setHidePosted((v) => !v)}
            style={{ ...selectStyle, cursor: "pointer", fontWeight: 600 }}
          >
            {hidePosted ? "Showing what's left" : "Show what's left"}
          </button>

          <button
            onClick={() => window.print()}
            style={{ ...selectStyle, cursor: "pointer", fontWeight: 600 }}
          >
            Print / save PDF
          </button>
        </div>

        <div style={{ fontSize: 13, color: "#64748b", margin: "10px 0 22px", lineHeight: 1.6 }}>
          {loading ? (
            "Loading…"
          ) : (
            <>
              <strong style={{ color: "#0f172a" }}>
                {doneCount} of {rows.length} posted
              </strong>{" "}
              {brandSlug === "all" ? "across all brands" : ""} this month.
              {unwritten > 0 && (
                <>
                  {" "}
                  {unwritten} slot{unwritten === 1 ? "" : "s"} still ha
                  {unwritten === 1 ? "s" : "ve"} no caption — write{" "}
                  {unwritten === 1 ? "it" : "them"} on the{" "}
                  <Link href="/calendar" style={{ color: "#4f46e5" }}>
                    calendar
                  </Link>
                  .
                </>
              )}
            </>
          )}
        </div>

        {!loading && rows.length === 0 && (
          <div
            style={{
              border: "1px dashed #cbd5e1",
              borderRadius: 12,
              padding: 28,
              textAlign: "center",
              color: "#64748b",
              fontSize: 14,
            }}
          >
            {hidePosted
              ? "Everything here is posted. 🎉"
              : "Nothing written for this month yet."}
          </div>
        )}

        {byDay.map(([date, dayPosts]) => (
          <section key={date} style={{ marginBottom: 26 }}>
            <h2
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#0f172a",
                textTransform: "uppercase",
                letterSpacing: 0.6,
                margin: "0 0 10px",
                paddingBottom: 6,
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              {format(parseISO(`${date}T00:00`), "EEEE d MMMM")}
            </h2>

            {dayPosts.map((p) => (
              <PostRow
                key={p.id}
                post={p}
                posted={!!posted[p.id]}
                copied={copied === p.id}
                onCopy={() => copyCaption(p)}
                onToggle={() => togglePosted(p.id)}
              />
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function PostRow({
  post,
  posted,
  copied,
  onCopy,
  onToggle,
}: {
  post: SlotPost;
  posted: boolean;
  copied: boolean;
  onCopy: () => void;
  onToggle: () => void;
}) {
  const caption = post.caption ?? "";
  const imageUrl = post.image ?? generatedImageUrl(post.brand.slug, caption);
  const downloadHref = imageUrl
    ? `/api/download?url=${encodeURIComponent(imageUrl)}&name=${encodeURIComponent(
        `${post.brand.slug}-${post.date}-${post.platform}`,
      )}`
    : null;

  // X is the only platform whose limit a caption realistically trips, and going
  // over means the post silently won't send — worth saying loudly, not in grey.
  const over = post.platform === "x" && caption.length > PLATFORM_LIMIT.x;

  return (
    <article
      className="sheet-row"
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderLeft: `3px solid ${post.brand.colorHex}`,
        borderRadius: 10,
        padding: 12,
        marginBottom: 10,
        opacity: posted ? 0.55 : 1,
      }}
    >
      {/* Picture */}
      <div style={{ flex: "0 0 auto", width: 108 }}>
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={post.topic.title}
            style={{
              width: 108,
              height: 108,
              objectFit: "cover",
              borderRadius: 8,
              background: "#f1f5f9",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: 108,
              height: 108,
              borderRadius: 8,
              background: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#94a3b8",
              fontSize: 11,
              textAlign: "center",
              padding: 8,
            }}
          >
            No image
          </div>
        )}
        {downloadHref && (
          <a
            className="no-print"
            href={downloadHref}
            style={{
              display: "block",
              textAlign: "center",
              marginTop: 6,
              fontSize: 11.5,
              fontWeight: 600,
              color: "#4f46e5",
              textDecoration: "none",
              border: "1px solid #e0e7ff",
              borderRadius: 6,
              padding: "5px 0",
            }}
          >
            Save image
          </a>
        )}
      </div>

      {/* Words */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginBottom: 7,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
              background: post.brand.colorHex,
              borderRadius: 5,
              padding: "2px 7px",
            }}
          >
            {PLATFORM_TAG[post.platform]}
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a" }}>
            {post.brand.name}
          </span>
          <span style={{ fontSize: 12.5, color: "#94a3b8" }}>{to12h(post.time)}</span>
          <span style={{ fontSize: 12.5, color: "#94a3b8" }}>·</span>
          <span
            style={{
              fontSize: 12.5,
              color: "#64748b",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 320,
            }}
            title={post.topic.title}
          >
            {post.topic.title}
          </span>
        </div>

        <div
          style={{
            fontSize: 13.5,
            lineHeight: 1.6,
            color: "#1f2937",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "#f8fafc",
            border: "1px solid #eef2f7",
            borderRadius: 8,
            padding: "10px 12px",
          }}
        >
          {caption}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
          }}
        >
          <button className="no-print" onClick={onCopy} style={actionStyle}>
            {copied ? "Copied ✓" : "Copy caption"}
          </button>
          <button
            className="no-print"
            onClick={onToggle}
            style={{
              ...actionStyle,
              borderColor: posted ? "#bbf7d0" : "#e2e8f0",
              color: posted ? "#15803d" : "#334155",
            }}
          >
            {posted ? "Posted ✓ — undo" : "Mark as posted"}
          </button>
          {post.topic.url && (
            <a
              href={post.topic.url}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 11.5, color: "#94a3b8", textDecoration: "none" }}
            >
              source ↗
            </a>
          )}
          <span
            style={{
              fontSize: 11.5,
              marginLeft: "auto",
              color: over ? "#b91c1c" : "#94a3b8",
              fontWeight: over ? 700 : 400,
            }}
          >
            {over
              ? `${caption.length - PLATFORM_LIMIT.x} over the ${PLATFORM_LIMIT.x} limit`
              : `${caption.length} chars${
                  post.platform === "x" ? ` / ${PLATFORM_LIMIT.x}` : ""
                }`}
          </span>
        </div>
      </div>
    </article>
  );
}

const selectStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  fontSize: 13,
  color: "#0f172a",
};

const actionStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  borderRadius: 7,
  padding: "5px 11px",
  fontSize: 12,
  fontWeight: 600,
  color: "#334155",
  cursor: "pointer",
};

/**
 * Printing is a real use for this page — a month of posts on paper next to the
 * phone. So the buttons come off, the cards stop being cards, and a post is
 * never split across two pages.
 */
const printCss = `
@media (max-width: 560px) {
  .sheet-row { flex-direction: column; }
}
@media print {
  .no-print { display: none !important; }
  body { background: #fff !important; }
  .sheet-row {
    break-inside: avoid;
    page-break-inside: avoid;
    border: none !important;
    border-left: 3px solid #ccc !important;
    border-radius: 0 !important;
    padding: 6px 0 6px 10px !important;
    opacity: 1 !important;
  }
  section { break-inside: auto; }
  h2 { break-after: avoid; page-break-after: avoid; }
}
`;
