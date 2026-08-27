import { readPosted } from "./posted";
import { readPublished } from "./published";
import { buildSlotViews, SlotView } from "./schedule-view";
import { readCaptions } from "./store";
import { todayInZone } from "./daily";

/**
 * The posts that were written and then went by.
 *
 * ---------------------------------------------------------------------------
 * Why this is a feature and not a report
 *
 * 171 posts have been written here. 49 of them are now in the past and 48 of
 * those went out to nobody — the caption exists, the picture exists, the day
 * arrived, and nothing happened. That is the single largest pile of finished,
 * paid-for work in the app, and until now there was no way to see it: the sheet
 * loads one month at a time and hides the past by default, so a post that slid
 * by on the 12th became invisible on the 1st of the next month.
 *
 * Almost none of it is actually expired. A villain page, a debate card, "this
 * is what the block does" — the reason those were scheduled for a Tuesday was
 * cadence, not news. So they are inventory, not history, and the only thing
 * standing between them and an audience is somebody seeing them again.
 *
 * Newest first, on purpose. A post from three days ago is more likely to still
 * fit than one from six weeks ago, and a list that opens with the oldest thing
 * he ever missed reads as a debt rather than a queue.
 *
 * ---------------------------------------------------------------------------
 * What counts as missed
 *
 * Written, dated before today, and carrying neither a manual tick nor a publish
 * record. Both are checked because they mean different things — the tick is him
 * saying he posted it from his phone, the record is the app having sent it — and
 * a post is done if either is true. Absence of both is the only honest way to
 * say "this never went anywhere".
 */

/** How far back the scan reaches, taken from the oldest caption that exists. */
function earliestWrittenDate(ids: string[]): string | null {
  let earliest: string | null = null;
  for (const id of ids) {
    const match = id.match(/:(\d{4}-\d{2}-\d{2}):/);
    if (!match) continue;
    if (!earliest || match[1] < earliest) earliest = match[1];
  }
  return earliest;
}

export async function missedPosts(today = todayInZone()): Promise<SlotView[]> {
  const captions = await readCaptions();
  const earliest = earliestWrittenDate(Object.keys(captions));
  if (!earliest) return [];

  // Midday anchors, never midnight: `new Date("2026-08-31")` is UTC midnight,
  // which is the 30th in New York, and a window built from it loses a day at
  // each end.
  const start = new Date(`${earliest}T12:00:00`);
  const end = new Date(`${today}T12:00:00`);
  end.setDate(end.getDate() - 1);
  if (start > end) return [];

  const [views, posted, published] = await Promise.all([
    buildSlotViews(start, end),
    readPosted(),
    readPublished(),
  ]);

  return views
    .filter((v) => v.caption && v.date < today && !posted[v.id] && !published[v.id])
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}
