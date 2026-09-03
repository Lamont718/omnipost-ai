import { NextResponse } from "next/server";
import { scheduledPostsInRange } from "@/lib/schedule";
import { brandBySlug } from "@/lib/brands";
import { PLATFORMS } from "@/lib/types";
import { composePost } from "@/lib/compose";
import {
  compactCaptions,
  priorCaptionsForTopic,
  readCaptions,
  recentOpenings,
  writeCaptions,
  CaptionMap,
} from "@/lib/store";
import { loadExampleBank, pickExamples } from "@/lib/examples";
import { readAllFacts, factsForSlot } from "@/lib/facts";
import {
  videosFor,
  pickVideoForSlot,
  pinnable,
  platformPlaysVideo,
  platformRequiresVideo,
} from "@/lib/video-library";
import { createBudget, estimateRun, DEFAULT_RUN_BUDGET_USD } from "@/lib/spend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Weekly generation run — writes the coming week's captions into the store so
 * they're already on the calendar when the week starts. This replaces the old
 * email digest: the calendar is the deliverable now, not an inbox.
 *
 * Cron is `0 12 * * 1` UTC = 8am Monday in New York (EDT). It fills the seven
 * days starting today, so Monday's run covers Mon–Sun.
 *
 * Triggered by Vercel Cron (Authorization: Bearer $CRON_SECRET). By hand:
 *   Fill the week now:   GET /api/cron/weekly-digest?secret=$CRON_SECRET
 *   Preview, no writes:  …&preview=1
 *   One brand only:      …&brand=yodm
 *   One platform only:   …&platform=tiktok
 *   N days ahead:        …&days=14
 *   From a given day:    …&start=2026-09-06&days=28
 *   Raise the cap:       …&budget=10        (dollars; default 5)
 *
 * Every run is capped. It refuses up front if the slot count would cost more
 * than the budget, and stops mid-run if the real spend gets there anyway; the
 * response always reports `spentUsd`. A full month for every brand is about 57
 * slots and $0.86, so the default only ever bites on something that has gone
 * wrong.
 *
 * `days` is capped at 31 and counted from `start` (today by default), so filling
 * a month that doesn't begin today — catching up the back half of September, say
 * — needs `start`. Dates are read as local midnight, same as the default.
 *
 * Each caption is saved with the topic it was written from, and the calendar
 * shows that stored topic rather than re-deriving one. So this run is also the
 * only way a slot that's already written can move onto a new topic: `&force=1`
 * regenerates from current discovery and re-pins. Everything else — the
 * calendar's Rewrite button included — rerolls the wording and keeps the
 * subject.
 *
 * Requires BLOB_READ_WRITE_TOKEN to persist. Without it, generation still runs
 * and preview works, but nothing is saved (the calendar then generates on
 * demand instead).
 */
