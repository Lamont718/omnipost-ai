"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/**
 * Where the true things get typed.
 *
 * WWSH is the reason this page exists. Its site yields about two distinct
 * topics a month, so October produced nine posts from `/about-us` and
 * `/basketball`, three of which opened with the identical sentence. There was
 * nothing else true to say. The fix was never a better prompt — it was facts
 * that only Lamont has, and asking for them by email meant it never happened.
 *
 * So: one textarea, one line per fact, saved per brand, injected into every
 * post that brand writes. The prompts below ask for the specific and checkable,
 * because a vague fact buys nothing the page description didn't already give.
 */

interface BrandOption {
  slug: string;
  name: string;
  colorHex: string;
  hasSources: boolean;
  /** Distinct pages the brand can write about. */
  pages: number;
  postsPerMonth: number;
}

/**
 * How much room a brand has to avoid repeating itself.
 *
 * Under about two pages per post a month it will reuse the same handful of
 * subjects, and reused subjects is where identical opening sentences come from.
 * MostHatedNBA runs at roughly six; WWSH runs at one.
 */
function headroom(b: BrandOption): number {
  if (!b.postsPerMonth) return Infinity;
  return b.pages / b.postsPerMonth;
}

function isStarved(b: BrandOption): boolean {
  return headroom(b) < 2;
}

interface FactsRecord {
  brandSlug: string;
  facts: string[];
  updatedAt: string;
}

/**
 * Prompts, not sample facts.
 *
 * The first draft of this placeholder was five plausible-looking WWSH facts,
 * and one of them ("free for every kid") contradicted the real programme, which
 * costs $300 a month. Greyed-out text that looks like an answer is the same
 * hazard as a thin page description: something true-seeming sitting where a
 * fact belongs. Questions can't be mistaken for data.
 */
const PLACEHOLDER = `One fact per line. Answer whichever of these you can:

What does it cost, and what do you get for it?
When and where does it actually happen?
Who runs it, and where are they from?
How long has it been going?
What does one session look like, start to finish?
How many people does it reach?
What's the one thing people always get wrong about it?`;

