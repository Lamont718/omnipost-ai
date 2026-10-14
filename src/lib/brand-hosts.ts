import { BRANDS } from "./brands";

/**
 * Hostnames of every brand's topic sources, plus their www/bare variants.
 *
 * Any route that takes a URL from the browser and fetches it has to check
 * against this first. Without it, a handcrafted query string would make the
 * server fetch anything reachable from inside Vercel's network on the caller's
 * behalf, which is the whole shape of an SSRF.
 */
export function allowedHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const brand of BRANDS) {
    for (const source of brand.sources) {
      // A source can be a hand-written topic list with no sitemap; it fetches
      // nothing, so it puts no host on the allowlist.
      if (!source.sitemap) continue;
      try {
        const host = new URL(source.sitemap).hostname.toLowerCase();
        hosts.add(host);
        hosts.add(host.replace(/^www\./, ""));
        if (!host.startsWith("www.")) hosts.add(`www.${host}`);
      } catch {
        // A malformed sitemap URL just means that brand contributes no host.
      }
    }
  }
  return hosts;
}

export function isAllowedHost(hostname: string): boolean {
  return allowedHosts().has(hostname.toLowerCase());
}

/**
 * Our own Vercel Blob store, where the uploaded image library lives.
 *
 * This used to allow the whole `.public.blob.vercel-storage.com` suffix. That
 * opens no path to anything internal, but it let anyone upload a file to their
 * OWN store and have /api/image-jpeg decode it with sharp on our function —
 * the image decoder being exactly where sharp's high-severity advisories live.
 * So: only our store. The id is also read from the write token, so a store
 * change follows the token instead of silently 403ing every library picture.
 */
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";
const OWN_BLOB_STORE = "gjrfhlr0lakjg4hl";

function ownBlobHosts(): Set<string> {
  const hosts = new Set([`${OWN_BLOB_STORE}${BLOB_HOST_SUFFIX}`]);
  // vercel_blob_rw_<storeId>_<secret>
  const id = process.env.BLOB_READ_WRITE_TOKEN?.split("_")[3];
  if (id) hosts.add(`${id.toLowerCase()}${BLOB_HOST_SUFFIX}`);
  return hosts;
}

/**
 * Hosts that may be fetched when the URL is a post's ARTWORK rather than a
 * topic page.
 *
 * `allowedHosts` only knows about sitemap hostnames, and that turned out to be
 * too narrow the moment artwork stopped coming exclusively from brand pages.
 * Every library-backed post — the whole of Emeka Explores, and Heart of the
 * Block — carries a picture on Vercel Blob or on a host named directly in
 * `imageLibrary`, and "Save image" answered all of them with a 403. The button
 * was on screen, it looked fine, and it had never worked for those brands.
 *
 * So artwork gets its own, slightly wider allowlist: the brand sites, plus the
 * hosts a brand explicitly declares artwork on, plus our own Blob store.
 */
export function isAllowedImageHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (ownBlobHosts().has(host)) return true;
  if (allowedHosts().has(host)) return true;

  for (const brand of BRANDS) {
    for (const url of brand.imageLibrary ?? []) {
      try {
        if (new URL(url).hostname.toLowerCase() === host) return true;
      } catch {
        // A malformed library URL contributes no host, same as above.
      }
    }
    // Hosts a brand names outright, for artwork that lives on a domain its
    // sitemap never mentions — a second domain for the same site, typically.
    for (const declared of brand.artworkHosts ?? []) {
      if (declared.toLowerCase() === host) return true;
    }
  }
  return false;
}
