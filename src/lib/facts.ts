/**
 * Things that are true about a brand, typed by the person who knows them.
 *
 * Why this exists: WWSH has five postable pages on communitynyc.org, which
 * discovery turns into about two distinct topics a month. October's nine posts
 * came from `/about-us` five times and `/basketball` four, and three of them
 * opened with the identical sentence — "Brooklyn shows up for Brooklyn." That
 * is not a model problem. There was nothing else true to say, because the only
 * grounding available was a thin page description.
 *
 * The fix has been "get real facts from Lamont" for weeks, which never happened
 * because it required him to write an email. So it's a page instead: he types
 * five true things about WWSH once, and every post that brand writes has
 * something specific to reach for.
 *
 * These are VERIFIED — a human wrote them down deliberately. That is exactly
 * what the grounding rule in compose.ts asks for and never had enough of, and
 * it is the opposite of the failure mode this repo keeps hitting, where the
 * model fills a thin brief by inventing something plausible.
 *
 * One blob per brand. Unlike captions and ticks these are edited wholesale by
 * one person at one keyboard, so a plain read-modify-write is fine here.
 */

const PREFIX = "facts/";

export interface BrandFacts {
  brandSlug: string;
  /** One fact per entry. Short, specific, true. */
  facts: string[];
  updatedAt: string;
}

function hasBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function factsPath(slug: string): string {
  return `${PREFIX}${encodeURIComponent(slug)}.json`;
}

export async function readAllFacts(): Promise<Record<string, BrandFacts>> {
  if (!hasBlob()) return {};
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: PREFIX });

    const out: Record<string, BrandFacts> = {};
    const fetched = await Promise.all(
      blobs.map(async (b) => {
        try {
          const res = await fetch(`${b.url}?t=${Date.now()}`, { cache: "no-store" });
          return res.ok ? ((await res.json()) as BrandFacts) : null;
        } catch {
          return null;
        }
      }),
    );
    for (const record of fetched) {
      if (record?.brandSlug) out[record.brandSlug] = record;
    }
    return out;
  } catch (err) {
    console.error("readAllFacts failed:", err);
    return {};
  }
}

export async function writeFacts(brandSlug: string, facts: string[]): Promise<BrandFacts | null> {
  if (!hasBlob()) return null;

  // Blank lines are how a textarea says nothing; they must not become a fact
  // the model is invited to use.
  const cleaned = facts.map((f) => f.trim()).filter(Boolean);
  const record: BrandFacts = {
    brandSlug,
    facts: cleaned,
    updatedAt: new Date().toISOString(),
  };

  try {
    const { put } = await import("@vercel/blob");
    await put(factsPath(brandSlug), JSON.stringify(record), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return record;
  } catch (err) {
    console.error(`writeFacts failed for ${brandSlug}:`, err);
    return null;
  }
}

/**
 * The brand's facts, rotated so different posts reach for different ones first.
 *
 * Without this the model would meet the same list in the same order every time
 * and reliably lead with the first item — which is the duplicate-opening
 * problem these facts exist to solve, reintroduced one level up. Deterministic
 * on the slot id, so a post keeps its ordering across regenerations.
 */
export function factsForSlot(facts: string[], slotId: string): string[] {
  if (facts.length < 2) return facts;
  let hash = 0;
  for (let i = 0; i < slotId.length; i++) {
    hash = (hash * 31 + slotId.charCodeAt(i)) >>> 0;
  }
  const offset = hash % facts.length;
  return [...facts.slice(offset), ...facts.slice(0, offset)];
}
