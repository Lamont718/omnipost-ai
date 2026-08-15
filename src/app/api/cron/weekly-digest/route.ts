import { NextResponse } from "next/server";
import { scheduledPostsInRange } from "@/lib/schedule";
import { brandBySlug } from "@/lib/brands";
import { composePost } from "@/lib/compose";
import { compactCaptions, readCaptions, writeCaptions, CaptionMap } from "@/lib/store";
import { loadExampleBank, pickExamples } from "@/lib/examples";
import { readAllFacts, factsForSlot } from "@/lib/facts";

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
 *   N days ahead:        …&days=14
 *   From a given day:    …&start=2026-09-06&days=28
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

    // Don't pay to rewrite what already exists. Every run used to regenerate
    // every slot in range, so a second run cost a full week of tokens and
    // replaced captions that were already reviewed. `&force=1` restores the old
    // behaviour when a reroll really is wanted.
    const force = params.get("force") === "1";
    let skipped = 0;
    if (!force) {
      const already = await readCaptions();
      const before = slots.length;
      slots = slots.filter((s) => !already[s.id]?.caption);
      skipped = before - slots.length;
    }

    const captions: CaptionMap = {};
    const failures: string[] = [];

    // Loaded once for the whole run. A month fill writes 75 captions, and
    // fetching these per slot would be 75 identical blob listings each.
    const [exampleBank, allFacts] = await Promise.all([loadExampleBank(), readAllFacts()]);

    // Generate concurrently — sequential overruns the function timeout.
    await Promise.all(
      slots.map(async (slot) => {
        const brand = brandBySlug(slot.brandSlug);
        if (!brand) return;
        try {
          const post = await composePost({
            brand,
            topic: { title: slot.topic.title, context: slot.topic.context },
            platform: slot.platform,
            examples: pickExamples(exampleBank, slot.brandSlug, slot.platform),
            brandFacts: factsForSlot(allFacts[slot.brandSlug]?.facts ?? [], slot.id),
          });
          // Store the topic with the caption, not just the caption. Topics are
          // re-derived on every read, so without this the pairing is guesswork
          // the next time a sitemap or a source rule changes.
          captions[slot.id] = {
            ...post,
            generatedAt: new Date().toISOString(),
            topic: slot.topic,
          };
        } catch (err) {
          failures.push(`${slot.brandSlug} ${slot.date}: ${err instanceof Error ? err.message : err}`);
        }
      }),
    );

    if (preview) {
      return NextResponse.json({
        written: false,
        range: { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) },
        generated: Object.keys(captions).length,
        skipped,
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
