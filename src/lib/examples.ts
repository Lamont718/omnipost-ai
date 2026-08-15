import { readFeedback } from "./feedback";
import { readCaptions } from "./store";
import type { Platform } from "./types";

/**
 * The posts he said worked, turned into tone examples for the next write.
 *
 * This is the only path by which anything this app has learned reaches the
 * thing that writes. Keep it narrow on purpose: examples teach REGISTER —
 * sentence length, how a hook opens, how hard the call to action pushes — and
 * nothing else. Every fabrication bug in this repo came from the model treating
 * nearby text as a source of facts, so the prompt that carries these says, in
 * as many words, that they are not.
 */

export interface Example {
  caption: string;
  platform: Platform;
  at: string;
}

export type ExampleBank = Record<string, Example[]>;

/** How many examples a single prompt may carry. */
const MAX_EXAMPLES = 3;

/** A slot id is brand:date:time:platform — the platform is the last segment. */
function platformOf(id: string): Platform | null {
  const tail = id.split(":").pop();
  return tail === "instagram" || tail === "facebook" || tail === "linkedin" || tail === "x"
    ? tail
    : null;
}

/**
 * Every caption he marked good, grouped by brand, newest first.
 *
 * Read once per generation run and passed down, not fetched per slot: a month
 * fill writes 75 captions and this would otherwise be 75 identical blob
 * listings.
 */
export async function loadExampleBank(): Promise<ExampleBank> {
  const [feedback, captions] = await Promise.all([readFeedback(), readCaptions()]);

  const bank: ExampleBank = {};
  for (const record of Object.values(feedback)) {
    if (record.verdict !== "good") continue;
    const caption = captions[record.id]?.caption;
    if (!caption) continue;
    const platform = platformOf(record.id);
    if (!platform) continue;

    (bank[record.brandSlug] ??= []).push({ caption, platform, at: record.at });
  }

  for (const list of Object.values(bank)) {
    list.sort((a, b) => b.at.localeCompare(a.at));
  }
  return bank;
}

/**
 * The examples to show when writing this brand on this platform.
 *
 * Same-platform first — a post that worked on X is the wrong length to imitate
 * on Instagram — then anything else for that brand, because two good examples
 * of the brand's voice beat one perfectly matched.
 */
export function pickExamples(
  bank: ExampleBank,
  brandSlug: string,
  platform: Platform,
  max = MAX_EXAMPLES,
): string[] {
  const all = bank[brandSlug] ?? [];
  const sameFirst = [
    ...all.filter((e) => e.platform === platform),
    ...all.filter((e) => e.platform !== platform),
  ];
  return sameFirst.slice(0, max).map((e) => e.caption);
}
