import { NextResponse } from "next/server";
import { maskAddress, readSends } from "@/lib/sent-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Did the emails go out?
 *
 *   GET /api/sent
 *
 * Newest first. The recipient is masked on the way out — see lib/sent-log.ts.
 * `storing: false` means there is no blob token, so nothing is being recorded
 * and an empty list means "not watching" rather than "nothing sent". Those are
 * different answers and the page has to be able to tell them apart.
 */
export async function GET() {
  const sends = await readSends();
  return NextResponse.json(
    {
      storing: !!process.env.BLOB_READ_WRITE_TOKEN,
      sends: sends.map((s) => ({ ...s, to: maskAddress(s.to) })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
