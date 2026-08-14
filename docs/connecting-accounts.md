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

**Every Instagram account must be a Professional account — Business or
Creator.** A personal account cannot be posted to by any app, including this
one; there is no workaround. Converting is free and takes about a minute in the
Instagram app: Settings → Account type and tools → Switch to professional
account.

**You do not need a Facebook Page.** Meta's original publishing API required
one, and most guides still say so, but the Instagram API with Instagram Login
(July 2024) lets a Business or Creator account publish on its own token with no
Page anywhere in the picture. That is the route below, because Lamont's Facebook
is personal and there are no Pages for the projects.

If a brand *does* already have a Page, the older route still works and is
documented at the end.

---

## 1. Create the Meta app

1. Go to <https://developers.facebook.com/apps> and create an app.
   Choose **Business** as the type.
2. Leave the app in **Development** mode. Do not submit it for review.
3. Add the **Instagram** product, and pick **API setup with Instagram login**.
   (Not "with Facebook login" — that is the route that wants a Page.)

## 2. Connect the account and generate its token

Still under **Instagram → API setup with Instagram login**:

1. **Add account** — sign in as the brand's Instagram account and authorise it.
2. The account appears in the list with its **Instagram user id**, a long
   number. That is `IG_USER_ID_<SUFFIX>` — it is not the @handle.
3. Press **Generate token** next to the account. That is `IG_TOKEN_<SUFFIX>`.
   Copy it immediately; the dashboard will not show it again.

The permissions needed are `instagram_business_basic` and
`instagram_business_content_publish`, both of which this setup grants for an
account you own without any review.

⚠️ **This token lasts 60 days.** Unlike a Page token, it does expire, and it
expires silently — everything works until one day a post doesn't go out. Put a
reminder in the calendar. Refresh it with:

```
GET https://graph.instagram.com/refresh_access_token
  ?grant_type=ig_refresh_token
  &access_token=<current token>
```

That returns a fresh 60-day token; set it as `IG_TOKEN_<SUFFIX>` and redeploy.
`GET /api/publish?check=1` tells you whether every connected token still works
and which account it belongs to, so you can check without posting anything.

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
IG_USER_ID_<SUFFIX>          Instagram Business account id      ← always
IG_TOKEN_<SUFFIX>            Instagram-Login token (no Page)    ← this route
X_ACCESS_TOKEN_<SUFFIX>      per-account X token
X_ACCESS_SECRET_<SUFFIX>     per-account X secret

META_PAGE_TOKEN_<SUFFIX>     Page token — only for the older Page route
FB_PAGE_ID_<SUFFIX>          Facebook Page id — only if posting to a Page
```

`IG_TOKEN_` wins over `META_PAGE_TOKEN_` when both are set.

Once app-wide:

```
X_API_KEY                    the X app's consumer key
X_API_SECRET                 the X app's consumer secret
META_API_VERSION             optional, defaults to v21.0
```

Set them on Vercel as **Sensitive** so they cannot be read back:

```
vercel env add IG_TOKEN_YODM production --value="…" --sensitive
```

⚠️ `vercel env add` reading from stdin is broken — always use the `--value=`
flag.

Redeploy after adding them. A brand with no credentials simply has no Post
button; nothing else about the app changes.

---

## The older route, if a brand already has a Facebook Page

Only worth using for an account that is already linked to a Page — there is no
reason to create one just to post to Instagram.

1. In the Meta app, add **Instagram Graph API** and **Facebook Login for
   Business** instead, and add the account under **App roles → Instagram
   Tester**.
2. In the Graph API Explorer, request `pages_show_list`, `pages_manage_posts`,
   `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`.
3. `GET /me/accounts` gives the Page id and the Page token.
   `GET /{page-id}?fields=instagram_business_account` gives the IG user id.
4. Exchange for a long-lived user token, then take the Page token from
   `GET /me/accounts` again — a Page token derived that way does not expire,
   which is the one real advantage this route has.

Set `META_PAGE_TOKEN_<SUFFIX>` and `FB_PAGE_ID_<SUFFIX>`.

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
