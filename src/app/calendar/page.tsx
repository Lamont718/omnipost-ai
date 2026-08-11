"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
} from "date-fns";
import {
  PostPreview,
  EmptyPreview,
  PLATFORM_NAME,
  PLATFORM_LIMIT,
  generatedImageUrl,
} from "@/components/PostPreview";

/** Shape returned by /api/schedule. */
interface SlotPost {
  id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  platform: "instagram" | "facebook" | "linkedin" | "x";
  brand: { slug: string; name: string; colorHex: string };
  topic: { title: string; context?: string; url?: string; source: string };
  caption: string | null;
  /** The brand's own artwork for this slot, when it has a library. */
  image?: string | null;
}

const PLATFORM_LABEL: Record<SlotPost["platform"], string> = {
  instagram: "IG",
  facebook: "FB",
  linkedin: "LI",
  x: "X",
};

const PLATFORMS: SlotPost["platform"][] = ["instagram", "facebook", "linkedin", "x"];

/** Locally-written captions + "posted" flags, so the tool needs no login. */
const LS_CAPTIONS = "omnipost.captions";
const LS_POSTED = "omnipost.posted";

function loadLS(key: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}
function saveLS(key: string, v: Record<string, string>) {
  localStorage.setItem(key, JSON.stringify(v));
}