function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get("authorization") === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get("secret") === secret;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const preview = params.get("preview");
  const onlyBrand = params.get("brand");
  /*
   * One platform only.
   *
   * Added 2026-09-03, when YODM went back onto TikTok. Restoring a slot brings
   * back every caption ever written for it — the ids are brand:date:time:platform
   * and nothing was deleted — so nine posts returned still pinned to the podcast
   * clips and the cards the old rotation had given them, which is exactly what
   * the slot came off for. Fixing that needs `force`, and forcing a whole brand
   * would have rewritten thirty-three Instagram and X posts nobody asked about.
   */
  const onlyPlatform = params.get("platform");
  const days = Math.min(Math.max(Number(params.get("days")) || 7, 1), 31);

  const startParam = params.get("start");
  const start = new Date();
  if (startParam) {
    const [y, m, d] = startParam.split("-").map(Number);
    if (!y || !m || !d) {
      return NextResponse.json({ error: "start must be YYYY-MM-DD" }, { status: 400 });
    }
    start.setFullYear(y, m - 1, d);
  }
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + days - 1);

  try {
    let slots = await scheduledPostsInRange(start, end);
    if (onlyBrand) {
      // A slug that matches nothing used to filter every slot away and then
      // report a clean run, so `brand=mosthatednba` (the real slug is
      // `mosthated`) looked like success and wrote no posts at all.
      if (!brandBySlug(onlyBrand)) {
        return NextResponse.json({ error: `Unknown brand: ${onlyBrand}` }, { status: 400 });
      }
      slots = slots.filter((s) => s.brandSlug === onlyBrand);
    }

    if (onlyPlatform) {
      // Same guard as the brand filter above, for the same reason: a platform
      // that matches nothing must say so rather than report a clean run.
      if (!(PLATFORMS as readonly string[]).includes(onlyPlatform)) {
        return NextResponse.json(
          { error: `platform must be one of: ${PLATFORMS.join(", ")}` },
          { status: 400 },
        );
      }
      slots = slots.filter((s) => s.platform === onlyPlatform);
    }

    // Don't pay to rewrite what already exists. Every run used to regenerate
    // every slot in range, so a second run cost a full week of tokens and
    // replaced captions that were already reviewed. `&force=1` restores the old
    // behaviour when a reroll really is wanted.
    const force = params.get("force") === "1";
    // Read unconditionally now, not only when skipping: the writer is shown
    // what this brand has already said about the same topic, and a forced
    // reroll needs that just as much as a first pass does.
    const already = await readCaptions();
    let skipped = 0;
    if (!force) {
      const before = slots.length;
      slots = slots.filter((s) => !already[s.id]?.caption);
      skipped = before - slots.length;
    }

    const captions: CaptionMap = {};
    const failures: string[] = [];

    // Loaded once for the whole run. A month fill writes 75 captions, and
    // fetching these per slot would be 75 identical blob listings each.
    const [exampleBank, allFacts] = await Promise.all([loadExampleBank(), readAllFacts()]);

    // Clip libraries, one listing per brand in the run rather than one per slot.
    // A month fill for a brand with video is 13 slots; without this it would be
    // 13 identical blob listings.
    const videoBrands = Array.from(new Set(slots.map((s) => s.brandSlug)));
    const videos = new Map(
      await Promise.all(
        videoBrands.map(async (slug) => [slug, await videosFor(slug)] as const),
      ),
    );

    // A ceiling on this run. `?budget=` raises it for a deliberately large fill.
    const budget = createBudget(Number(params.get("budget")) || DEFAULT_RUN_BUDGET_USD);

    // Refuse an oversized run before spending anything. This is the guard that
    // actually catches a runaway — a bad `days`, a caller filling a year — and
    // it has to happen here, because once generation starts the answer costs
    // money to discover.
    const estimate = estimateRun(slots.length);
    if (estimate > budget.limit) {
      return NextResponse.json(
        {
          error: "run would exceed its budget",
          slots: slots.length,
          estimatedUsd: estimate,
          budgetUsd: budget.limit,
          hint: "raise it deliberately with &budget=<dollars>, or narrow the range",
        },
        { status: 400 },
      );
    }

    // Generated concurrently — sequential overruns the function timeout — but
    // in chunks rather than all at once, because the running cap is only real
    // if something records a cost before the next batch decides to start. With
    // one flat Promise.all every slot checks the budget while the total is
    // still zero, and a cap that every caller passes is not a cap.
    const CONCURRENCY = 12;
    for (let i = 0; i < slots.length; i += CONCURRENCY) {
      if (budget.exceeded()) break;
      await Promise.all(
        slots.slice(i, i + CONCURRENCY).map(async (slot) => {
          const brand = brandBySlug(slot.brandSlug);
          if (!brand) return;
          try {
            // A still-only topic takes no clip — and the decision has to happen
            // HERE, not just where artwork is resolved, because `media` below
            // tells the writer a video is on screen. Choosing the clip and then
            // refusing to show it would leave a caption written about footage
            // nobody sees.
            // pageImageWins means the page has a picture better than a generic
            // clip — a judgement that only makes sense where a still is a legal
            // post. On TikTok it is not, so the clip wins regardless.
            const wantsClip =
              platformPlaysVideo(slot.platform) &&
              (platformRequiresVideo(slot.platform) || !slot.topic.pageImageWins);
            const clip = wantsClip
              ? pickVideoForSlot(
                  videos.get(slot.brandSlug) ?? [],
                  slot.id,
                  slot.topic.url ?? slot.topic.title,
                )
              : null;
            // TikTok has no still to fall back to — see platformRequiresVideo.
            if (platformRequiresVideo(slot.platform) && !clip) {
              failures.push(
                `${slot.brandSlug} ${slot.date}: TikTok slot with no clip available — nothing written`,
              );
              return;
            }
            const post = await composePost({
              brand,
              topic: { title: slot.topic.title, context: slot.topic.context, url: slot.topic.url },
              platform: slot.platform,
              examples: pickExamples(exampleBank, slot.brandSlug, slot.platform),
              // Against what is already stored plus what this run has written
              // so far. Within one twelve-slot chunk the writes are concurrent,
              // so two slots on the same topic in the same chunk can still miss
              // each other — across chunks and across runs they do not.
              alreadySaid: priorCaptionsForTopic(
                { ...already, ...captions },
                slot.brandSlug,
                slot.topic,
                slot.id,
              ),
              brandFacts: factsForSlot(allFacts[slot.brandSlug]?.facts ?? [], slot.id),
              budget,
              media: clip ? { kind: "video", describes: clip.describes } : undefined,
              postDate: slot.date,
              recentOpenings: recentOpenings({ ...already, ...captions }, slot.brandSlug, slot.id),
            });
            // Store the topic with the caption, not just the caption. Topics are
            // re-derived on every read, so without this the pairing is guesswork
            // the next time a sitemap or a source rule changes.
            captions[slot.id] = {
              ...post,
              generatedAt: new Date().toISOString(),
              topic: slot.topic,
              // Pinned for the same reason as the topic: what the caption was
              // written against is the thing worth keeping.
              ...(clip ? { video: pinnable(clip) } : {}),
            };
          } catch (err) {
            failures.push(
              `${slot.brandSlug} ${slot.date}: ${err instanceof Error ? err.message : err}`,
            );
          }
        }),
      );
    }

    if (preview) {
      return NextResponse.json({
        written: false,
        range: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
        generated: Object.keys(captions).length,
        skipped,
        spentUsd: budget.spent(),
        budgetUsd: budget.limit,
        budgetReached: budget.exceeded(),
        failures,
        sample: slots.slice(0, 20).map((s) => ({
          date: s.date,
          time: s.time,
          platform: s.platform,
          brand: s.brandName,
          caption: captions[s.id]?.caption ?? null,
        })),
      });
    }

    // Persist first via the path that never reads and so cannot clobber, and
    // only then compact. Durability no longer rides on the read-merge-write:
    // if compaction writes a stale base, these parts are still there and the
    // next read layers them back over it.
    const persisted = await writeCaptions(captions);
    const result = await compactCaptions(captions);

    return NextResponse.json({
      written: result.total > 0,
      generated: Object.keys(captions).length,
      persisted,
      skipped,
      storedTotal: result.total,
      partsCompacted: result.partsCleared,
      partsKept: result.partsKept,
      // Reported on every run, not only when it trips. A cap nobody can see
      // the reading of is a cap nobody trusts — and this is also the only
      // place the real cost of a fill has ever been visible.
      spentUsd: budget.spent(),
      budgetUsd: budget.limit,
      budgetReached: budget.exceeded(),
      failures,
      note: result.total === 0 ? "BLOB_READ_WRITE_TOKEN not set — nothing saved" : undefined,
    });
  } catch (error) {
    console.error("weekly generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}
