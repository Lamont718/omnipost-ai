import { createHmac, randomBytes } from "crypto";

/**
 * OAuth 1.0a request signing, for X.
 *
 * X's v2 write endpoints accept either OAuth 2.0 with PKCE or OAuth 1.0a user
 * context. OAuth 2.0 is the newer of the two and the wrong choice here: its
 * access tokens expire in two hours and have to be refreshed, which means a
 * refresh-token store, a rotation path, and a way for the whole thing to fail
 * silently at 3am. OAuth 1.0a tokens for an account you own do not expire. You
 * generate them once in the developer portal, paste them into the environment,
 * and they keep working.
 *
 * That trade only holds because these are Lamont's own accounts. If OmniPost
 * ever posted on someone else's behalf it would need the OAuth 2.0 flow.
 *
 * Signing is HMAC-SHA1 over a canonical string, exactly as the spec lays out.
 * The two details worth stating, because both fail quietly:
 *
 *  - Percent-encoding is RFC 3986, which is stricter than encodeURIComponent:
 *    ! * ' ( ) must also be escaped or the signature won't match.
 *  - Only query-string parameters and the oauth_* parameters are signed. A JSON
 *    or multipart body is NOT part of the signature base. Signing the body is
 *    the classic way to get a 401 that looks like bad credentials.
 */

/** RFC 3986 percent-encoding — encodeURIComponent leaves six characters short. */
function pct(value: string): string {
  return encodeURIComponent(value).replace(
    /[!*'()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export interface Oauth1Credentials {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessSecret: string;
}

/**
 * Build the `Authorization: OAuth …` header for a request.
 *
 * `url` must include any query string; its parameters are folded into the
 * signature. The body is never signed — see the note above.
 */
export function authorizationHeader(
  method: "GET" | "POST",
  url: string,
  creds: Oauth1Credentials,
  /**
   * Fixed nonce and timestamp. Only for tests — signing is the kind of code
   * that is either exactly right or silently returns 401, and the only way to
   * know which is to reproduce a signature someone else published.
   */
  fixed?: { nonce?: string; timestamp?: string },
): string {
  const parsed = new URL(url);

  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: fixed?.nonce ?? randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: fixed?.timestamp ?? Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0",
  };

  // Query parameters and oauth parameters together, sorted by encoded key.
  const params: Array<[string, string]> = [];
  parsed.searchParams.forEach((value, key) => params.push([key, value]));
  for (const [key, value] of Object.entries(oauth)) params.push([key, value]);

  const normalised = params
    .map(([k, v]) => [pct(k), pct(v)] as const)
    .sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  // The signature base uses the URL with its query string stripped.
  const baseUrl = `${parsed.origin}${parsed.pathname}`;
  const base = [method.toUpperCase(), pct(baseUrl), pct(normalised)].join("&");
  const signingKey = `${pct(creds.consumerSecret)}&${pct(creds.accessSecret)}`;
  const signature = createHmac("sha1", signingKey).update(base).digest("base64");

  const header = { ...oauth, oauth_signature: signature };
  return (
    "OAuth " +
    Object.entries(header)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${pct(k)}="${pct(v)}"`)
      .join(", ")
  );
}
