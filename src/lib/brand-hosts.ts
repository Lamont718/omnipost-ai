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
