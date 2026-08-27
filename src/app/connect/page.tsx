"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

/**
 * The switchboard.
 *
 * This app has a finished publisher. `lib/publish` resolves a post exactly the
 * way the sheet resolved it, refuses duplicates against durable storage, checks
 * the length limit, posts to Instagram, Facebook or X, and records what went
 * out. It has published nothing, ever, because not one account is connected —
 * and the instructions for connecting one lived in a forty-line comment at the
 * top of lib/accounts.ts, where nobody was ever going to read them.
 *
 * That is the whole gap this page closes. It says, per brand and per platform:
 * how many written posts are waiting on it, whether it is connected, what to
 * paste, and — the part that matters — which account the platform says the
 * credential actually belongs to. Everything here is derived from the live
 * schedule and the live readiness; no number on this page is typed.
 */

interface Readiness {
  slug: string;
  name: string;
  instagram: boolean;
  facebook: boolean;
  x: boolean;
  /** The real @handle, or null when nobody has recorded one. */
  handle: string | null;
}

interface AccountCheck {
  slug: string;
  route: "page" | "direct";
  ok: boolean;
  username?: string;
  error?: string;
}

interface SlotView {
  id: string;
  date: string;
  platform: "instagram" | "facebook" | "linkedin" | "x";
  caption: string | null;
  video?: string | null;
  brand: { slug: string; name: string; colorHex: string };
}

type Platform = "instagram" | "x";

interface Row {
  slug: string;
  name: string;
  colorHex: string;
  platform: Platform;
  /** Written, still ahead, and a still image — the publisher could send these. */
  sendable: number;
  /** Written, still ahead, and a Reel — the publisher refuses these on purpose. */
  reels: number;
  connected: boolean;
  /** The brand's @handle, or null when no account has ever been named. */
  handle: string | null;
  /** What the platform says about the live token, once it has been asked. */
  check?: AccountCheck;
}

const CARD: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#fff",
  borderRadius: 12,
  padding: "18px 20px",
};

const INPUT: React.CSSProperties = {
  width: "100%",
  fontSize: 16,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  marginTop: 6,
};

/** The env var names a row needs, so the page names them exactly once. */
function envNames(slug: string, platform: Platform): string[] {
  const s = slug.toUpperCase().replace(/-/g, "_");
  return platform === "instagram"
    ? [`IG_USER_ID_${s}`, `IG_TOKEN_${s}`]
    : [`X_ACCESS_TOKEN_${s}`, `X_ACCESS_SECRET_${s}`];
}

