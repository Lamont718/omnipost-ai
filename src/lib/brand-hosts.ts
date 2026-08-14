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
 * Vercel Blob's public read host. Our own uploaded image library lives here.
 *
 * Blob buckets are per-store subdomains of one Vercel-controlled domain that
 * serves nothing but public objects, so allowing the suffix does not open a
 * path to anything internal — which is the thing the allowlist exists to stop.
 */
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

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
  if (host.endsWith(BLOB_HOST_SUFFIX)) return true;
  if (allowedHosts().has(host)) return true;

  for (const brand of BRANDS) {
    for (const url of brand.imageLibrary ?? []) {
      try {
        if (new URL(url).hostname.toLowerCase() === host) return true;
      } catch {
        // A malformed library URL contributes no host, same as above.
      }
    }
  }
  return false;
}