export default function FactsPage() {
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [records, setRecords] = useState<Record<string, FactsRecord>>({});
  const [slug, setSlug] = useState<string>("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/facts", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        const list: BrandOption[] = d.brands ?? [];
        // Least room first. The brand that will repeat itself is the one this
        // page is for, and it should not be four clicks away.
        list.sort((a, b) => headroom(a) - headroom(b));
        setBrands(list);
        setRecords(d.facts ?? {});
        const worst = list.find((b) => !(d.facts?.[b.slug]?.facts?.length > 0)) ?? list[0];
        if (worst) setSlug(worst.slug);
      })
      .catch(() => setError("Couldn't load. Reload the page."))
      .finally(() => setLoading(false));
  }, []);

  // Switching brand loads that brand's saved lines; the unsaved edit is
  // deliberately dropped rather than silently carried onto another brand.
  useEffect(() => {
    if (!slug) return;
    setText((records[slug]?.facts ?? []).join("\n"));
    setSaved(false);
    setError("");
  }, [slug, records]);

  const brand = useMemo(() => brands.find((b) => b.slug === slug), [brands, slug]);
  const lines = useMemo(() => text.split("\n").map((l) => l.trim()).filter(Boolean), [text]);
  const dirty = useMemo(
    () => lines.join("\n") !== (records[slug]?.facts ?? []).join("\n"),
    [lines, records, slug],
  );

  async function save() {
    if (!slug) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandSlug: slug, facts: lines }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "could not save");
      setRecords((r) => ({ ...r, [slug]: data as FactsRecord }));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 80px" }}>
        <Link href="/sheet" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>
          ← Back to the posting sheet
        </Link>

        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "14px 0 6px", color: "#0f172a" }}>
          What&apos;s true about each brand
        </h1>
        <p style={{ color: "#64748b", fontSize: 14, margin: 0, lineHeight: 1.6 }}>
          Posts can only use details that come from somewhere real — a page on the site, or this
          list. A brand with a thin website has almost nothing to say, and it starts repeating
          itself. Type what you know here and every post that brand writes can reach for it.
        </p>

        {loading ? (
          <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 26 }}>Loading…</p>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "24px 0 16px" }}>
              {brands.map((b) => {
                const count = records[b.slug]?.facts?.length ?? 0;
                const active = b.slug === slug;
                return (
                  <button
                    key={b.slug}
                    onClick={() => setSlug(b.slug)}
                    style={{
                      border: `1px solid ${active ? b.colorHex : "#e2e8f0"}`,
                      background: active ? "#fff" : "#fff",
                      borderLeft: `3px solid ${b.colorHex}`,
                      borderRadius: 8,
                      padding: "8px 12px",
                      fontSize: 13,
                      fontWeight: active ? 700 : 500,
                      color: "#0f172a",
                      cursor: "pointer",
                      boxShadow: active ? "0 0 0 2px rgba(79,70,229,0.12)" : "none",
                    }}
                  >
                    {isStarved(b) && !count ? "⚠️ " : ""}
                    {b.name}{" "}
                    <span style={{ color: count ? "#15803d" : "#94a3b8", fontWeight: 600 }}>
                      · {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {brand && (
              <>
                {/*
                  Said only where it's true. A brand with a real sitemap already
                  has grounding; one without has literally nothing else, and
                  that difference is worth naming rather than leaving him to
                  guess which of six brands this page is really for.
                */}
                {isStarved(brand) && (
                  <div
                    style={{
                      border: "1px solid #fde68a",
                      background: "#fffbeb",
                      borderRadius: 10,
                      padding: "11px 14px",
                      margin: "0 0 14px",
                      fontSize: 12.5,
                      lineHeight: 1.6,
                      color: "#92400e",
                    }}
                  >
                    {brand.pages === 0 ? (
                      <>
                        <strong>{brand.name} has no website to pull from.</strong> Whatever you
                        write here is the only specific detail its posts will ever have.
                      </>
                    ) : (
                      <>
                        <strong>
                          {brand.name} has {brand.pages} page{brand.pages === 1 ? "" : "s"} to write
                          about and owes {brand.postsPerMonth} posts a month.
                        </strong>{" "}
                        It has to reuse the same subjects, which is why its posts start sounding
                        alike — three of its October posts opened with the same sentence. Facts you
                        add here are the way out.
                      </>
                    )}
                  </div>
                )}

                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={PLACEHOLDER}
                  rows={12}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: "13px 15px",
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: "#1f2937",
                    background: "#fff",
                    fontFamily: "inherit",
                    resize: "vertical",
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginTop: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    onClick={save}
                    disabled={saving || !dirty}
                    style={{
                      border: "none",
                      borderRadius: 8,
                      padding: "11px 20px",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#fff",
                      background: !dirty ? "#cbd5e1" : saving ? "#818cf8" : "#4f46e5",
                      cursor: !dirty || saving ? "default" : "pointer",
                    }}
                  >
                    {saving ? "Saving…" : dirty ? "Save" : "Saved"}
                  </button>

                  <span style={{ fontSize: 12.5, color: "#64748b" }}>
                    {lines.length} fact{lines.length === 1 ? "" : "s"}
                    {records[slug]?.updatedAt && !dirty
                      ? ` · last saved ${new Date(records[slug].updatedAt).toLocaleDateString()}`
                      : ""}
                  </span>

                  {saved && (
                    <span style={{ fontSize: 12.5, color: "#15803d", fontWeight: 600 }}>
                      Saved ✓ — the next post for {brand.name} will use these
                    </span>
                  )}
                  {error && (
                    <span style={{ fontSize: 12.5, color: "#b91c1c", fontWeight: 600 }}>
                      {error}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    marginTop: 26,
                    borderTop: "1px solid #e2e8f0",
                    paddingTop: 16,
                    fontSize: 12.5,
                    lineHeight: 1.75,
                    color: "#64748b",
                  }}
                >
                  <strong style={{ color: "#0f172a" }}>What makes a good line here</strong>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                    <li>Something checkable: a time, a place, a price, a year, a number.</li>
                    <li>
                      What actually happens — &quot;kids run the warm-up themselves&quot; beats
                      &quot;we build leadership&quot;.
                    </li>
                    <li>
                      Only things you&apos;d say publicly. These go into posts more or less as
                      written.
                    </li>
                    <li>
                      No made-up quotes or success stories, even as illustration — posts must never
                      claim someone said something they didn&apos;t.
                    </li>
                  </ul>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