function monthsAhead(count: number): string[] {
  const out: string[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default function ConnectPage() {
  const [readiness, setReadiness] = useState<Readiness[] | null>(null);
  const [checks, setChecks] = useState<AccountCheck[] | null>(null);
  const [slots, setSlots] = useState<SlotView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/publish", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const brands: Readiness[] = j.brands ?? [];
        setReadiness(brands);

        // Asking each live token who it belongs to costs a round trip per
        // account, so it only happens when there is an account to ask — and it
        // is the whole reason "connected" is worth showing. A token that
        // authenticates for the wrong account is exactly the failure this app
        // has already shipped once, and a green light that only means "an
        // environment variable is set" would repeat it.
        if (brands.some((b) => b.instagram)) {
          fetch("/api/publish?check=1", { cache: "no-store" })
            .then((r) => r.json())
            .then((c) => setChecks(c.checks ?? []))
            .catch(() => setChecks([]));
        } else {
          setChecks([]);
        }
      })
      .catch(() => setError("Couldn't read what's connected."));
  }, []);

  useEffect(() => {
    // Three months, because that is roughly how far ahead the calendar is
    // written and the point is to size the waiting queue honestly.
    Promise.all(
      monthsAhead(3).map((m) =>
        fetch(`/api/schedule?month=${m}`, { cache: "no-store" }).then((r) => r.json()),
      ),
    )
      .then((pages) => {
        const seen = new Map<string, SlotView>();
        for (const page of pages) for (const p of page.posts ?? []) seen.set(p.id, p);
        setSlots(Array.from(seen.values()));
      })
      .catch(() => setError("Couldn't read the schedule."));
  }, []);

  const rows = useMemo<Row[]>(() => {
    if (!readiness || !slots) return [];
    const today = new Date().toISOString().slice(0, 10);
    const byBrand = new Map<string, Row>();

    for (const p of slots) {
      if (!p.caption || p.date < today) continue;
      if (p.platform !== "instagram" && p.platform !== "x") continue;

      const key = `${p.brand.slug}:${p.platform}`;
      const ready = readiness.find((b) => b.slug === p.brand.slug);
      const row: Row = byBrand.get(key) ?? {
        slug: p.brand.slug,
        name: p.brand.name,
        colorHex: p.brand.colorHex,
        platform: p.platform,
        sendable: 0,
        reels: 0,
        connected: p.platform === "instagram" ? !!ready?.instagram : !!ready?.x,
        handle: ready?.handle ?? null,
        check:
          p.platform === "instagram"
            ? checks?.find((c) => c.slug === p.brand.slug)
            : undefined,
      };
      if (p.video && p.platform === "instagram") row.reels++;
      else row.sendable++;
      byBrand.set(key, row);
    }

    return Array.from(byBrand.values()).sort((a, b) => b.sendable - a.sendable);
  }, [readiness, slots, checks]);

  const totals = useMemo(() => {
    const sendable = rows.reduce((n, r) => n + (r.connected ? 0 : r.sendable), 0);
    const reels = rows.reduce((n, r) => n + r.reels, 0);
    const connected = rows.filter((r) => r.connected).length;
    const unnamed = rows.filter((r) => !r.handle);
    return {
      sendable,
      reels,
      connected,
      rows: rows.length,
      unnamedPosts: unnamed.reduce((n, r) => n + r.sendable + r.reels, 0),
      unnamedBrands: Array.from(new Set(unnamed.map((r) => r.name))),
    };
  }, [rows]);

  const loading = !readiness || !slots;

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "44px 20px 80px" }}>
      <p style={{ margin: 0 }}>
        <Link href="/sheet" style={{ color: "#4f46e5", fontWeight: 600, fontSize: 13.5 }}>
          &larr; Today&rsquo;s posts
        </Link>
      </p>

      <h1 style={{ font: "700 30px/1.2 var(--font-geist-sans)", color: "#0f172a", margin: "14px 0 0" }}>
        Publishing
      </h1>
      <p style={{ font: "400 15.5px/1.7 var(--font-geist-sans)", color: "#475569", margin: "10px 0 0" }}>
        The Post button is built. It resolves a post the same way the sheet does, refuses to send
        the same one twice, and records what went out. It has never sent anything, because no
        account is connected to it — every post this app has ever written was copied out by hand.
      </p>

      {error && (
        <p style={{ font: "500 14px/1.6 var(--font-geist-sans)", color: "#b91c1c", marginTop: 14 }}>
          {error}
        </p>
      )}

      {loading ? (
        <p style={{ color: "#94a3b8", fontSize: 14, marginTop: 26 }}>Counting what&rsquo;s waiting…</p>
      ) : (
        <>
          <div style={{ ...CARD, marginTop: 24, borderLeft: "3px solid #4f46e5" }}>
            <p style={{ font: "700 17px/1.5 var(--font-geist-sans)", color: "#0f172a", margin: 0 }}>
              {totals.sendable} written posts could go out on their own.
            </p>
            <p style={{ font: "400 14px/1.7 var(--font-geist-sans)", color: "#475569", margin: "8px 0 0" }}>
              That is every still-image post already written and still ahead, on a brand and
              platform that isn&rsquo;t connected yet. {totals.reels} more are Reels, and those stay
              by hand — see below. {totals.connected} of {totals.rows} brand-and-platform pairs are
              connected today.
            </p>
          </div>

          {/*
            Asked before the credentials, because it turned out to be the
            question underneath them. The Conductor wrote a post every
            Wednesday for months and was switched off on 2026-08-27 for having
            no account and no plan to get one — and nothing on this page could
            have told you, because every row here only ever asked whether the
            keys were set. A brand nobody has ever named a handle for is the
            visible shape of that.
          */}
          {totals.unnamedBrands.length > 0 && (
            <div style={{ ...CARD, marginTop: 14, borderLeft: "3px solid #b91c1c" }}>
              <p style={{ font: "700 15px/1.5 var(--font-geist-sans)", color: "#7f1d1d", margin: 0 }}>
                First: does the account exist?
              </p>
              <p
                style={{
                  font: "400 14px/1.7 var(--font-geist-sans)",
                  color: "#475569",
                  margin: "8px 0 0",
                }}
              >
                No handle has ever been recorded for {totals.unnamedBrands.join(" or ")} —{" "}
                <strong>{totals.unnamedPosts} written posts</strong> are queued behind{" "}
                {totals.unnamedBrands.length === 1 ? "it" : "them"}. If an account is never going to
                exist, say so and the brand comes off the schedule instead of writing into nothing.
                If it does exist, adding the handle in <code>brands.ts</code> is what stops this
                page asking.
              </p>
            </div>
          )}

          <h2 style={{ font: "700 19px/1.3 var(--font-geist-sans)", color: "#0f172a", margin: "34px 0 12px" }}>
            What&rsquo;s waiting on what
          </h2>

          <div style={{ display: "grid", gap: 10 }}>
            {rows.map((r) => (
              <div
                key={`${r.slug}:${r.platform}`}
                style={{ ...CARD, borderLeft: `3px solid ${r.colorHex}`, padding: "14px 16px" }}
              >
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "baseline" }}>
                  <strong style={{ font: "700 15px/1.4 var(--font-geist-sans)", color: "#0f172a" }}>
                    {r.name}
                  </strong>
                  <span style={{ font: "600 12.5px/1 var(--font-geist-sans)", color: "#64748b" }}>
                    {r.platform === "x" ? "X" : "Instagram"}
                  </span>
                  <span
                    style={{
                      font: "700 12px/1 var(--font-geist-sans)",
                      color: r.connected ? "#166534" : "#92400e",
                      background: r.connected ? "#dcfce7" : "#fef3c7",
                      borderRadius: 999,
                      padding: "5px 9px",
                    }}
                  >
                    {r.connected ? "connected" : "not connected"}
                  </span>
                  {r.handle ? (
                    <span style={{ font: "400 12.5px/1 var(--font-geist-sans)", color: "#64748b" }}>
                      {r.handle}
                    </span>
                  ) : (
                    <span
                      style={{
                        font: "700 12px/1 var(--font-geist-sans)",
                        color: "#b91c1c",
                        background: "#fef2f2",
                        borderRadius: 999,
                        padding: "5px 9px",
                      }}
                    >
                      no account recorded
                    </span>
                  )}
                  <span
                    style={{
                      marginLeft: "auto",
                      font: "400 13px/1.5 var(--font-geist-sans)",
                      color: "#475569",
                    }}
                  >
                    {r.sendable} post{r.sendable === 1 ? "" : "s"} waiting
                    {r.reels > 0 ? ` · ${r.reels} Reel${r.reels === 1 ? "" : "s"} by hand` : ""}
                  </span>
                </div>
                {r.connected && r.check && (
                  <p
                    style={{
                      font: "400 12.5px/1.6 var(--font-geist-sans)",
                      color: r.check.ok ? "#166534" : "#b91c1c",
                      margin: "9px 0 0",
                    }}
                  >
                    {r.check.ok
                      ? `The token answers as @${r.check.username}. Check that is the right account.`
                      : `The token isn't working: ${r.check.error ?? "no answer"}`}
                  </p>
                )}
                {!r.connected && (
                  <p
                    style={{
                      font: "400 12.5px/1.6 var(--font-geist-mono)",
                      color: "#64748b",
                      margin: "9px 0 0",
                    }}
                  >
                    needs {envNames(r.slug, r.platform).join(" + ")}
                    {r.platform === "x"
                      ? " (plus X_API_KEY and X_API_SECRET, once, covering all of them)"
                      : ""}
                  </p>
                )}
              </div>
            ))}
          </div>

          <Reels count={totals.reels} />
          <Steps />
          <Verifier />
        </>
      )}
    </main>
  );
}