function to12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [posts, setPosts] = useState<SlotPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SlotPost | null>(null);

  // Client-side caption overrides + posted flags.
  const [localCaptions, setLocalCaptions] = useState<Record<string, string>>({});
  const [posted, setPosted] = useState<Record<string, string>>({});

  useEffect(() => {
    setLocalCaptions(loadLS(LS_CAPTIONS));
    setPosted(loadLS(LS_POSTED));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/schedule?month=${format(currentMonth, "yyyy-MM")}`);
      const data = await res.json();
      setPosts(data.posts ?? []);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    load();
  }, [load]);

  // ?post=<slot id> opens that post straight away, so a single post can be
  // linked to instead of described ("open the calendar, find Tuesday…").
  useEffect(() => {
    if (selected || posts.length === 0) return;
    const want = new URLSearchParams(window.location.search).get("post");
    if (!want) return;
    const hit = posts.find((p) => p.id === want);
    if (hit) setSelected(hit);
  }, [posts, selected]);

  function captionFor(p: SlotPost): string | null {
    return localCaptions[p.id] ?? p.caption;
  }

  function postsForDay(date: Date): SlotPost[] {
    const key = format(date, "yyyy-MM-dd");
    return posts.filter((p) => p.date === key);
  }

  const gridStart = startOfWeek(startOfMonth(currentMonth));
  const gridEnd = endOfWeek(endOfMonth(currentMonth));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const filledCount = posts.filter((p) => captionFor(p)).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Wide on purpose: six brands means up to five posts stacked in one day
          cell, and at 1100px the brand names were wrapping. */}
      <div style={{ padding: "24px clamp(16px, 3vw, 40px)", maxWidth: 1700, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
              Content Calendar
            </h1>
            <p style={{ color: "#6b7280", fontSize: 13, margin: "4px 0 0" }}>
              {posts.length} posts scheduled · {filledCount} written
              {loading ? " · loading…" : ""}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* The grid answers "what's scheduled"; the sheet is the one you
                actually work down when it's time to post. */}
            <Link
              href="/sheet"
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: "#fff",
                textDecoration: "none",
                border: "1px solid #4f46e5",
                background: "#4f46e5",
                borderRadius: 8,
                padding: "7px 12px",
              }}
            >
              Posting sheet
            </Link>
            <Link
              href="/designs"
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                color: "#374151",
                textDecoration: "none",
                border: "1px solid #e5e7eb",
                background: "#fff",
                borderRadius: 8,
                padding: "7px 12px",
                marginRight: 4,
              }}
            >
              See the designs
            </Link>
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} style={navBtn}>
              ‹
            </button>
            <span style={{ fontWeight: 600, minWidth: 150, textAlign: "center" }}>
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} style={navBtn}>
              ›
            </button>
          </div>
        </div>

        <MetricoolExport
          month={format(currentMonth, "yyyy-MM")}
          posts={posts}
          captionFor={captionFor}
        />

        {/* Weekday header */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              style={{
                textAlign: "center",
                fontSize: 11,
                fontWeight: 600,
                color: "#9ca3af",
                padding: "6px 0",
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Month grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6 }}>
          {days.map((day) => {
            const dayPosts = postsForDay(day);
            const inMonth = isSameMonth(day, currentMonth);
            const today = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                style={{
                  minHeight: 124,
                  border: "1px solid #eef0f2",
                  borderRadius: 8,
                  padding: 8,
                  background: inMonth ? "#fff" : "#fafafa",
                  opacity: inMonth ? 1 : 0.6,
                }}
              >
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: today ? 700 : 500,
                    color: today ? "#2563eb" : "#6b7280",
                    marginBottom: 5,
                  }}
                >
                  {format(day, "d")}
                </div>
                {dayPosts.map((p) => {
                  const written = !!captionFor(p);
                  const isPosted = !!posted[p.id];
                  return (
                    <button
                      key={p.id}
                      onClick={() => setSelected(p)}
                      title={`${p.brand.name} · ${to12h(p.time)} · ${p.topic.title}`}
                      style={{
                        display: "block",
                        width: "100%",
                        textAlign: "left",
                        border: "none",
                        borderLeft: `3px solid ${p.brand.colorHex}`,
                        background: isPosted ? "#f0fdf4" : written ? "#f8fafc" : "#fff",
                        borderRadius: 5,
                        padding: "4px 7px",
                        marginBottom: 4,
                        cursor: "pointer",
                        fontSize: 11.5,
                        lineHeight: 1.35,
                      }}
                    >
                      <span style={{ color: "#374151", fontWeight: 600 }}>
                        {to12h(p.time)}
                      </span>{" "}
                      <span style={{ color: "#9ca3af" }}>
                        {PLATFORM_LABEL[p.platform]}
                      </span>
                      {/* Ellipsis rather than wrap — "Heart of the Block" would
                          otherwise push a cell to three lines. */}
                      <div
                        style={{
                          color: p.brand.colorHex,
                          fontWeight: 600,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {p.brand.name} {isPosted ? "✓" : written ? "" : "·"}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {selected && (
          <PostDetail
            post={selected}
            caption={captionFor(selected)}
            posted={!!posted[selected.id]}
            onClose={() => setSelected(null)}
            onCaption={(text) => {
              const next = { ...localCaptions, [selected.id]: text };
              setLocalCaptions(next);
              saveLS(LS_CAPTIONS, next);
            }}
            onTogglePosted={() => {
              const next = { ...posted };
              if (next[selected.id]) delete next[selected.id];
              else next[selected.id] = new Date().toISOString();
              setPosted(next);
              saveLS(LS_POSTED, next);
            }}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Hand-off to Metricool, which owns the actual account connections.
 *
 * One file per brand rather than one for everything: Metricool matches its
 * "Brand name" column exactly, case included, and we don't know those names —
 * left blank, an import lands in whichever brand is open, which is reliable.
 * Only written posts are counted, and only ones still in the future, since
 * scheduling into the past does nothing.
 */
function MetricoolExport({
  month,
  posts,
  captionFor,
}: {
  month: string;
  posts: SlotPost[];
  captionFor: (p: SlotPost) => string | null;
}) {
  const [draft, setDraft] = useState(true);
  const today = format(new Date(), "yyyy-MM-dd");

  const brands: { slug: string; name: string; colorHex: string; ready: number }[] = [];
  for (const p of posts) {
    if (p.date < today || !captionFor(p)) continue;
    const hit = brands.find((b) => b.slug === p.brand.slug);
    if (hit) hit.ready++;
    else brands.push({ ...p.brand, ready: 1 });
  }

  if (brands.length === 0) return null;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        background: "#fff",
        borderRadius: 10,
        padding: "12px 14px",
        margin: "14px 0 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
          Send to Metricool
        </span>
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          One CSV per brand, upcoming written posts only. In Metricool: open the brand →
          Planning → Import CSV.
        </span>
        <label
          style={{
            marginLeft: "auto",
            fontSize: 12,
            color: "#374151",
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
          }}
        >
          <input type="checkbox" checked={draft} onChange={(e) => setDraft(e.target.checked)} />
          Import as drafts
        </label>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {brands.map((b) => (
          <a
            key={b.slug}
            href={`/api/export?month=${month}&brand=${b.slug}${draft ? "&draft=1" : ""}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              border: "1px solid #e5e7eb",
              borderRadius: 999,
              padding: "6px 12px",
              fontSize: 12.5,
              fontWeight: 600,
              color: "#374151",
              textDecoration: "none",
              background: "#fff",
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: b.colorHex,
              }}
            />
            {b.name}
            <span style={{ color: "#9ca3af", fontWeight: 500 }}>
              {b.ready}
              {b.ready > 50 ? " ⚠" : ""}
            </span>
          </a>
        ))}
      </div>

      <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 8 }}>
        Metricool recommends importing 50 posts at a time — a ⚠ means that file is over.
        Every row carries a public image URL; leave &quot;Import as drafts&quot; on for the first
        run so you can check them in Metricool before anything goes out.
      </div>
    </div>
  );
}

