"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import {
  PostPreview,
  EmptyPreview,
  PLATFORM_NAME,
  PLATFORM_LIMIT,
  PreviewBrand,
} from "@/components/PostPreview";
import { Platform } from "@/lib/types";

/**
 * The showroom: one page that answers "what is this thing actually going to
 * put on my accounts?" — every brand, every platform it posts to, rendered in
 * that platform's own design using the real captions already written.
 *
 * Everything here is real. The captions come from the same store the calendar
 * reads; nothing is sample copy. Where a caption hasn't been written yet the
 * slot says so rather than showing something invented.
 */

interface SlotPost {
  id: string;
  date: string;
  time: string;
  platform: Platform;
  brand: { slug: string; name: string; colorHex: string };
  topic: { title: string; context?: string; url?: string; source: string };
  caption: string | null;
}

const PLATFORMS: Platform[] = ["instagram", "facebook", "linkedin", "x"];

export default function DesignsPage() {
  const [posts, setPosts] = useState<SlotPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [brandSlug, setBrandSlug] = useState<string | null>(null);

  useEffect(() => {
    const month = format(new Date(), "yyyy-MM");
    fetch(`/api/schedule?month=${month}`)
      .then((r) => r.json())
      .then((d) => setPosts(d.posts ?? []))
      .finally(() => setLoading(false));
  }, []);

  /** Brands in the schedule, in first-appearance order. */
  const brands = useMemo(() => {
    const seen = new Map<string, PreviewBrand>();
    for (const p of posts) if (!seen.has(p.brand.slug)) seen.set(p.brand.slug, p.brand);
    return Array.from(seen.values());
  }, [posts]);

  const active = brandSlug ?? brands[0]?.slug ?? null;
  const brand = brands.find((b) => b.slug === active) ?? null;

  /**
   * For each platform: the brand's most recent written post there, else any
   * scheduled slot there (so we can still show the design), else nothing.
   */
  const byPlatform = useMemo(() => {
    const out: Partial<Record<Platform, SlotPost>> = {};
    if (!brand) return out;
    const mine = posts.filter((p) => p.brand.slug === brand.slug);
    for (const pf of PLATFORMS) {
      const onPf = mine.filter((p) => p.platform === pf);
      out[pf] = onPf.find((p) => p.caption) ?? onPf[0];
    }
    return out;
  }, [posts, brand]);

  const writtenCount = posts.filter((p) => p.caption).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 60px" }}>
        <Link href="/calendar" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>
          ← Back to the calendar
        </Link>

        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "14px 0 6px", color: "#0f172a" }}>
          What your posts will look like
        </h1>
        <p style={{ color: "#64748b", fontSize: 14, margin: 0, maxWidth: 680, lineHeight: 1.55 }}>
          Every caption below is a real one this app wrote, shown in the design of the
          platform it&apos;s scheduled for. Nothing here is sample text.{" "}
          {loading ? "Loading…" : `${writtenCount} posts written so far this month.`}
        </p>

        {/* Brand picker */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "22px 0 8px" }}>
          {brands.map((b) => {
            const on = b.slug === active;
            return (
              <button
                key={b.slug}
                onClick={() => setBrandSlug(b.slug)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: `1px solid ${on ? b.colorHex : "#e2e8f0"}`,
                  background: on ? "#fff" : "#fff",
                  boxShadow: on ? `inset 0 0 0 1px ${b.colorHex}` : "none",
                  borderRadius: 999,
                  padding: "7px 14px",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  color: on ? "#0f172a" : "#64748b",
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: b.colorHex,
                    display: "inline-block",
                  }}
                />
                {b.name}
              </button>
            );
          })}
        </div>

        {brand && (
          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
            Posts to{" "}
            <strong style={{ color: "#0f172a" }}>
              {PLATFORMS.filter((pf) => byPlatform[pf])
                .map((pf) => PLATFORM_NAME[pf])
                .join(", ") || "no platforms yet"}
            </strong>
            . Greyed-out platforms below are ones this brand isn&apos;t scheduled on — that&apos;s a
            cadence choice in <code style={{ fontSize: 12 }}>brands.ts</code>, not a gap.
          </div>
        )}

        {/* One column per platform */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: 24,
            alignItems: "start",
          }}
        >
          {brand &&
            PLATFORMS.map((pf) => {
              const slot = byPlatform[pf];
              const scheduled = !!slot;
              return (
                <div key={pf} style={{ opacity: scheduled ? 1 : 0.55 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
                      {PLATFORM_NAME[pf]}
                    </h2>
                    <span style={{ fontSize: 11.5, color: "#94a3b8" }}>
                      {scheduled
                        ? `${slot!.caption ? slot!.caption.length : 0} / ${PLATFORM_LIMIT[
                            pf
                          ].toLocaleString()} chars`
                        : "not scheduled"}
                    </span>
                  </div>

                  {slot?.caption ? (
                    <PostPreview
                      platform={pf}
                      brand={brand}
                      topic={slot.topic}
                      caption={slot.caption}
                      when={format(new Date(slot.date + "T00:00"), "MMM d")}
                    />
                  ) : (
                    <EmptyPreview platform={pf} brand={brand} />
                  )}

                  {slot && (
                    <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 8, lineHeight: 1.5 }}>
                      {format(new Date(slot.date + "T00:00"), "EEE MMM d")} · {slot.time} ·{" "}
                      {slot.topic.title}
                    </div>
                  )}
                </div>
              );
            })}
        </div>

        {!loading && brands.length === 0 && (
          <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 30 }}>
            No scheduled posts this month.
          </div>
        )}
      </div>
    </div>
  );
}
