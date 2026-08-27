/**
 * Whether the emails this app sends actually go out.
 *
 * ---------------------------------------------------------------------------
 * Why
 *
 * "Did anything from the 8am email ever arrive?" has been an open question for
 * three sessions and the app had no way to answer it. The cron fires twice a
 * day, returns JSON to a machine nobody reads, and leaves no trace — so a
 * missing RESEND_API_KEY, a bounced address and a working send that simply went
 * unopened all look identical from here.
 *
 * Every send attempt now writes one record. Not the email, and not its
 * contents — just: which one, for what day, did Resend accept it, and if not,
 * what it said. The one thing a delivery log must never do is claim more than
 * it knows: Resend accepting a message is not the same as a human reading it,
 * so `sent: true` means accepted for delivery and the UI says exactly that.
 *
 * The log starts the day it ships. It cannot say anything about the mornings
 * before it existed, and nothing here should imply otherwise.
 *
 * ---------------------------------------------------------------------------
 * The address is stored and never handed back
 *
 * The record keeps the real recipient because a log that can't tell you where a
 * message went is not a log. `/api/sent` is a read, and reads are open on this
 * app by design — so what leaves the server is masked. His email address is not
 * something a public URL should hand to whoever finds it.
 */

const PREFIX = "sent/";

/**
 * Only the 8am nudge sends mail. The other cron — `weekly-digest` — is named
 * for a digest it no longer is: it writes next week's captions and emails
 * nobody. Left as a union of one so a second sender can be added without
 * reshaping every stored record.
 */
export type SendKind = "daily";

export interface SendRecord {
  kind: SendKind;
  /** The day the email was *about*, not the moment it was sent. */
  date: string;
  /** ISO timestamp of the attempt. */
  at: string;
  /** True only when the provider accepted the message. */
  sent: boolean;
  /** Why not, in the provider's own words, when it wasn't. */
  reason?: string;
  /** How many posts the email was carrying, so an empty morning is explicable. */
  due?: number;
  to: string;
}

function hasBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/** One record per kind per day: a re-send replaces the attempt it retried. */
function recordPath(kind: SendKind, date: string): string {
  return `${PREFIX}${kind}-${date}.json`;
}

/** `lamont@example.com` → `l****t@example.com`. Enough to recognise, not to use. */
export function maskAddress(address: string): string {
  const at = address.indexOf("@");
  if (at < 1) return "…";
  const name = address.slice(0, at);
  const domain = address.slice(at);
  if (name.length <= 2) return `${name[0]}…${domain}`;
  return `${name[0]}${"*".repeat(Math.min(name.length - 2, 6))}${name[name.length - 1]}${domain}`;
}

export async function recordSend(record: SendRecord): Promise<boolean> {
  if (!hasBlob()) return false;
  try {
    const { put } = await import("@vercel/blob");
    await put(recordPath(record.kind, record.date), JSON.stringify(record), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 0,
    });
    return true;
  } catch (err) {
    // A log that can take down the thing it is logging is worse than no log.
    // The email has already been sent by the time this runs; failing to record
    // it must never turn a successful morning into a 500.
    console.error("recordSend failed:", err);
    return false;
  }
}

/** Every attempt, newest first. */
export async function readSends(): Promise<SendRecord[]> {
  if (!hasBlob()) return [];
  try {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({ prefix: PREFIX });
    const fetched = await Promise.all(
      blobs.map(async (b) => {
        try {
          const res = await fetch(`${b.url}?t=${Date.now()}`, { cache: "no-store" });
          return res.ok ? ((await res.json()) as SendRecord) : null;
        } catch {
          return null;
        }
      }),
    );
    return fetched
      .filter((r): r is SendRecord => !!r?.at)
      .sort((a, b) => b.at.localeCompare(a.at));
  } catch (err) {
    console.error("readSends failed:", err);
    return [];
  }
}
