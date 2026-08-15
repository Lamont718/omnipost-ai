"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The "posted" ticks, shared by the sheet and the calendar.
 *
 * One hook rather than two copies of the same logic, because the two pages
 * disagreeing about what's been posted is the bug this is fixing, only smaller.
 *
 * How it behaves, and why:
 *
 *  - It paints from localStorage first. The server round trip takes a moment
 *    and a work-list that flashes "nothing posted" before correcting itself is
 *    worse than one that's briefly a few seconds stale.
 *  - Then the server answer replaces it wholesale. The server is the truth;
 *    merging the two would resurrect anything un-ticked on another device.
 *  - Except once. The first time a browser talks to the server it hands over
 *    the ticks it accumulated back when this was localStorage-only, so months
 *    of ticking off don't vanish the day this shipped. After that the flag in
 *    `omnipost.posted.synced` stops it, because from then on "in the browser
 *    but not on the server" means un-ticked elsewhere, not new.
 *  - Writes are optimistic. The tick moves the instant it's pressed and is
 *    reported as unsynced only if the save actually fails.
 */

const LS_POSTED = "omnipost.posted";
const LS_SYNCED = "omnipost.posted.synced";
const LS_PENDING = "omnipost.posted.pending";

/**
 * How long a tick made in this browser outranks the server's answer.
 *
 * Blob's `list()` is eventually consistent: a record written a second ago is
 * often not in the next listing. Measured here — a tick saved successfully, and
 * the immediately following read came back empty. Without this window the
 * sequence "tick a post, refresh the page" would show the tick vanishing, even
 * though it saved perfectly, and the natural response to that is to tick it
 * again.
 *
 * Ten minutes, the same grace the caption store uses for the same reason.
 */
const PENDING_MS = 10 * 60 * 1000;

export type PostedMap = Record<string, string>;

/** What this browser has changed recently, and which way. */
type Pending = Record<string, { posted: boolean; at: string }>;

function loadLocal(): PostedMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(LS_POSTED) || "{}");
  } catch {
    return {};
  }
}

function saveLocal(map: PostedMap) {
  try {
    localStorage.setItem(LS_POSTED, JSON.stringify(map));
  } catch {
    // Private browsing, quota, a locked-down webview — the server copy is the
    // one that matters, so losing the cache is not worth surfacing.
  }
}

function loadPending(): Pending {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(localStorage.getItem(LS_PENDING) || "{}") as Pending;
    // Drop anything past its window on the way in, so the file can't grow
    // forever and an old entry can't outrank the server months later.
    const cutoff = Date.now() - PENDING_MS;
    const live: Pending = {};
    for (const [id, entry] of Object.entries(raw)) {
      if (entry?.at && Date.parse(entry.at) >= cutoff) live[id] = entry;
    }
    return live;
  } catch {
    return {};
  }
}

function savePending(pending: Pending) {
  try {
    localStorage.setItem(LS_PENDING, JSON.stringify(pending));
  } catch {
    /* see saveLocal */
  }
}

/**
 * The server's answer, with this browser's recent changes laid back over it.
 * Recent local intent wins; anything older than the window defers to the server,
 * which by then is authoritative and may carry another device's un-tick.
 */
function applyPending(server: PostedMap, pending: Pending): PostedMap {
  const out = { ...server };
  for (const [id, entry] of Object.entries(pending)) {
    if (entry.posted) out[id] = entry.at;
    else delete out[id];
  }
  return out;
}

export interface UsePosted {
  /** Slot id → ISO timestamp it was ticked. */
  posted: PostedMap;
  toggle: (id: string) => void;
  /** True once the server's answer has landed. */
  loaded: boolean;
  /**
   * Set when a tick could not be saved to the server, so the page can say the
   * count may not travel to the phone instead of silently lying.
   */
  syncError: boolean;
}

export function usePosted(): UsePosted {
  const [posted, setPosted] = useState<PostedMap>({});
  const [loaded, setLoaded] = useState(false);
  const [syncError, setSyncError] = useState(false);

  useEffect(() => {
    const local = loadLocal();
    setPosted(local);

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/posted", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          posted?: { id: string; markedAt: string }[];
          stored?: boolean;
        };

        const server: PostedMap = {};
        for (const r of data.posted ?? []) server[r.id] = r.markedAt;

        // Without a blob store there is nothing to sync with; keep the local
        // ticks exactly as they were rather than wiping them with an empty
        // server answer.
        if (data.stored === false) {
          if (!cancelled) setLoaded(true);
          return;
        }

        let merged = server;
        const alreadySynced =
          typeof window !== "undefined" && localStorage.getItem(LS_SYNCED) === "1";

        if (!alreadySynced) {
          const mine = Object.keys(local).filter((id) => !server[id]);
          if (mine.length) {
            const handover: PostedMap = {};
            for (const id of mine) handover[id] = local[id];
            const adopt = await fetch("/api/posted", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ marks: handover }),
            });
            if (adopt.ok) merged = { ...server, ...handover };
          }
          try {
            localStorage.setItem(LS_SYNCED, "1");
          } catch {
            /* see saveLocal */
          }
        }

        // A tick made moments ago may not be in that listing yet — see PENDING_MS.
        const pending = loadPending();
        savePending(pending);
        merged = applyPending(merged, pending);

        if (cancelled) return;
        setPosted(merged);
        saveLocal(merged);
        setLoaded(true);
      } catch {
        // Offline, or the route is down. The local ticks still work exactly as
        // they did before this existed.
        if (!cancelled) {
          setLoaded(true);
          setSyncError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback((id: string) => {
    let wantsPosted = true;
    const at = new Date().toISOString();

    setPosted((current) => {
      const next = { ...current };
      if (next[id]) {
        delete next[id];
        wantsPosted = false;
      } else {
        next[id] = at;
      }
      saveLocal(next);
      return next;
    });

    // Remembered separately from the cache so the next page load can tell
    // "I just changed this" from "this is what the server said last time".
    const pending = loadPending();
    pending[id] = { posted: wantsPosted, at };
    savePending(pending);

    fetch("/api/posted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, posted: wantsPosted }),
    })
      .then((res) => res.json())
      .then((data: { stored?: boolean }) => setSyncError(!data?.stored))
      .catch(() => setSyncError(true));
  }, []);

  return { posted, toggle, loaded, syncError };
}
