import { BRANDS } from "./brands";
import { Platform } from "./types";

/**
 * Which social accounts a brand can actually publish to, and the credentials
 * for each.
 *
 * Credentials live in environment variables, not in this file and not in the
 * Blob store. Two reasons. A token in code ends up in git history, and these
 * are tokens that can post to a real audience under Lamont's name. And Vercel
 * env vars can be marked sensitive, which means even the dashboard will not
 * read them back — the value exists to be used, not to be looked at.
 *
 * The naming convention is the brand slug, uppercased, hyphens to underscores:
 *
 *   emeka-explores  ->  META_PAGE_TOKEN_EMEKA_EXPLORES
 *   heart-of-the-block -> META_PAGE_TOKEN_HEART_OF_THE_BLOCK
 *
 * Per brand:
 *
 *   META_PAGE_TOKEN_<SLUG>   long-lived Facebook Page access token. One token
 *                            serves both Instagram publishing and Facebook Page
 *                            posting, because IG publishing is authorised
 *                            through the Page the IG account is linked to.
 *   IG_USER_ID_<SLUG>        the Instagram *Business* account id (a number, not
 *                            the @handle). Absent = brand can't post to IG.
 *   FB_PAGE_ID_<SLUG>        the Facebook Page id. Absent = no FB posting.
 *   X_ACCESS_TOKEN_<SLUG>    per-account OAuth 1.0a token…
 *   X_ACCESS_SECRET_<SLUG>   …and its secret.
 *
 * App-wide (one X developer app covers every account):
 *
 *   X_API_KEY / X_API_SECRET   the app's consumer key and secret.
 *   META_API_VERSION           optional pin, e.g. "v21.0".
 *
 * Nothing here throws when a variable is missing. A brand with no credentials
 * is simply not connected, the Post button doesn't appear for it, and the rest
 * of the app carries on exactly as before — which is the state every brand is
 * in until Lamont has done the Meta console work.
 */

/** Slug to the shape used in environment variable names. */
export function envSuffix(slug: string): string {
  return slug.toUpperCase().replace(/-/g, "_");
}

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export interface InstagramAccount {
  igUserId: string;
  pageToken: string;
}

export interface FacebookAccount {
  pageId: string;
  pageToken: string;
}

export interface XAccount {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessSecret: string;
}

export function instagramAccount(slug: string): InstagramAccount | null {
  const s = envSuffix(slug);
  const igUserId = env(`IG_USER_ID_${s}`);
  const pageToken = env(`META_PAGE_TOKEN_${s}`);
  return igUserId && pageToken ? { igUserId, pageToken } : null;
}

export function facebookAccount(slug: string): FacebookAccount | null {
  const s = envSuffix(slug);
  const pageId = env(`FB_PAGE_ID_${s}`);
  const pageToken = env(`META_PAGE_TOKEN_${s}`);
  return pageId && pageToken ? { pageId, pageToken } : null;
}

export function xAccount(slug: string): XAccount | null {
  const s = envSuffix(slug);
  const consumerKey = env("X_API_KEY");
  const consumerSecret = env("X_API_SECRET");
  const accessToken = env(`X_ACCESS_TOKEN_${s}`);
  const accessSecret = env(`X_ACCESS_SECRET_${s}`);
  return consumerKey && consumerSecret && accessToken && accessSecret
    ? { consumerKey, consumerSecret, accessToken, accessSecret }
    : null;
}

/**
 * LinkedIn is deliberately absent.
 *
 * Posting to a LinkedIn Page needs the Community Management API, and that one
 * genuinely does require partner approval — there is no development-mode route
 * the way there is with Meta. None of the six active brands schedules a
 * LinkedIn slot today, so building it would be work for nobody.
 */
export function isPublishable(platform: Platform): boolean {
  return platform === "instagram" || platform === "facebook" || platform === "x";
}

export function isConnected(slug: string, platform: Platform): boolean {
  if (platform === "instagram") return !!instagramAccount(slug);
  if (platform === "facebook") return !!facebookAccount(slug);
  if (platform === "x") return !!xAccount(slug);
  return false;
}

/**
 * What's wired up, for the UI to show — never the values themselves.
 *
 * The point of this is that the sheet can say "Instagram isn't connected yet"
 * on the row rather than letting the button fail at the moment of posting.
 */
export interface BrandReadiness {
  slug: string;
  name: string;
  instagram: boolean;
  facebook: boolean;
  x: boolean;
}

export function readiness(): BrandReadiness[] {
  return BRANDS.filter((b) => b.active).map((b) => ({
    slug: b.slug,
    name: b.name,
    instagram: !!instagramAccount(b.slug),
    facebook: !!facebookAccount(b.slug),
    x: !!xAccount(b.slug),
  }));
}
