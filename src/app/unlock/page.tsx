"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

/**
 * The one screen he should almost never see.
 *
 * The morning email carries an unlock link, so a phone that reads the email
 * unlocks itself and stays unlocked for a year. This page is the fallback for a
 * laptop, a cleared cookie, or a link that got mangled by a mail client — and
 * for that reason it explains what the lock is for rather than just demanding a
 * password, because a bare password box on an app that has never had one reads
 * as somebody else's login screen.
 */

const INPUT: React.CSSProperties = {
  width: "100%",
  fontSize: 16, // 16 or iOS zooms the whole page on focus.
  padding: "12px 14px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
};

function Unlock() {
  const params = useSearchParams();
  const [key, setKey] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "ok">("idle");
  const [error, setError] = useState<string | null>(
    params.get("bad") ? "That link's key didn't match. Paste it by hand below." : null,
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!key.trim()) return;
    setState("sending");
    setError(null);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: key.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error ?? "That didn't work.");
        setState("idle");
        return;
      }
      setState("ok");
    } catch {
      setError("Couldn't reach the server.");
      setState("idle");
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "48px 20px" }}>
      <h1 style={{ font: "700 26px/1.25 var(--font-geist-sans)", color: "#0f172a", margin: 0 }}>
        Unlock this device
      </h1>
      <p style={{ font: "400 15px/1.65 var(--font-geist-sans)", color: "#475569", margin: "10px 0 0" }}>
        Reading the calendar never needs this. Posting, writing captions and editing the
        facts do, because those spend money or go out to a real audience — and this app
        lives on a public URL with no login.
      </p>

      {state === "ok" ? (
        <div
          style={{
            marginTop: 26,
            border: "1px solid #bbf7d0",
            background: "#f0fdf4",
            borderRadius: 12,
            padding: "16px 18px",
          }}
        >
          <p style={{ font: "600 15px/1.6 var(--font-geist-sans)", color: "#166534", margin: 0 }}>
            Unlocked. This device stays unlocked for a year.
          </p>
          <p style={{ margin: "12px 0 0" }}>
            <Link href="/sheet" style={{ color: "#4f46e5", fontWeight: 700, fontSize: 15 }}>
              Go to today&rsquo;s posts &rarr;
            </Link>
          </p>
        </div>
      ) : (
        <form onSubmit={submit} style={{ marginTop: 26 }}>
          <label
            htmlFor="key"
            style={{ display: "block", font: "600 13px/1.5 var(--font-geist-sans)", color: "#334155", marginBottom: 8 }}
          >
            Key
          </label>
          <input
            id="key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="paste it from the bottom of the 8am email"
            style={INPUT}
          />
          {error && (
            <p style={{ font: "500 13.5px/1.6 var(--font-geist-sans)", color: "#b91c1c", margin: "10px 0 0" }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={state === "sending" || !key.trim()}
            style={{
              marginTop: 16,
              width: "100%",
              background: state === "sending" ? "#a5b4fc" : "#4f46e5",
              color: "#fff",
              font: "700 15px/1 var(--font-geist-sans)",
              border: "none",
              borderRadius: 10,
              padding: "15px 20px",
              cursor: state === "sending" ? "default" : "pointer",
            }}
          >
            {state === "sending" ? "Checking…" : "Unlock"}
          </button>
        </form>
      )}

      <p style={{ font: "400 12.5px/1.65 var(--font-geist-sans)", color: "#94a3b8", margin: "26px 0 0" }}>
        The key is at the bottom of every morning email, as a link — tapping it here does the
        same thing without any typing.
      </p>
    </main>
  );
}

export default function UnlockPage() {
  // useSearchParams needs a boundary or the whole route opts out of static rendering.
  return (
    <Suspense fallback={null}>
      <Unlock />
    </Suspense>
  );
}
