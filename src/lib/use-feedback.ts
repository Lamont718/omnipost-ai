"use client";

import { useCallback, useEffect, useState } from "react";
import type { Verdict } from "./feedback";

/**
 * Did it work? — the client half of lib/feedback.ts.
 *
 * Same shape as usePosted and for the same reasons: paint from localStorage,
 * take the server's answer, and let a judgement made in the last ten minutes
 * outrank it, because Blob's list() is eventually consistent and a thumb that
 * vanishes on refresh is a thumb pressed twice.
 *
 * No one-time handover here — unlike the posted ticks, this never lived in a
 * browser, so there is no history to rescue.
 */

const LS_CACHE = "omnipost.feedback";
const LS_PENDING = "omnipost.feedback.pending";
const PENDING_MS = 10 * 60 * 1000;

export type FeedbackMap = Record<string, Verdict>;
type Pending = Record<string, { verdict: Verdict | null; at: string }>;

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or quota — the server copy is the one that matters.
  }
}

function livePending(): Pending {
  const raw = load<Pending>(LS_PENDING, {});
  const cutoff = Date.now() - PENDING_MS;
  const live: Pending = {};
  for (const [id, entry] of Object.entries(raw)) {
    if (entry?.at && Date.parse(entry.at) >= cutoff) live[id] = entry;
  }
  return live;
}

function applyPending(server: FeedbackMap, pending: Pending): FeedbackMap {
  const out = { ...server };
  for (const [id, entry] of Object.entries(pending)) {
    if (entry.verdict) out[id] = entry.verdict;
    else delete out[id];
  }
  return out;
}

export interface UseFeedback {
  feedback: FeedbackMap;
  /** Press the same verdict twice to clear it. */
  judge: (id: string, brandSlug: string, verdict: Verdict) => void;
  count: number;
}

export function useFeedback(): UseFeedback {
  const [feedback, setFeedback] = useState<FeedbackMap>({});

  useEffect(() => {
    setFeedback(load<FeedbackMap>(LS_CACHE, {}));

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/feedback", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as {
          feedback?: { id: string; verdict: Verdict }[];
          stored?: boolean;
        };
        if (data.stored === false) return;

        const server: FeedbackMap = {};
        for (const r of data.feedback ?? []) server[r.id] = r.verdict;

        const pending = livePending();
        save(LS_PENDING, pending);
        const merged = applyPending(server, pending);

        if (cancelled) return;
        setFeedback(merged);
        save(LS_CACHE, merged);
      } catch {
        // Offline: the cached judgements stay on screen and nothing is lost.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const judge = useCallback((id: string, brandSlug: string, verdict: Verdict) => {
    const at = new Date().toISOString();
    let next: Verdict | null = verdict;

    setFeedback((current) => {
      const updated = { ...current };
      if (updated[id] === verdict) {
        delete updated[id];
        next = null;
      } else {
        updated[id] = verdict;
      }
      save(LS_CACHE, updated);
      return updated;
    });

    const pending = livePending();
    pending[id] = { verdict: next, at };
    save(LS_PENDING, pending);

    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, brandSlug, verdict: next }),
    }).catch(() => {
      // The local copy still shows it; the next successful load reconciles.
    });
  }, []);

  return { feedback, judge, count: Object.keys(feedback).length };
}
