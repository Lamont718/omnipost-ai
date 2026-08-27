"use client";

import { useEffect, useState } from "react";
import { canSharePosts, primeShareFile, sharePost } from "@/lib/share-post";

/**
 * One tap: picture into Instagram, caption onto the clipboard.
 *
 * The whole argument for this button is in lib/share-post.ts. What matters here
 * is what it says afterwards. "Shared ✓" on its own would be a lie of omission —
 * Instagram drops the words — so the success state names both halves of what
 * just happened ("caption copied — paste it"), and a dismissed share sheet says
 * nothing at all, because he dismissed it on purpose.
 *
 * It renders only where a share sheet exists, which in practice means his phone.
 * On a desktop there is nothing to hand a file to, so Copy caption and Save
 * image stay exactly as they were rather than being joined by a button that
 * fails on press.
 */
export function ShareButton({
  href,
  caption,
  platform,
  isVideo,
  style,
  onShared,
}: {
  /** The /api/download URL for this post's artwork or clip. */
  href: string | null;
  caption: string;
  platform: string;
  isVideo: boolean;
  /** The page's own button styling, so this doesn't invent a third look. */
  style: React.CSSProperties;
  /** Fired once the sheet has actually been used — the cue to go tick it off. */
  onShared?: () => void;
}) {
  // Checked after mount, never during render: `navigator` does not exist on the
  // server, and a button that appears in the HTML and then vanishes is the
  // hydration mismatch that bit the theme toggle on the other sites.
  const [available, setAvailable] = useState(false);
  useEffect(() => setAvailable(canSharePosts()), []);

  const [state, setState] = useState<"idle" | "working" | "done" | "words">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!available || !caption) return null;

  async function go() {
    setError(null);
    setState("working");
    const result = await sharePost({ href, caption, platform });
    if (result.ok) {
      setState(result.media ? "done" : "words");
      onShared?.();
      return;
    }
    setState("idle");
    // Cancelled and unsupported are both "nothing happened" — say nothing.
    if (result.reason === "failed") setError(result.message);
  }

  const label =
    state === "working"
      ? "Opening…"
      : state === "done"
        ? "Shared — caption copied ✓"
        : state === "words"
          ? "Caption shared ✓"
          : `Share ${isVideo ? "Reel" : "post"} ↗`;

  const live = state === "done" || state === "words";

  return (
    <>
      <button
        className="no-print"
        // Fetch the bytes before the click exists. See share-post.ts.
        onPointerDown={() => primeShareFile(href)}
        onClick={go}
        disabled={state === "working"}
        style={{
          ...style,
          background: live ? "#f0fdf4" : "#4f46e5",
          borderColor: live ? "#bbf7d0" : "#4f46e5",
          color: live ? "#15803d" : "#fff",
          cursor: state === "working" ? "wait" : "pointer",
        }}
      >
        {label}
      </button>
      {error && (
        <span className="no-print" style={{ fontSize: 11.5, color: "#b91c1c" }}>
          {error}
        </span>
      )}
    </>
  );
}
