import { instagramAccount } from "../accounts";
import { BRANDS } from "../brands";

/**
 * Does each connected account's token still work?
 *
 * Worth having because of one asymmetry in how Instagram's two routes age. A
 * Page token derived from a long-lived user token does not expire. An
 * Instagram-Login token expires after **60 days** and has to be refreshed, and
 * the failure mode is silent: nothing changes until the day a post doesn't go
 * out, and the error at that point talks about the session rather than the
 * date.
 *
 * So the sheet can ask this instead of finding out at the moment of posting.
 * Deliberately a separate call rather than part of the normal readiness
 * response — it makes one network round trip per account, which is fine on
 * demand and wasteful on every page load.
 *
 * X is not checked here. Its reads are billed per call, and quietly spending
 * money to render a status light is the wrong trade for something that is only
 * ever wrong right after someone edits the keys.
 */

const TIMEOUT_MS = 10_000;

export interface AccountCheck {
  slug: string;
  name: string;
  platform: "instagram";
  route: "page" | "direct";
  ok: boolean;
  /** The account the token actually belongs to — catches a pasted mix-up. */
  username?: string;
  error?: string;
}

export async function checkInstagramTokens(): Promise<AccountCheck[]> {
  const targets = BRANDS.filter((b) => b.active).flatMap((brand) => {
    const account = instagramAccount(brand.slug);
    return account ? [{ brand, account }] : [];
  });

  return Promise.all(
    targets.map(async ({ brand, account }): Promise<AccountCheck> => {
      const base: AccountCheck = {
        slug: brand.slug,
        name: brand.name,
        platform: "instagram",
        route: account.route,
        ok: false,
      };

      try {
        // Both routes answer this; the direct route answers it on
        // graph.instagram.com, which is exactly what we want to prove reachable.
        const url = new URL(`${account.host}/${account.igUserId}`);
        url.searchParams.set("fields", "username");
        url.searchParams.set("access_token", account.token);

        const res = await fetch(url.toString(), {
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const body = (await res.json()) as {
          username?: string;
          error?: { message?: string };
        };

        if (body.error) return { ...base, error: body.error.message ?? "token rejected" };
        if (!res.ok) return { ...base, error: `Instagram returned ${res.status}` };

        return { ...base, ok: true, username: body.username };
      } catch (error) {
        return {
          ...base,
          error: error instanceof Error ? error.message : "could not reach Instagram",
        };
      }
    }),
  );
}