function Reels({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div style={{ ...CARD, marginTop: 26, borderLeft: "3px solid #f59e0b", background: "#fffbeb" }}>
      <p style={{ font: "700 15px/1.5 var(--font-geist-sans)", color: "#92400e", margin: 0 }}>
        {count} of these are Reels, and connecting an account will not send them.
      </p>
      <p style={{ font: "400 13.5px/1.7 var(--font-geist-sans)", color: "#78350f", margin: "8px 0 0" }}>
        Publishing a video to Instagram is a different call — a REELS container, then polling Meta
        until it finishes processing — and it isn&rsquo;t built. The publisher refuses them rather
        than falling through to the poster frame, because a post written for a video going out as a
        still is worse than an error. Every Emeka Explores Instagram post is one of these.
      </p>
    </div>
  );
}

function Steps() {
  return (
    <>
      <h2 style={{ font: "700 19px/1.3 var(--font-geist-sans)", color: "#0f172a", margin: "38px 0 12px" }}>
        Getting the keys
      </h2>

      <div style={{ ...CARD, marginBottom: 12 }}>
        <h3 style={{ font: "700 15.5px/1.4 var(--font-geist-sans)", color: "#0f172a", margin: 0 }}>
          X — the shorter one, and where most of the waiting posts are
        </h3>
        <ol
          style={{
            font: "400 14px/1.75 var(--font-geist-sans)",
            color: "#334155",
            margin: "10px 0 0",
            paddingLeft: 22,
            // Tailwind's reset takes the markers off every list in the app, and
            // a numbered list with no numbers stops reading as steps at all.
            listStyle: "decimal outside",
          }}
        >
          <li>
            At <code>developer.x.com</code>, make one project and one app. One app covers every
            brand — only the per-account tokens differ.
          </li>
          <li>
            In the app&rsquo;s settings, set User authentication to <strong>Read and write</strong>.
            Doing this after generating tokens invalidates them, so do it first.
          </li>
          <li>
            Copy the <strong>API key</strong> and <strong>API key secret</strong>. Those belong to
            the app and go in once, as <code>X_API_KEY</code> and <code>X_API_SECRET</code>.
          </li>
          <li>
            Then, signed in as each brand&rsquo;s own account, generate an{" "}
            <strong>access token and secret</strong> for it. That pair is the per-brand part.
          </li>
        </ol>
        <p style={{ font: "400 13px/1.7 var(--font-geist-sans)", color: "#64748b", margin: "10px 0 0" }}>
          These don&rsquo;t expire. X charges per post — about 1.5&cent; each, and far more if a
          caption carries a link, which OmniPost captions don&rsquo;t.
        </p>
      </div>

      <div style={CARD}>
        <h3 style={{ font: "700 15.5px/1.4 var(--font-geist-sans)", color: "#0f172a", margin: 0 }}>
          Instagram — one thing has to be true before any of it works
        </h3>
        <ol
          style={{
            font: "400 14px/1.75 var(--font-geist-sans)",
            color: "#334155",
            margin: "10px 0 0",
            paddingLeft: 22,
            // Tailwind's reset takes the markers off every list in the app, and
            // a numbered list with no numbers stops reading as steps at all.
            listStyle: "decimal outside",
          }}
        >
          <li>
            The account has to be a <strong>Business or Creator</strong> account. It&rsquo;s free,
            it&rsquo;s in the Instagram app under account type, and no API can publish to a personal
            account. Nothing below works until this is done.
          </li>
          <li>
            At <code>developers.facebook.com</code>, create an app and add{" "}
            <strong>Instagram &rarr; Instagram API with Instagram Login</strong>. That&rsquo;s the
            route for accounts with no Facebook Page, which is all of these.
          </li>
          <li>
            Run its login flow once per account and exchange the short-lived token for a{" "}
            <strong>long-lived</strong> one.
          </li>
          <li>
            The account id comes from <code>graph.instagram.com/me?fields=user_id,username</code> — a
            number, not the @handle.
          </li>
        </ol>
        <p style={{ font: "400 13px/1.7 var(--font-geist-sans)", color: "#64748b", margin: "10px 0 0" }}>
          These tokens last 60 days and have to be refreshed. Paste whatever comes out into the box
          below before treating it as done — it will say which account it really belongs to.
        </p>
      </div>
    </>
  );
}

