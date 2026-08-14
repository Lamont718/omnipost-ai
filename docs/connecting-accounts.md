# Connecting the accounts

What has to happen before the **Post now** button appears on the sheet.

None of this needs Meta App Review. Review is what gates letting *other people*
connect *their* accounts to your app. Posting to accounts you own, from an app
left in development mode with those accounts added as testers, works from day
one. That is the whole reason this was worth building.

Everything below is done once. The tokens do not expire on any schedule you have
to think about — see "Keeping it working" at the end for the one that does.

---

## Before you start

**Every Instagram account must be a Professional account (Business or Creator),
and each one must be linked to a Facebook Page.** A personal Instagram account
cannot be posted to by any app, including this one — there is no workaround and
no setting to change. Converting is free and takes about a minute in the
Instagram app: Settings → Account type and tools → Switch to professional
account.

If an account is still personal, convert it first. Nothing else here will work
for that brand until you do.

---

## 1. Create the Meta app

1. Go to <https://developers.facebook.com/apps> and create an app.
   Choose **Business** as the type.
2. Leave the app in **Development** mode. Do not submit it for review.
3. Add the **Instagram Graph API** and **Facebook Login for Business** products.
4. Under **App roles → Roles**, add yourself, and add each Instagram account you
   want to post to as an **Instagram Tester**. Each account then has to accept
   the invite from Instagram: Settings → Apps and websites → Tester invites.

## 2. Get the ids and the token

You need three values per brand. The Graph API Explorer
(<https://developers.facebook.com/tools/explorer/>) is the quickest way:

- **Page access token** — select your app, select the Page, and request the
  permissions `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`,
  `instagram_basic`, `instagram_content_publish`. Generate the token.
- **Facebook Page id** — call `GET /me/accounts`; it is the `id` next to the
  Page name.
- **Instagram user id** — call `GET /{page-id}?fields=instagram_business_account`.
  This is a long number, **not** the @handle.

Then exchange the short-lived token for a long-lived one, which lasts about 60
days:

```
GET https://graph.facebook.com/v21.0/oauth/access_token
  ?grant_type=fb_exchange_token
  &client_id=<app id>
  &client_secret=<app secret>
  &fb_exchange_token=<short-lived token>
```

A Page token obtained *using* a long-lived user token does not expire at all,
which is the one you want. Call `GET /me/accounts` again with the long-lived
user token and take the Page token from that response.

## 3. Set up X

1. Create a project and app at <https://developer.x.com>. You need a
   **pay-per-use** billing setup — X ended the free tier for new developers in
   February 2026.
2. Set the app's **User authentication settings** to read *and write*. If you
   skip this, posting fails with a 403 that says nothing useful.
3. Under **Keys and tokens**, generate the **API Key and Secret** (the app's,
   used for every account) and an **Access Token and Secret** for each account
   you want to post from.

Cost, so it is never a surprise: **$0.015 per post**, rising to **$0.20 if the
post contains a link**. OmniPost captions carry no links by design, so at about
25 X posts a month this is roughly **40 cents a month**. Adding a link to a
caption template multiplies that by thirteen.

---

## 4. Put them in the environment

The variable names are the brand slug, uppercased, with hyphens as underscores:

| Brand | Suffix |
|---|---|
| Emeka Explores | `EMEKA_EXPLORES` |
| MostHatedNBA | `MOSTHATED` |
| YODM | `YODM` |
| WWSH | `WWSH` |
| The Conductor | `THE_CONDUCTOR` |
| Heart of the Block | `HEART_OF_THE_BLOCK` |

Note MostHatedNBA is `MOSTHATED`, matching its slug — not `MOSTHATEDNBA`.

Per brand, all optional — set only what that brand has:

```
META_PAGE_TOKEN_<SUFFIX>     Page access token (serves both IG and FB)
IG_USER_ID_<SUFFIX>          Instagram Business account id
FB_PAGE_ID_<SUFFIX>          Facebook Page id
X_ACCESS_TOKEN_<SUFFIX>      per-account X token
X_ACCESS_SECRET_<SUFFIX>     per-account X secret
```

Once app-wide:

```
X_API_KEY                    the X app's consumer key
X_API_SECRET                 the X app's consumer secret
META_API_VERSION             optional, defaults to v21.0
```

Set them on Vercel as **Sensitive** so they cannot be read back:

```
vercel env add META_PAGE_TOKEN_YODM production --value="…" --sensitive
```

⚠️ `vercel env add` reading from stdin is broken — always use the `--value=`
flag.

Redeploy after adding them. A brand with no credentials simply has no Post
button; nothing else about the app changes.

---

## What the button does

On the posting sheet, a row for a connected brand grows a **Post now** button.
It confirms first, naming the brand and the platform, then:

1. Refuses if that slot has already been published. The record lives on the
   server, not in the browser, so posting from the laptop stops the phone from
   posting it again. There is no undo on Instagram, so this guard is the point.
2. Refuses an over-length X post rather than letting X reject it.
3. Converts the artwork to JPEG at 1080×1080, letterboxed, never cropped.
   Instagram accepts JPEG only, and rejects extreme aspect ratios. This also
   quietly saves MostHatedNBA: its villain portraits are PNG files served with
   `.jpg` names, and Instagram would refuse every one of them.
4. Posts, then records it, in that order — a publish that succeeds but fails to
   record is recoverable by a person, while the reverse hides a post that never
   went out.

**Nothing publishes on a timer.** The weekly cron still only writes captions.
A post goes out when a person presses a button on a post they are looking at.

---

## Keeping it working

- **Page tokens.** A Page token derived from a long-lived user token does not
  expire, but it *is* invalidated if you change your Facebook password, revoke
  the app, or Meta forces a re-auth. The symptom is every Meta post failing at
  once with an OAuth error. The fix is to regenerate the Page token.
- **Heart of the Block has no social accounts at all.** Its posts stay a bank of
  drafts until the accounts exist.
- **LinkedIn is not supported.** Posting to a LinkedIn Page needs the Community
  Management API, which genuinely does require partner approval — there is no
  development-mode route. No active brand schedules LinkedIn today.
