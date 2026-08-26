/**
 * The lock on the front door.
 *
 * Every page and route in this app sits on a public URL with no login. That was
 * harmless while the app only ever *wrote* things for a human to copy. It stops
 * being harmless the moment two of these routes exist:
 *
 *   POST /api/generate   spends real money at Anthropic, once per call.
 *   POST /api/publish    posts to a real audience under his name, once per call.
 *
 * Neither had anything in front of it. Nobody has found the URL, which is not
 * the same thing as being safe — and the day publishing is connected is exactly
 * the day the second one matters.
 *
 * So: one key, and it is checked in middleware rather than in each route, so a
 * route added next month is covered without anyone remembering to cover it.
 *
 * ---------------------------------------------------------------------------
 * What the key is
 *
 * `APP_KEY` if it is set, and `CRON_SECRET` as well — always both, never one or
 * the other. CRON_SECRET is accepted because it is already in Production and
 * already in every script and curl that talks to this app; dropping it would
 * break the tooling to gain nothing, since anyone holding it can already fire
 * the cron. APP_KEY exists so the key that ends up in his email is not the same
 * string as the one that runs the crons.
 *
 * If neither is set, the gate refuses instead of waving everything through. A
 * missing env var must not be able to silently unlock the door — that is the
 * one failure mode worth being loud about, and it is a one-line fix when it
 * happens.
 */

export const GATE_COOKIE = "omnipost_key";

/** Every accepted key. Empty means the app is misconfigured, not open. */
function keys(): string[] {
  return [process.env.APP_KEY, process.env.CRON_SECRET]
    .map((v) => (v ?? "").trim())
    .filter(Boolean);
}

export function gateConfigured(): boolean {
  return keys().length > 0;
}

/** Length-independent compare, so a wrong key leaks nothing by how long it takes. */
function matches(candidate: string): boolean {
  let ok = false;
  for (const key of keys()) {
    if (key.length !== candidate.length) continue;
    let diff = 0;
    for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ candidate.charCodeAt(i);
    if (diff === 0) ok = true;
  }
  return ok;
}

/**
 * Three ways in, in the order they're worth trying.
 *
 * The cookie is how a phone stays unlocked after one tap. The bearer header is
 * how Vercel's cron authenticates. The query parameter is how a curl or a node
 * script does — including every diagnostic script in the notes, which is the
 * reason it is here at all.
 */
export function presentedKey(request: Request, cookieValue?: string | null): string | null {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();

  const params = new URL(request.url).searchParams;
  const query = params.get("key") ?? params.get("secret");
  if (query) return query.trim();

  return cookieValue?.trim() || null;
}

export function keyAccepted(candidate: string | null | undefined): boolean {
  if (!gateConfigured()) return false;
  if (!candidate) return false;
  return matches(candidate);
}

/** The key to hand out — the app one if it exists, so the cron's stays private. */
export function shareableKey(): string | null {
  const appKey = (process.env.APP_KEY ?? "").trim();
  if (appKey) return appKey;
  const cron = (process.env.CRON_SECRET ?? "").trim();
  return cron || null;
}
