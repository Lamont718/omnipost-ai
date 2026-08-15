"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { generatedImageUrl, PLATFORM_LIMIT } from "@/components/PostPreview";
import { Platform } from "@/lib/types";
import { usePosted } from "@/lib/use-posted";
import { useFeedback } from "@/lib/use-feedback";
import type { Verdict } from "@/lib/feedback";

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
 * The tick is shared with the calendar and, since it moved to the server, with
 * every other device — see lib/posted.ts. Marking something here greys it out
 * on the phone too, which is what makes "12 of 40 posted" a number worth
 * trusting. Print styles are real: this page is meant to survive being printed
 * or saved as a PDF and worked through on paper.
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

/** What /api/publish reports about a brand's connected accounts. */
interface BrandReadiness {
  slug: string;
  instagram: boolean;
  facebook: boolean;
  x: boolean;
}

interface PublishedRecord {
  id: string;
  publishedAt: string;
  permalink?: string;
}

const PLATFORM_TAG: Record<Platform, string> = {
  instagram: "IG",
  facebook: "FB",
  linkedin: "LI",
  x: "X",
};

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
  const { posted, toggle: togglePosted, syncError } = usePosted();
  const { feedback, judge, count: judgedCount } = useFeedback();
  const [hidePosted, setHidePosted] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<Record<string, BrandReadiness>>({});
  const [live, setLive] = useState<Record<string, PublishedRecord>>({});
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<Record<string, string>>({});

  const today = format(new Date(), "yyyy-MM-dd");

  /**
   * What can actually be published, and what already has been.
   *
   * The published records come from the server rather than this browser. A tick
   * in localStorage says "I posted this from this laptop"; the record says "this
   * went out", which is the only version that stops the phone from posting it a
   * second time.
   */
  useEffect(() => {
    fetch("/api/publish")
      .then((r) => r.json())
      .then((d) => {
        const brands: Record<string, BrandReadiness> = {};
        for (const b of d.brands ?? []) brands[b.slug] = b;
        setReadiness(brands);

        const records: Record<string, PublishedRecord> = {};
        for (const r of d.published ?? []) records[r.id] = r;
        setLive(records);
      })
      .catch(() => {
        // No connected accounts yet is the normal state — the sheet still works
        // as a copy-and-paste list, so this failing changes nothing on screen.
      });
  }, []);

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
  const { rows, unwritten, pastHidden } = useMemo(() => {
    const mine = posts.filter((p) => brandSlug === "all" || p.brand.slug === brandSlug);
    const written = mine.filter((p) => p.caption);
    // A month view spills into the neighbouring months, so opening this in
    // August led with 28 July — dates that can't be posted, and the ones most
    // likely to carry an old caption paired to a topic that has since moved.
    const ahead = showPast ? written : written.filter((p) => p.date >= today);
    // A post that really went out counts as done even if this browser never
    // ticked it — the server record is the one that survives changing device.
    const visible = hidePosted ? ahead.filter((p) => !posted[p.id] && !live[p.id]) : ahead;
    visible.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return {
      rows: visible,
      unwritten: mine.filter((p) => !p.caption && (showPast || p.date >= today)).length,
      pastHidden: written.length - written.filter((p) => p.date >= today).length,
    };
  }, [posts, brandSlug, hidePosted, posted, live, showPast, today]);

  const doneCount = rows.filter((p) => posted[p.id] || live[p.id]).length;

  const connectedCount = useMemo(
    () => Object.values(readiness).filter((b) => b.instagram || b.facebook || b.x).length,
    [readiness],
  );

  function canPublish(p: SlotPost): boolean {
    const brand = readiness[p.brand.slug];
    if (!brand) return false;
    if (p.platform === "instagram") return brand.instagram;
    if (p.platform === "facebook") return brand.facebook;
    if (p.platform === "x") return brand.x;
    return false;
  }

  /**
   * Publish one post.
   *
   * The confirm is not boilerplate. Every other button on this page is
   * reversible — a copy can be discarded, a tick can be un-ticked — and this one
   * puts words in front of a real audience with no undo. Naming the brand and
   * the platform in the prompt is what makes it possible to notice you are about
   * to post the NBA caption to the children's-book account.
   */
  async function publish(p: SlotPost) {
    const where = p.platform === "x" ? "X" : p.platform === "facebook" ? "Facebook" : "Instagram";
    if (!window.confirm(`Post this to ${p.brand.name} on ${where} now?\n\nThis goes out live and can't be undone from here.`)) {
      return;
    }

    setPublishing(p.id);
    setPublishError((e) => ({ ...e, [p.id]: "" }));
    try {
      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id }),
      });
      const data = await res.json();

      if (data.published || data.duplicate) {
        setLive((l) => ({
          ...l,
          [p.id]: { id: p.id, publishedAt: data.publishedAt, permalink: data.permalink },
        }));
      }
      if (!data.published) {
        setPublishError((e) => ({ ...e, [p.id]: data.error ?? "it didn't go out" }));
      }
    } catch (error) {
      setPublishError((e) => ({
        ...e,
        [p.id]: error instanceof Error ? error.message : "it didn't go out",
      }));
    } finally {
      setPublishing(null);
    }
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

          {pastHidden > 0 && (
            <button
              onClick={() => setShowPast((v) => !v)}
              style={{ ...selectStyle, cursor: "pointer", fontWeight: 600 }}
            >
              {showPast ? "Hide past" : `Show ${pastHidden} past`}
            </button>
          )}

          <button
            onClick={() => window.print()}
            style={{ ...selectStyle, cursor: "pointer", fontWeight: 600 }}
          >
            Print / save PDF
          </button>

          <Link
            href="/facts"
            style={{ ...selectStyle, textDecoration: "none", fontWeight: 600 }}
          >
            Brand facts
          </Link>
        </div>

        <div style={{ fontSize: 13, color: "#64748b", margin: "10px 0 22px", lineHeight: 1.6 }}>
          {loading ? (
            "Loading…"
          ) : (
            <>
              <strong style={{ color: "#0f172a" }}>
                {doneCount} of {rows.length} posted
              </strong>{" "}
              {brandSlug === "all" ? "across all brands" : ""}
              {showPast ? " this month" : " from today onwards"}.
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

        {/*
          What the thumbs are for, said once. Without this they read as a
          rating nobody collects — and the count is deliberately the real
          number, including zero, rather than a promise about what it'll learn.
        */}
        {!loading && (
          <div style={{ fontSize: 12.5, color: "#64748b", margin: "-12px 0 20px", lineHeight: 1.6 }}>
            👍 on a post you&apos;ve sent teaches the next one — the captions you mark good come
            back as tone examples when that brand is written again.{" "}
            {judgedCount === 0
              ? "Nothing judged yet."
              : `${judgedCount} judged so far.`}
          </div>
        )}

        {/*
          A tick that didn't reach the server still greys the row out here, so
          without this the page would look like it worked and the phone would
          disagree tomorrow. Said plainly, once.
        */}
        {syncError && (
          <div
            className="no-print"
            style={{
              border: "1px solid #fde68a",
              background: "#fffbeb",
              borderRadius: 10,
              padding: "10px 14px",
              margin: "0 0 16px",
              fontSize: 12.5,
              lineHeight: 1.6,
              color: "#92400e",
            }}
          >
            <strong>Ticks aren&apos;t saving to the server right now.</strong> They&apos;re kept in
            this browser, so what you tick here won&apos;t show up on your phone until the
            connection is back.
          </div>
        )}

        {/*
          Said once at the top rather than repeated as a disabled button on
          every row. Until the Meta and X credentials are in the environment
          this page is exactly what it was before — a copy-and-paste list — and
          it should say so plainly instead of looking broken.
        */}
        {!loading && connectedCount === 0 && (
          <div
            className="no-print"
            style={{
              border: "1px solid #e2e8f0",
              background: "#fff",
              borderRadius: 10,
              padding: "12px 14px",
              margin: "0 0 20px",
              fontSize: 12.5,
              lineHeight: 1.6,
              color: "#475569",
            }}
          >
            <strong style={{ color: "#0f172a" }}>No accounts connected yet.</strong> Copy and Save
            image work as they always have. Add the Instagram, Facebook and X credentials to the
            environment and a <strong>Post now</strong> button appears on every row that can go out
            — see <code style={{ fontSize: 11.5 }}>docs/connecting-accounts.md</code> in the repo.
          </div>
        )}

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
              : pastHidden > 0
                ? "Nothing left to post this month — the rest is already behind you."
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
                verdict={feedback[p.id]}
                onJudge={(v) => judge(p.id, p.brand.slug, v)}
                copied={copied === p.id}
                onCopy={() => copyCaption(p)}
                onToggle={() => togglePosted(p.id)}
                connected={canPublish(p)}
                live={live[p.id]}
                publishing={publishing === p.id}
                error={publishError[p.id]}
                onPublish={() => publish(p)}
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
  verdict,
  onJudge,
  copied,
  onCopy,
  onToggle,
  connected,
  live,
  publishing,
  error,
  onPublish,
}: {
  post: SlotPost;
  posted: boolean;
  verdict?: Verdict;
  onJudge: (verdict: Verdict) => void;
  copied: boolean;
  onCopy: () => void;
  onToggle: () => void;
  connected: boolean;
  live?: PublishedRecord;
  publishing: boolean;
  error?: string;
  onPublish: () => void;
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
        opacity: posted || live ? 0.55 : 1,
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
              // `contain`, not `cover`: a YODM card cropped to a square loses
              // half its question, and the picture is here to be recognised,
              // not to look tidy. Letterbox stays neutral grey so it never
              // reads as brand colour.
              objectFit: "contain",
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
          {/*
            The Post button only appears where the brand actually has that
            platform connected, and it disappears once the post has gone out.
            An always-visible button that fails on press teaches people to
            distrust the page; an absent one is self-explanatory.
          */}
          {live ? (
            <span
              style={{
                ...actionStyle,
                cursor: "default",
                borderColor: "#bbf7d0",
                background: "#f0fdf4",
                color: "#15803d",
              }}
            >
              Posted live ✓
            </span>
          ) : connected && !over ? (
            <button
              className="no-print"
              onClick={onPublish}
              disabled={publishing}
              style={{
                ...actionStyle,
                background: publishing ? "#eef2ff" : "#4f46e5",
                borderColor: publishing ? "#c7d2fe" : "#4f46e5",
                color: publishing ? "#4f46e5" : "#fff",
                cursor: publishing ? "wait" : "pointer",
              }}
            >
              {publishing ? "Posting…" : "Post now"}
            </button>
          ) : null}

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

          {/*
            Only once it's actually gone out. Asking "did this work?" about a
            post nobody has sent is a question with no answer, and a row of
            controls you can't honestly use is how a page stops being read.
          */}
          {(posted || live) && (
            <span className="no-print" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 11.5, color: "#94a3b8" }}>did it land?</span>
              <button
                onClick={() => onJudge("good")}
                title="This one worked — use it as a tone example"
                style={{
                  ...actionStyle,
                  padding: "5px 9px",
                  borderColor: verdict === "good" ? "#bbf7d0" : "#e2e8f0",
                  background: verdict === "good" ? "#f0fdf4" : "#fff",
                }}
              >
                👍
              </button>
              <button
                onClick={() => onJudge("flat")}
                title="This one fell flat"
                style={{
                  ...actionStyle,
                  padding: "5px 9px",
                  borderColor: verdict === "flat" ? "#fecaca" : "#e2e8f0",
                  background: verdict === "flat" ? "#fef2f2" : "#fff",
                }}
              >
                👎
              </button>
            </span>
          )}

          {live?.permalink && (
            <a
              className="no-print"
              href={live.permalink}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 11.5, color: "#15803d", fontWeight: 600, textDecoration: "none" }}
            >
              see it live ↗
            </a>
          )}
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

        {/*
          Publishing failures are shown on the row that failed, in the platform's
          own words. "It didn't work" sends you to the logs; "The image is not a
          valid JPEG" or "requires instagram_content_publish" tells you which of
          two completely different problems you have.
        */}
        {error && (
          <div
            className="no-print"
            style={{
              marginTop: 8,
              fontSize: 12,
              lineHeight: 1.5,
              color: "#b91c1c",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 7,
              padding: "7px 10px",
            }}
          >
            Didn&apos;t post: {error}
          </div>
        )}
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
