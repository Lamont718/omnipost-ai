import { NextRequest, NextResponse } from "next/server";
import { readAllFacts, writeFacts } from "@/lib/facts";
import { activeBrands, brandBySlug } from "@/lib/brands";
import { poolSizeFor } from "@/lib/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The brand facts behind /facts.
 *
 *   GET  /api/facts                       → every brand's facts
 *   POST /api/facts {brandSlug, facts[]}  → replace one brand's facts
 *
 * POST replaces rather than appends: the editor is a textarea showing
 * everything at once, so what he saves is the whole truth as he means it,
 * including a line he deleted on purpose.
 */

/** Long enough to be a real fact, short enough to stay a fact and not a post. */
const MAX_FACT_LENGTH = 300;
const MAX_FACTS = 20;

export async function GET() {
  const facts = await readAllFacts();
  return NextResponse.json(
    {
      facts,
      // The editor needs the brand list anyway, and serving it here keeps the
      // page from needing a second round trip or a hardcoded copy that drifts
      // out of date — which is exactly how the landing page ended up
      // advertising three dead brands.
      brands: await Promise.all(
        activeBrands().map(async (b) => ({
          slug: b.slug,
          name: b.name,
          colorHex: b.colorHex,
          /** No sitemap means evergreen-only: nothing but these facts to write from. */
          hasSources: (b.sources?.length ?? 0) > 0,
          /**
           * The two numbers that explain repetition: how many distinct pages
           * the brand can write about, against how many posts a month it owes.
           * A brand picking 4 posts out of 5 pages will repeat itself; one
           * picking 24 out of 97 never will.
           */
          pages: await poolSizeFor(b),
          postsPerMonth: Math.round((b.schedule?.length ?? 0) * 4.35),
        })),
      ),
      stored: !!process.env.BLOB_READ_WRITE_TOKEN,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: NextRequest) {
  let body: { brandSlug?: unknown; facts?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "expected a JSON body" }, { status: 400 });
  }

  const brandSlug = typeof body.brandSlug === "string" ? body.brandSlug.trim() : "";
  if (!brandSlug) {
    return NextResponse.json({ error: "brandSlug is required" }, { status: 400 });
  }
  // An unknown slug used to be the quiet failure mode in the cron — it filtered
  // everything away and reported success. Here it would save facts nothing will
  // ever read.
  if (!brandBySlug(brandSlug)) {
    return NextResponse.json({ error: `Unknown brand: ${brandSlug}` }, { status: 404 });
  }

  if (!Array.isArray(body.facts)) {
    return NextResponse.json({ error: "facts must be an array of strings" }, { status: 400 });
  }
  if (body.facts.length > MAX_FACTS) {
    return NextResponse.json({ error: `at most ${MAX_FACTS} facts` }, { status: 400 });
  }
  const facts = body.facts.map((f) => String(f ?? ""));
  if (facts.some((f) => f.length > MAX_FACT_LENGTH)) {
    return NextResponse.json(
      { error: `each fact must be under ${MAX_FACT_LENGTH} characters` },
      { status: 400 },
    );
  }

  const saved = await writeFacts(brandSlug, facts);
  if (!saved) {
    return NextResponse.json({ error: "could not save — no blob store" }, { status: 500 });
  }

  return NextResponse.json({ ...saved, stored: true });
}
