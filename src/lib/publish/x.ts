import { XAccount } from "../accounts";
import { authorizationHeader } from "./oauth1";

/**
 * Publishing to X.
 *
 * Two endpoints from two different API generations, which is not a mistake:
 * posting is v2, but uploading media is still the v1.1 endpoint, and there is
 * no v2 replacement. Both are signed the same way.
 *
 * Cost, because it is the one platform here that charges per post: X ended its
 * free tier for new developers in February 2026 and moved to pay-per-use at
 * $0.015 a post, rising to $0.20 if the post contains a link. OmniPost captions
 * carry no links by design, so at roughly 25 X posts a month this runs to about
 * forty cents. Worth knowing before anyone adds a link to a caption template.
 */

const TWEETS = "https://api.twitter.com/2/tweets";
const MEDIA_UPLOAD = "https://upload.twitter.com/1.1/media/upload.json";

const REQUEST_TIMEOUT_MS = 45_000;
/** X rejects images above 5MB on the simple upload path. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface XPostResult {
  remoteId: string;
  permalink: string;
}

/**
 * Upload an image and return its media id.
 *
 * The body is multipart, and multipart bodies are NOT part of an OAuth 1.0a
 * signature — only the query string and the oauth_* parameters are. Getting
 * that wrong produces a 401 that reads exactly like bad credentials, so it is
 * worth being explicit: nothing about `form` reaches the signing function.
 */
async function uploadMedia(account: XAccount, imageUrl: string): Promise<string> {
  const image = await fetch(imageUrl, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!image.ok) throw new Error(`could not fetch the image (${image.status})`);

  const bytes = new Uint8Array(await image.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new Error(`image is ${Math.round(bytes.byteLength / 1024 / 1024)}MB — X accepts up to 5MB`);
  }

  const form = new FormData();
  form.append("media", new Blob([bytes]), "post.jpg");

  const res = await fetch(MEDIA_UPLOAD, {
    method: "POST",
    headers: { Authorization: authorizationHeader("POST", MEDIA_UPLOAD, account) },
    body: form,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`media upload failed (${res.status}): ${text.slice(0, 300)}`);

  const body = JSON.parse(text) as { media_id_string?: string };
  if (!body.media_id_string) throw new Error("media upload returned no media id");
  return body.media_id_string;
}

export async function publishToX(
  account: XAccount,
  text: string,
  imageUrl?: string,
): Promise<XPostResult> {
  const mediaId = imageUrl ? await uploadMedia(account, imageUrl) : undefined;

  const payload: Record<string, unknown> = { text };
  if (mediaId) payload.media = { media_ids: [mediaId] };

  const res = await fetch(TWEETS, {
    method: "POST",
    headers: {
      Authorization: authorizationHeader("POST", TWEETS, account),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const raw = await res.text();
  if (!res.ok) {
    // X puts the useful part in `detail`; `title` alone is usually just
    // "Unauthorized" or "Forbidden".
    let detail = raw.slice(0, 300);
    try {
      const parsed = JSON.parse(raw) as { detail?: string; title?: string };
      detail = parsed.detail ?? parsed.title ?? detail;
    } catch {
      // Non-JSON error body — the truncated text is the best available message.
    }
    throw new Error(`X returned ${res.status}: ${detail}`);
  }

  const body = JSON.parse(raw) as { data?: { id?: string } };
  const remoteId = body.data?.id;
  if (!remoteId) throw new Error("X returned no post id");

  return { remoteId, permalink: `https://x.com/i/web/status/${remoteId}` };
}
