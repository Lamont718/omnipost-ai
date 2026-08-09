import { NextResponse } from "next/server";
import { scheduledPostsInRange } from "@/lib/schedule";
import { brandBySlug } from "@/lib/brands";
import { composePost } from "@/lib/compose";
import { compactCaptions, readCaptions, CaptionMap } from "@/lib/store";

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

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + days - 1);

  try {
    let slots = await scheduledPostsInRange(start, end);
    if (onlyBrand) slots = slots.filter((s) => s.brandSlug === onlyBrand);

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
          });
          captions[slot.id] = { ...post, generatedAt: new Date().toISOString() };
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

    // Compaction rather than a plain write: this run is the only writer, so it
    // can safely fold the on-demand parts into the base file and clear them,
    // which is what keeps reads from getting slower every week.
    const result = await compactCaptions(captions);

    return NextResponse.json({
      written: result.total > 0,
      generated: Object.keys(captions).length,
      skipped,
      storedTotal: result.total,
      partsCompacted: result.partsCleared,
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
