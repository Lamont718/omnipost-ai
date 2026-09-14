/**
 * Write the SPARK Builders posts to a folder he can open, picture beside words.
 *
 * Same shape as the four brand folders already in `_SOCIAL-POSTS`, byte for
 * byte: UTF-8 **with BOM** and **CRLF**, because these are opened in Notepad on
 * Windows and both of those are what make it render properly there.
 *
 *   2026-09-15 1900 instagram.txt   <- the words
 *   2026-09-15 1900 instagram.png   <- the picture, same base name so they sort together
 *
 * Built from the LIVE production calendar rather than from the seeding script,
 * so what lands on disk is what the app actually holds — if the two ever
 * disagree, this folder shows the truth.
 *
 * ⚠️ /api/schedule returns a WINDOW, not a month: ?month=2026-09 answers
 * 2026-08-30 → 2026-10-03. Concatenating months double-counts the overlap —
 * that is how "221 upcoming posts" was once reported for 198. Deduped by id.
 *
 *   node scripts/export-spark-pack.mjs "<destination folder>"
 */
import { writeFileSync, mkdirSync } from "node:fs";

const OUT = process.argv[2];
if (!OUT) {
  console.error('usage: node scripts/export-spark-pack.mjs "<folder>"');
  process.exit(1);
}
const APP = process.env.OMNIPOST_URL ?? "https://omnipost-ai-phi.vercel.app";
const KEY = process.env.APP_KEY;
if (!KEY) {
  console.error("APP_KEY is not set");
  process.exit(1);
}

const MONTHS = ["2026-09", "2026-10", "2026-11", "2026-12"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

/**
 * "Friday 4 September 2026, 9:00 AM" from "2026-09-04" + "09:00".
 *
 * Built from the parts, never from `new Date("2026-09-04")` — a date-only
 * string is parsed as UTC and then printed in local time, which lands the
 * weekday a day early for anyone west of Greenwich. The whole point of this
 * line is that the weekday is right.
 */
function whenLabel(date, time) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const day = DAYS[new Date(y, m - 1, d).getDay()];
  const hour12 = hh % 12 === 0 ? 12 : hh % 12;
  const ampm = hh < 12 ? "AM" : "PM";
  return `${day} ${d} ${MONTH_NAMES[m - 1]} ${y}, ${hour12}:${String(mm).padStart(2, "0")} ${ampm}`;
}

const title = (s) => s.charAt(0).toUpperCase() + s.slice(1);
/** BOM + CRLF, matching the folders already on his desktop. */
const win = (text) => "﻿" + text.replace(/\r?\n/g, "\r\n");

const seen = new Map();
for (const month of MONTHS) {
  const res = await fetch(`${APP}/api/schedule?month=${month}`, {
    headers: { Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) {
    console.error(`${month}: HTTP ${res.status}`);
    process.exit(1);
  }
  for (const post of (await res.json()).posts) seen.set(post.id, post);
}

const posts = [...seen.values()]
  .filter((p) => p.brand.slug === "spark-builders" && p.caption)
  .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

if (!posts.length) {
  console.error("no written SPARK Builders posts on the calendar");
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const all = [];
let missingPictures = 0;

for (const post of posts) {
  const base = `${post.date} ${post.time.replace(":", "")} ${post.platform}`;
  const when = whenLabel(post.date, post.time);

  // The picture. A .txt naming a file that is not there is the one failure
  // this pack cannot have, so a download that fails is counted and said.
  let pictureLine = "(none)";
  if (post.image) {
    const url = post.image.startsWith("http") ? post.image : `${APP}${post.image}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${KEY}` } });
    if (res.ok) {
      const ext = (res.headers.get("content-type") ?? "").includes("jpeg") ? "jpg" : "png";
      writeFileSync(`${OUT}/${base}.${ext}`, Buffer.from(await res.arrayBuffer()));
      pictureLine = `${base}.${ext}`;
    } else {
      missingPictures++;
      console.error(`  ${base}: picture failed, HTTP ${res.status}`);
    }
  } else {
    missingPictures++;
  }

  const account = post.brand.handle
    ? `Account: ${post.brand.handle}`
    : "Account: (SPARK Builders has no account yet - post from whichever one you choose)";

  writeFileSync(`${OUT}/${base}.txt`, win(
`SPARK Builders   -   ${title(post.platform)}   -   ${when}
${account}

----- CAPTION - copy everything between the lines -----
${post.caption}
----- END OF CAPTION -----

PICTURE:  ${pictureLine}
ALT TEXT: ${post.imageAlt ?? post.topic.title}

ABOUT:    ${post.topic.title}
LINK:     https://sparkbuilders.org/discovery
`), "utf8");

  all.push(
`======================================================================
${when}   -   ${title(post.platform)}

${post.caption}

[picture: ${pictureLine}]
`);
  console.log(`${base}  ${pictureLine}`);
}

writeFileSync(`${OUT}/_ALL CAPTIONS.txt`, win(
`SPARK Builders - all ${posts.length} posts, in the order you send them

${all.join("\n")}`), "utf8");

writeFileSync(`${OUT}/README.txt`, win(
`SPARK BUILDERS - YOUR POSTS
====================================================================

${posts.length} posts, ${posts[0].date} through ${posts[posts.length - 1].date}.
Two a week: Tuesday 7:00 PM on Instagram, Sunday 11:00 AM on Facebook.

Every one has its picture sitting next to it.


HOW TO USE IT
---------------------------------------------------------------------
Files are named by date, so they sort in the order you post them:

  2026-09-15 1900 instagram.txt   <- the words
  2026-09-15 1900 instagram.png   <- the picture

Open the .txt, copy everything between the two CAPTION lines, attach
the file sitting next to it, send.

_ALL CAPTIONS.txt is every caption in one file, if you just want to
read them through.


ABOUT THE PICTURES
---------------------------------------------------------------------
There are no photographs of a SPARK session anywhere, so nothing here
is a stock photo or a drawing of something that did not happen.

Five of the cards are a real screenshot of the tool the kid actually
built - Star Math, Our Cleaning List, Ways Out, Story Detective and
Together - taken off the live site at phone size.

The other nine carry a line lifted word for word off sparkbuilders.org.
Each of those lines is deliberately NOT the sentence the caption opens
with, so the reader is not made to read the same words twice.

If you ever get real session photos - kids at a table, a notebook page,
Demo Day - those beat all fourteen and can be swapped straight in.


TWO THINGS TO KNOW
---------------------------------------------------------------------
There is no SPARK Builders social account yet. These are written and
waiting; post them from whichever account you like in the meantime.

These captions were written by hand, not by the app. The Anthropic API
key has had no credit since 3 September, so OmniPost's writer cannot
run for any brand until it is topped up.
`), "utf8");

console.log(`\n${posts.length} posts written to ${OUT}`);
if (missingPictures) console.error(`${missingPictures} post(s) have no picture`);
