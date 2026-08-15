# The 8am email

Every morning at 8am New York time, OmniPost emails you the posts that still
have to go out that day — captions in full, pictures inline, already-ticked ones
left out.

It exists because the app was entirely passive. Three months of finished posts
sat behind a URL, and nothing was ever published from it. The captions now come
to you instead of waiting to be fetched.

## Turning it on

Two environment variables. The rest is already deployed and running.

1. **`RESEND_API_KEY`** — make a free account at [resend.com](https://resend.com)
   (3,000 emails/month free; this uses about 30). Create an API key and paste it
   in. No domain setup needed: the default sender is `onboarding@resend.dev`,
   which Resend will deliver to the address that owns the account.
2. **`DIGEST_TO`** — where the email goes. Set to `lamont1879@gmail.com`. If you
   make the Resend account with a different address, change this to match, or
   the send will be rejected.

```
vercel env add RESEND_API_KEY production --value="re_..." --scope lamont718s-projects
```

3. **`PUBLIC_ORIGIN`** — `https://omnipost-ai-phi.vercel.app`. Not optional in
   practice. Vercel invokes a cron against the *deployment* host
   (`omnipost-<hash>-lamont718s-projects.vercel.app`), not the stable alias, so
   without this every link and image in the email points at a one-off build URL
   that changes on the next deploy. Set, and verified: the links read
   `omnipost-ai-phi.vercel.app`.

Optional: `DIGEST_FROM` to use your own domain once it's verified with Resend.

**All three are set in production.** Two test emails have been delivered to
`lamont@communitynyc.org`. Env vars bind at deploy time, so anything changed
here needs a `vercel redeploy` before it takes effect.

Until both are set the cron still runs, still builds the day's list, and returns
`{"skipped": true, "reason": "RESEND_API_KEY is not set"}` — a pending state, not
a failure, so it doesn't cry wolf every morning.

## Checking it by hand

```bash
S=$CRON_SECRET   # vercel env pull --environment=production --scope lamont718s-projects

# See exactly what the email looks like, send nothing. Returns HTML.
curl "https://omnipost-ai-phi.vercel.app/api/cron/daily-nudge?secret=$S&preview=1"

# A different day
curl ".../api/cron/daily-nudge?secret=$S&preview=1&date=2026-08-20"

# Actually send it now, whatever the hour
curl ".../api/cron/daily-nudge?secret=$S&force=1"
```

## Why the cron is scheduled twice

`vercel.json` runs it at **11:00 and 12:00 UTC**, and the route returns
`{"skipped": true}` unless it's the 8 o'clock hour in New York.

Vercel crons are UTC with no timezone support, so a single fixed expression is
8am in summer and 7am in winter. Two runs with an hour check means exactly one
sends, in either half of the year, and the time never quietly drifts.

## What it leaves out

A post disappears from the email once it's ticked off — on the sheet, on the
calendar, or from the "copy & tick off" link in the email itself. Ticks are
stored server-side (`src/lib/posted.ts`), so a post you sent from your phone is
gone from tomorrow's email even though the tick happened on a different device.

An email that lists work you've already done is one you learn to skim, and
skimming is how the 8am email becomes as ignorable as the URL it replaced.
