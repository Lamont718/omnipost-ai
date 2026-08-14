import { FacebookAccount, InstagramAccount } from "../accounts";

/**
 * Publishing to Instagram and Facebook Pages.
 *
 * Both go through the Graph API on one Page access token, because an Instagram
 * Business account publishes via the Facebook Page it is linked to.
 *
 * The thing worth knowing before reading any of this: none of it needs Meta App
 * Review. Review is what gates letting OTHER people connect THEIR accounts. An
 * app left in development mode, with your own accounts added as testers, can
 * publish to those accounts on day one. That is the entire reason this was
 * worth building instead of paying a scheduler forever.
 */

const API_VERSION = process.env.META_API_VERSION || "v21.0";
const GRAPH = `https://graph.facebook.com/${API_VERSION}`;

/** Meta can take a few seconds to fetch and process the image. */
const CONTAINER_POLL_ATTEMPTS = 10;
const CONTAINER_POLL_MS = 2000;
const REQUEST_TIMEOUT_MS = 30_000;

export interface MetaPostResult {
  remoteId: string;
  permalink?: string;
}

/**
 * Graph errors arrive as 200-with-an-error-body about as often as they arrive
 * as a 4xx, so both paths have to be checked. The message is what actually
 * tells you what went wrong — "The image is not a valid JPEG" and "requires
 * instagram_content_publish permission" are very different problems, and a bare
 * status code hides which one you have.
 */
async function graph(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  let body: Record<string, unknown>;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new Error(`Graph API returned ${res.status} with a non-JSON body`);
  }

  const error = body.error as { message?: string; code?: number; error_subcode?: number } | undefined;
  if (error) {
    const code = error.code ? ` (code ${error.code}${error.error_subcode ? `/${error.error_subcode}` : ""})` : "";
    throw new Error(`${error.message ?? "Graph API error"}${code}`);
  }
  if (!res.ok) {
    throw new Error(`Graph API returned ${res.status}`);
  }
  return body;
}

/**
 * Instagram is a two-step publish: build a media container from a public image
 * URL, then publish the container.
 *
 * Meta fetches `imageUrl` from its own servers, so it has to be publicly
 * reachable — which is why the image is handed over as a URL on this app rather
 * than uploaded. It also has to be a JPEG. `next/og` renders PNG, so every
 * generated card is converted on the way out; see /api/image-jpeg.
 */
export async function publishToInstagram(
  account: InstagramAccount,
  caption: string,
  imageUrl: string,
): Promise<MetaPostResult> {
  const create = new URL(`${GRAPH}/${account.igUserId}/media`);
  create.searchParams.set("image_url", imageUrl);
  create.searchParams.set("caption", caption);
  create.searchParams.set("access_token", account.pageToken);

  const container = await graph(create.toString(), { method: "POST" });
  const containerId = String(container.id ?? "");
  if (!containerId) throw new Error("Instagram did not return a media container id");

  await waitForContainer(containerId, account.pageToken);

  const publish = new URL(`${GRAPH}/${account.igUserId}/media_publish`);
  publish.searchParams.set("creation_id", containerId);
  publish.searchParams.set("access_token", account.pageToken);

  const published = await graph(publish.toString(), { method: "POST" });
  const remoteId = String(published.id ?? "");
  if (!remoteId) throw new Error("Instagram did not return a post id");

  return { remoteId, permalink: await permalinkFor(remoteId, account.pageToken) };
}

/**
 * A container is not necessarily ready the instant it is created — Meta still
 * has to go and fetch the image. Publishing an unfinished container fails with
 * a misleading error, so this waits for FINISHED and surfaces the real reason
 * on ERROR, which is nearly always the image being the wrong format or too big.
 */
async function waitForContainer(containerId: string, token: string): Promise<void> {
  for (let attempt = 0; attempt < CONTAINER_POLL_ATTEMPTS; attempt++) {
    const url = new URL(`${GRAPH}/${containerId}`);
    url.searchParams.set("fields", "status_code,status");
    url.searchParams.set("access_token", token);

    const body = await graph(url.toString());
    const status = String(body.status_code ?? "");

    if (status === "FINISHED") return;
    if (status === "ERROR" || status === "EXPIRED") {
      throw new Error(`Instagram could not process the image: ${String(body.status ?? status)}`);
    }
    await new Promise((r) => setTimeout(r, CONTAINER_POLL_MS));
  }
  throw new Error("Instagram is still processing the image — try again in a minute");
}

async function permalinkFor(mediaId: string, token: string): Promise<string | undefined> {
  try {
    const url = new URL(`${GRAPH}/${mediaId}`);
    url.searchParams.set("fields", "permalink");
    url.searchParams.set("access_token", token);
    const body = await graph(url.toString());
    return typeof body.permalink === "string" ? body.permalink : undefined;
  } catch {
    // The post is already live at this point. Not being able to name its URL is
    // a cosmetic failure and must never be reported as a failed publish.
    return undefined;
  }
}

/**
 * Facebook Pages publish a photo with its caption in one call, which is why
 * there is no container dance here.
 *
 * Unlike Instagram, Facebook accepts PNG perfectly well — but the same
 * converted JPEG is passed anyway, so both platforms are demonstrably sending
 * the identical bytes and there is one fewer difference to debug.
 */
export async function publishToFacebook(
  account: FacebookAccount,
  caption: string,
  imageUrl: string,
): Promise<MetaPostResult> {
  const url = new URL(`${GRAPH}/${account.pageId}/photos`);
  url.searchParams.set("url", imageUrl);
  url.searchParams.set("caption", caption);
  url.searchParams.set("published", "true");
  url.searchParams.set("access_token", account.pageToken);

  const body = await graph(url.toString(), { method: "POST" });
  // /photos returns the photo id plus the id of the post it created; the
  // post_id is the one a human can open.
  const remoteId = String(body.post_id ?? body.id ?? "");
  if (!remoteId) throw new Error("Facebook did not return a post id");

  return {
    remoteId,
    permalink: body.post_id ? `https://www.facebook.com/${String(body.post_id)}` : undefined,
  };
}
