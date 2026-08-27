/**
 * Handing a finished post to the phone's own share sheet.
 *
 * ---------------------------------------------------------------------------
 * Why this exists
 *
 * 171 posts have been written here and one has ever been ticked off. The
 * publisher (lib/publish) is finished and would remove the problem entirely,
 * but it cannot send anything until real platform credentials exist, and every
 * one of those is his to create. Until then every post goes out by hand, and by
 * hand currently means: Copy caption → Save image → leave the browser → open
 * Instagram → new post → find the file in Photos → paste the words → share →
 * come back → tick. Nine steps, on a phone, per post, twice a day.
 *
 * `navigator.share` with a file collapses the middle of that: one tap opens the
 * real system share sheet with the picture (or the Reel) already attached, and
 * Instagram opens holding it. It is the same API the Photos app uses, so the
 * target list is his actual installed apps, not a guess.
 *
 * ---------------------------------------------------------------------------
 * The caption is copied, not shared, and that is deliberate
 *
 * Instagram's share target takes the media and throws away any accompanying
 * text — always has. Sharing the caption "to Instagram" would look like it
 * worked and then post a picture with no words, which is worse than not
 * offering it. So the caption goes to the clipboard in the same tap, and the
 * UI says so: attach here, paste there.
 *
 * X is the exception. Its share target composes text and image together
 * properly, so on an X post the text rides along AND is copied — the paste is
 * then a fallback rather than a requirement.
 *
 * ---------------------------------------------------------------------------
 * Transient activation, and why `primeShareFile` exists
 *
 * `navigator.share()` must be called while the browser still considers a user
 * gesture "live". Fetching several megabytes of Reel first spends that window,
 * and iOS Safari in particular then throws NotAllowedError. So the bytes are
 * fetched on pointer-down — before the click event exists — and the click
 * itself finds them already in hand. If the first tap still loses the race the
 * error says "tap Share again", and the second tap is instant because the file
 * is cached by then. Self-healing beats a spinner that fails silently.
 */

export type ShareResult =
  /** The share sheet opened and he picked something. */
  | { ok: true; media: boolean; captionCopied: boolean }
  /** He dismissed the sheet. Not an error, and must not be shown as one. */
  | { ok: false; reason: "cancelled" }
  /** This browser has no share sheet — desktop, mostly. Copy/Save still work. */
  | { ok: false; reason: "unsupported" }
  /** Something actually went wrong; `message` is in words meant for a person. */
  | { ok: false; reason: "failed"; message: string };

/**
 * Files already fetched, keyed by the /api/download URL that produced them.
 * Module-level on purpose: the sheet re-renders constantly and a cache inside a
 * component would be thrown away between the pointer-down and the click.
 */
const files = new Map<string, Promise<File>>();

/** Is there a share sheet at all? False on most desktops, true on phones. */
export function canSharePosts(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

function filenameFor(response: Response, type: string, fallback: string): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  if (match) return match[1];
  const ext = type.split("/")[1]?.split("+")[0] ?? "jpg";
  return `${fallback}.${ext}`;
}

async function loadFile(href: string): Promise<File> {
  const response = await fetch(href);
  if (!response.ok) {
    // /api/download answers JSON on failure and its `error` is already written
    // for a human — pass it through rather than inventing "something went wrong".
    let detail = `the file didn't load (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.error === "string") detail = body.error;
    } catch {
      /* not JSON; keep the status wording */
    }
    throw new Error(detail);
  }
  const blob = await response.blob();
  const type = blob.type || "image/jpeg";
  return new File([blob], filenameFor(response, type, "post"), { type });
}

/**
 * Start fetching a post's media now, so a share a moment later is instant.
 * Safe to call repeatedly — the second call gets the first one's promise.
 */
export function primeShareFile(href: string | null): void {
  if (!href || files.has(href)) return;
  files.set(
    href,
    loadFile(href).catch((error: unknown) => {
      // Don't cache a failure: a picture that 502'd once should be retried on
      // the next tap rather than being permanently unshareable this session.
      files.delete(href);
      throw error;
    }),
  );
}

async function copyCaption(caption: string): Promise<boolean> {
  if (!caption || typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(caption);
    return true;
  } catch {
    // Clipboard permission can be refused; the share is still worth doing.
    return false;
  }
}

export async function sharePost(options: {
  /** The /api/download URL for this post's picture or clip. */
  href: string | null;
  caption: string;
  platform: string;
}): Promise<ShareResult> {
  const { href, caption, platform } = options;
  if (!canSharePosts()) return { ok: false, reason: "unsupported" };

  // Clipboard first. It is the part that works everywhere, and if the share
  // sheet is then dismissed he still has the words — which is exactly the state
  // the old "Copy caption" button left him in, so nothing is ever lost.
  const captionCopied = await copyCaption(caption);

  let file: File | null = null;
  if (href) {
    primeShareFile(href);
    try {
      file = await files.get(href)!;
    } catch (error) {
      file = null;
      // Fall through: a post with no picture is still worth sharing as words.
      if (!caption) {
        return {
          ok: false,
          reason: "failed",
          message: error instanceof Error ? error.message : "the file didn't load",
        };
      }
    }
  }

  // See the header: text rides along on X, and only on X.
  const withText = platform === "x" && !!caption;
  const payload: ShareData =
    file && navigator.canShare?.({ files: [file] })
      ? withText
        ? { files: [file], text: caption }
        : { files: [file] }
      : { text: caption };

  const media = "files" in payload;
  if (!media && !caption) return { ok: false, reason: "failed", message: "nothing to share" };

  try {
    await navigator.share(payload);
    return { ok: true, media, captionCopied };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    // AbortError is him tapping outside the sheet. Reporting that as a failure
    // is how a working button starts looking broken.
    if (name === "AbortError") return { ok: false, reason: "cancelled" };
    if (name === "NotAllowedError") {
      return {
        ok: false,
        reason: "failed",
        message: "the file wasn't ready in time — tap Share again",
      };
    }
    return {
      ok: false,
      reason: "failed",
      message: error instanceof Error ? error.message : "the share sheet wouldn't open",
    };
  }
}