function Verifier() {
  const [platform, setPlatform] = useState<"x" | "instagram">("x");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    username?: string;
    note?: string;
    error?: string;
  } | null>(null);

  const spec: Array<[string, string]> =
    platform === "x"
      ? [
          ["apiKey", "API key"],
          ["apiSecret", "API key secret"],
          ["accessToken", "Access token (this brand's account)"],
          ["accessSecret", "Access token secret"],
        ]
      : [
          ["igUserId", "Instagram account id (numeric)"],
          ["token", "Long-lived access token"],
        ];

  async function check() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/connect/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform, ...fields }),
      });
      if (res.status === 401) {
        setResult({
          ok: false,
          error: "This device is locked — open /unlock once, then try again.",
        });
        return;
      }
      setResult(await res.json());
    } catch {
      setResult({ ok: false, error: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <h2 style={{ font: "700 19px/1.3 var(--font-geist-sans)", color: "#0f172a", margin: "38px 0 6px" }}>
        Check a credential before trusting it
      </h2>
      <p style={{ font: "400 14px/1.7 var(--font-geist-sans)", color: "#475569", margin: "0 0 14px" }}>
        Nothing typed here is saved anywhere — it is used once, against the platform, and dropped.
        What comes back is the account name the platform says it belongs to. Read that name: a
        working token for the wrong account is the failure worth catching here.
      </p>

      <div style={CARD}>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {(["x", "instagram"] as const).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPlatform(p);
                setFields({});
                setResult(null);
              }}
              style={{
                border: `1px solid ${platform === p ? "#4f46e5" : "#e2e8f0"}`,
                background: "#fff",
                borderRadius: 8,
                padding: "7px 13px",
                font: `${platform === p ? 700 : 500} 13px/1 var(--font-geist-sans)`,
                color: "#0f172a",
                cursor: "pointer",
              }}
            >
              {p === "x" ? "X" : "Instagram"}
            </button>
          ))}
        </div>

        {spec.map(([name, label]) => (
          <label key={name} style={{ display: "block", marginBottom: 10 }}>
            <span style={{ font: "600 12.5px/1.5 var(--font-geist-sans)", color: "#334155" }}>
              {label}
            </span>
            <input
              type={name.toLowerCase().includes("secret") || name === "token" ? "password" : "text"}
              value={fields[name] ?? ""}
              onChange={(e) => setFields((f) => ({ ...f, [name]: e.target.value }))}
              style={INPUT}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        ))}

        <button
          onClick={check}
          disabled={busy}
          style={{
            marginTop: 6,
            background: busy ? "#a5b4fc" : "#4f46e5",
            color: "#fff",
            font: "700 14px/1 var(--font-geist-sans)",
            border: "none",
            borderRadius: 9,
            padding: "13px 18px",
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? "Asking the platform…" : "Whose account is this?"}
        </button>

        {platform === "x" && (
          <p style={{ font: "400 12px/1.6 var(--font-geist-sans)", color: "#94a3b8", margin: "10px 0 0" }}>
            This makes one billed read against the X API. One — not one per keystroke.
          </p>
        )}

        {result && (
          <div
            style={{
              marginTop: 14,
              border: `1px solid ${result.ok ? "#bbf7d0" : "#fecaca"}`,
              background: result.ok ? "#f0fdf4" : "#fef2f2",
              borderRadius: 10,
              padding: "13px 15px",
            }}
          >
            <p
              style={{
                font: "700 15px/1.5 var(--font-geist-sans)",
                color: result.ok ? "#166534" : "#991b1b",
                margin: 0,
              }}
            >
              {result.ok ? `This belongs to ${result.username}` : result.error}
            </p>
            {result.ok && result.note && (
              <p style={{ font: "400 13px/1.6 var(--font-geist-sans)", color: "#3f6212", margin: "7px 0 0" }}>
                {result.note}
              </p>
            )}
            {result.ok && (
              <p style={{ font: "400 13px/1.6 var(--font-geist-sans)", color: "#166534", margin: "7px 0 0" }}>
                If that&rsquo;s the right account, it still has to be set as an environment variable
                and redeployed before the Post button will use it.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
