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
      <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {days.map((day) => {
            const dayPosts = postsForDay(day);
            const inMonth = isSameMonth(day, currentMonth);
            const today = isSameDay(day, new Date());
            return (
              <div
                key={day.toISOString()}
                style={{
                  minHeight: 96,
                  border: "1px solid #eef0f2",
                  borderRadius: 8,
                  padding: 6,
                  background: inMonth ? "#fff" : "#fafafa",
                  opacity: inMonth ? 1 : 0.6,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: today ? 700 : 500,
                    color: today ? "#2563eb" : "#6b7280",
                    marginBottom: 4,
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
                        borderRadius: 4,
                        padding: "3px 5px",
                        marginBottom: 3,
                        cursor: "pointer",
                        fontSize: 10.5,
                        lineHeight: 1.3,
                      }}
                    >
                      <span style={{ color: "#374151", fontWeight: 600 }}>
                        {to12h(p.time)}
                      </span>{" "}
                      <span style={{ color: "#9ca3af" }}>
                        {PLATFORM_LABEL[p.platform]}
                      </span>
                      <br />
                      <span style={{ color: p.brand.colorHex, fontWeight: 600 }}>
                        {p.brand.name}
                      </span>{" "}
                      {isPosted ? "✓" : written ? "" : "·"}
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
          topic: { title: post.topic.title, context: post.topic.context },
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
              {copied ? "Copied ✓" : "Copy"}
            </button>
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