function PostDetail({
  post,
  caption,
  posted,
  onClose,
  onCaption,
  onTogglePosted,
}: {
  post: SlotPost;
  caption: string | null;
  posted: boolean;
  onClose: () => void;
  onCaption: (text: string) => void;
  onTogglePosted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Which platform's design is on screen — starts on the slot's own. */
  const [view, setView] = useState<SlotPost["platform"]>(post.platform);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/slot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: post.id,
          brand: post.brand.slug,
          platform: post.platform,
          // The whole topic, not just the title: it gets stored with the
          // caption so this slot keeps showing this subject even after the
          // sitemap moves on.
          topic: post.topic,
        }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else onCaption(data.caption);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function copy() {
    if (!caption) return;
    navigator.clipboard.writeText(caption);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  /**
   * The picture comes from the schedule API, which resolves it the same way the
   * Metricool export does — library, then the page's own share image, then a
   * generated card.
   *
   * This used to ask /api/og-image directly, and that was its own bug: asking
   * the page bypassed the rule about sites that publish one share image for
   * everything, so a WWSH basketball post opened showing the chess photo from
   * communitynyc.org's homepage. Deciding it in one place on the server is what
   * stops the modal, the grid, the showroom and the CSV disagreeing.
   *
   * A slot with no caption yet has no picture: the card is drawn from the
   * caption's opening line, so there is nothing to draw until it's written.
   */
  const imageUrl =
    post.image ?? (caption ? generatedImageUrl(post.brand.slug, caption) : null);

  const downloadHref = imageUrl
    ? `/api/download?url=${encodeURIComponent(imageUrl)}&name=${encodeURIComponent(
        `${post.brand.slug}-${post.date}-${post.platform}`,
      )}`
    : null;

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: post.brand.colorHex }}>
              {post.brand.name}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
              {format(new Date(post.date + "T00:00"), "EEEE, MMM d")} · {to12h(post.time)} ·{" "}
              {PLATFORM_LABEL[post.platform]}
            </div>
          </div>
          <button onClick={onClose} style={{ ...navBtn, fontSize: 18 }}>
            ×
          </button>
        </div>

        <div style={{ fontSize: 13, color: "#374151", margin: "12px 0 6px", fontWeight: 600 }}>
          Topic
        </div>
        <div style={{ fontSize: 13, color: "#4b5563" }}>{post.topic.title}</div>
        {post.topic.url && (
          <a href={post.topic.url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#6b7280" }}>
            {post.topic.url}
          </a>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            margin: "16px 0 8px",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
            {view === post.platform
              ? `As it will look on ${PLATFORM_NAME[view]}`
              : `Same copy, on ${PLATFORM_NAME[view]}`}
          </div>
          {/* Its own platform first, then the others — the copy is written for
              one platform, but seeing it in the others catches length problems. */}
          <div style={{ display: "flex", gap: 4 }}>
            {PLATFORMS.map((pf) => (
              <button
                key={pf}
                onClick={() => setView(pf)}
                style={{
                  border: "1px solid " + (view === pf ? "#111827" : "#e5e7eb"),
                  background: view === pf ? "#111827" : "#fff",
                  color: view === pf ? "#fff" : "#6b7280",
                  borderRadius: 6,
                  padding: "4px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {PLATFORM_LABEL[pf]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
          {caption ? (
            <PostPreview
              platform={view}
              brand={post.brand}
              topic={post.topic}
              caption={caption}
              when={format(new Date(post.date + "T00:00"), "MMM d")}
              // The same value the Save button downloads, so the file you get
              // is the file you just looked at — including right after a
              // Rewrite, when the stored picture hasn't caught up yet.
              imageUrl={imageUrl}
            />
          ) : (
            <EmptyPreview platform={view} brand={post.brand} />
          )}
        </div>

        {caption && (
          <div style={{ fontSize: 11.5, color: "#9ca3af", textAlign: "center" }}>
            {caption.length} characters · {PLATFORM_NAME[view]} allows{" "}
            {PLATFORM_LIMIT[view].toLocaleString()}
          </div>
        )}

        {error && <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 8 }}>{error}</div>}

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button onClick={generate} disabled={busy} style={primaryBtn}>
            {busy ? "Writing…" : caption ? "Rewrite" : "Write this post"}
          </button>
          {caption && (
            <button onClick={copy} style={secondaryBtn}>
              {copied ? "Copied ✓" : "Copy caption"}
            </button>
          )}
          {caption && downloadHref && (
            <a href={downloadHref} download style={{ ...secondaryBtn, textDecoration: "none" }}>
              Save image
            </a>
          )}
          <button onClick={onTogglePosted} style={secondaryBtn}>
            {posted ? "Posted ✓ — undo" : "Mark as posted"}
          </button>
        </div>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  borderRadius: 8,
  width: 32,
  height: 32,
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
};
const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 50,
};
const modal: React.CSSProperties = {
  background: "#fff",
  borderRadius: 12,
  padding: 20,
  maxWidth: 520,
  width: "100%",
  maxHeight: "85vh",
  overflowY: "auto",
};
const primaryBtn: React.CSSProperties = {
  background: "#111827",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "8px 14px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};
const secondaryBtn: React.CSSProperties = {
  background: "#fff",
  color: "#374151",
  border: "1px solid #e5e7eb",
  borderRadius: 8,
  padding: "8px 14px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};
