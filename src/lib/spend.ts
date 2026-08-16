/**
 * A ceiling on what one generation run can cost.
 *
 * The Shop has had one of these for months; this app never did. Nothing has
 * gone wrong, but the shape of the risk is obvious: a month fill is a loop that
 * calls a paid API once per slot, and the only thing bounding it is that the
 * loop is finite. A bad `days` value, a retry that doesn't terminate, or a
 * future caller that fills a year all spend real money with nothing in the way.
 *
 * This is a soft cap, and says so. Generation runs concurrently — up to a
 * month of slots at once — so the check happens before each request rather
 * than mid-flight: requests already in the air when the cap is reached will
 * finish and be counted. It bounds new work, not the exact total.
 */

/** Anthropic list prices, US dollars per million tokens. */
const PRICING: Record<string, { input: number; output: number }> = {
  // The model composePost uses. $5 / $25 per million.
  "claude-opus-4-8": { input: 5, output: 25 },
};

/** Cache reads bill at ~0.1x input, writes at ~1.25x. */
const CACHE_READ_MULTIPLIER = 0.1;
const CACHE_WRITE_MULTIPLIER = 1.25;

/**
 * What one API response reports back.
 *
 * Every field is optional AND nullable: the SDK's own `Usage` type returns
 * `number | null` for the cache counters, so a `number | undefined` shape here
 * refuses to accept the very object it exists to measure.
 */
export interface TokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface Budget {
  /** Add one response's usage to the running total. */
  record(model: string, usage: TokenUsage): void;
  /** Dollars spent so far, to the nearest cent. */
  spent(): number;
  /** True once the cap is reached — checked before starting new work. */
  exceeded(): boolean;
  readonly limit: number;
  /** How many responses have been counted. */
  calls(): number;
}

export function costOf(model: string, usage: TokenUsage): number {
  const price = PRICING[model];
  // An unpriced model is a real gap, not a free one. Treating it as $0 would
  // silently disable the cap the moment the model string changes.
  if (!price) {
    console.warn(`[spend] no price for model ${model} — counting as uncapped`);
    return 0;
  }

  const perInputToken = price.input / 1_000_000;
  const perOutputToken = price.output / 1_000_000;

  return (
    (usage.input_tokens ?? 0) * perInputToken +
    (usage.output_tokens ?? 0) * perOutputToken +
    (usage.cache_read_input_tokens ?? 0) * perInputToken * CACHE_READ_MULTIPLIER +
    (usage.cache_creation_input_tokens ?? 0) * perInputToken * CACHE_WRITE_MULTIPLIER
  );
}

/**
 * What one caption actually costs, measured rather than assumed.
 *
 * Eight captions came to $0.12 on 15 August 2026 — Opus 4.8, adaptive thinking,
 * medium effort, roughly 1.5 cents each. Used to estimate a run before it
 * starts; re-measure if the model, effort, or prompt size changes materially.
 */
export const COST_PER_CAPTION_USD = 0.015;

/**
 * The per-run default, in dollars.
 *
 * Sized off that measurement, not a round number picked to feel safe. The
 * largest legitimate run this app performs is a month for every brand — about
 * 75 captions, so roughly $1.13. The first draft of this constant was $1, which
 * would have blocked exactly that run; measuring first is the only reason it
 * isn't still $1. Five dollars sits comfortably above the real ceiling while
 * still standing in the way of a runaway.
 */
export const DEFAULT_RUN_BUDGET_USD = 5;

/** What a run of this many captions should cost, before it starts. */
export function estimateRun(captions: number): number {
  return Math.round(captions * COST_PER_CAPTION_USD * 100) / 100;
}

export function createBudget(limit = DEFAULT_RUN_BUDGET_USD): Budget {
  let total = 0;
  let calls = 0;

  return {
    limit,
    record(model, usage) {
      total += costOf(model, usage);
      calls += 1;
    },
    spent() {
      return Math.round(total * 100) / 100;
    },
    exceeded() {
      return total >= limit;
    },
    calls() {
      return calls;
    },
  };
}

/** Thrown by composePost when the run's cap is already reached. */
export class BudgetExceededError extends Error {
  constructor(spent: number, limit: number) {
    super(`run budget reached: $${spent.toFixed(2)} of $${limit.toFixed(2)}`);
    this.name = "BudgetExceededError";
  }
}
