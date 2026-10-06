/**
 * Take the Christmas footage off the autumn YODM calendar, and put it where it
 * belongs — in December.
 *
 * His note, 2026-10-06: "the YODM post are still alot of the christmas themed
 * event that i had mix it up". Eleven of the fourteen game-night clips were
 * cut from one December 2021 party, stockings and garland in every shot, and
 * five of the TikTok Tuesdays between now and Thanksgiving opened on one.
 *
 * The clip picker now has a season (see `inSeason` in lib/video-library.ts and
 * `season` on those eleven in brands.ts), which keeps them off any slot nobody
 * has written yet. A written caption pins its clip, though, so the five that
 * were already written are rewritten here by hand — the Anthropic key still
 * has no credit — onto the YODM podcast clips, which are not seasonal and
 * argue something on their own. The three December Tuesdays that had never
 * been written get the Christmas clips the autumn gave up.
 *
 * Writes ONE part blob per caption, `caption-parts/<id>.json`, exactly as
 * seed-spark-captions.mjs and the app's own writer do. Parts outrank the base
 * and cannot clobber each other.
 *
 *   node scripts/seed-yodm-off-season.mjs          (dry: prints, writes nothing)
 *   node scripts/seed-yodm-off-season.mjs --write
 */
import { put } from "@vercel/blob";

const WRITE = process.argv.includes("--write");
const BLOB = "https://gjrfhlr0lakjg4hl.public.blob.vercel-storage.com";

function clip(name, describes) {
  const base = `${BLOB}/library/yodm/video/${name}`;
  return { url: `${base}.mp4`, poster: `${base}.jpg`, name, describes };
}

/** A podcast clip is its own subject: there is no card, so no page. */
function podcastTopic(title, context) {
  return { title: `YODM Podcast — ${title}`, context, source: "evergreen" };
}

const TRUST = {
  title: "When the trust is broken in a relationship, can you ever truly get it back?",
  context:
    "Argued at a 2021 game night, four ways. One woman: hell no — even if they say they trust you again, they will always question whatever you do. Another: all things heal over time, both people have faults, and you rebuild it by leaving the phone and the pocketbook lying around. A man: you can go to therapy and work on it, but you will never get it back like it once was. A fourth: if you truly forgive someone and they have truly changed, you can grow together. Not one of the 92 cards — a question from the night, on a GAME NIGHT card.",
  source: "evergreen",
};
const SCHOOL = {
  title: "Is traditional schooling better than homeschooling?",
  context:
    "Argued at a 2021 game night. One woman for homeschooling: the curriculum you grew up on turns out not to be the truth, and at home you can teach your kids African studies, which school does not show them. Another, who homeschooled her own children until fifth grade, calls the United States education system the equivalent of a third world country, says you can teach a child the way that child learns rather than systematically, and that homeschoolers do far better in college. Not one of the 92 cards — a question from the night, on a GAME NIGHT card.",
  source: "evergreen",
};
const WNBA = {
  url: "https://yodm.com/card/53",
  source: "site",
  title: "Should athletes in the WNBA get as much pay as those in the NBA? — YODM Debate Card",
  context: "Sports",
};

const GAME_TAGS = "#YODM #GameNight #PartyGames #DebateMe";
const POD_TAGS = "#YODM #YODMPodcast #DebateMe";

const POSTS = [
  // ---- Autumn: off the Christmas tape, onto the podcast. ----
  {
    id: "yodm:2026-10-06:17:00:tiktok",
    topic: podcastTopic(
      "How he treats his mother",
      "A woman on the YODM podcast says women should know that how a man treats his mother is how he is going to treat them: if he loves and respects his mother you have a chance; if he doesn't, run — take your bags, your shoes, your wigs and everything — because his mother is his first love.",
    ),
    video: clip(
      "05-mother-coded",
      "A YODM podcast clip: a woman at the mic says how a man treats his mother is how he will treat you — if he doesn't love and respect his mother, take your bags, your shoes, your wigs and run",
    ),
    caption: `She said take your bags, your shoes, your wigs and run. Harsh? Maybe. Wrong? That's the argument.

The mother test sounds airtight until you meet a man whose mother never earned it. Some men keep their distance from their mom for reasons that should make you trust him more, not less.

So is it a rule, or just the first thing you check?

yodm.com

${POD_TAGS}`,
  },
  {
    id: "yodm:2026-10-20:17:00:tiktok",
    topic: podcastTopic(
      "I'm not chasing you to be a father",
      "A mother on the YODM podcast says she didn't beg him to sleep with her, so she is not going to beg him to take care of his kid: she is not taking him to court, not running him down and not chasing him, because being a father to his child is something he should want.",
    ),
    video: clip(
      "06-dont-beg-for-fatherhood",
      "A YODM podcast clip: a mother says she didn't chase him to sleep with her, so she won't chase him to be a father — no court, no running him down; being a father is something he should want",
    ),
    caption: `"I didn't chase you to sleep with you. I'm not going to chase you to be a father to your child."

There's a lot of dignity in that. It also leaves the kid waiting on a grown man to decide on his own. Pride or protection, which one is it really?

Would you chase him, or let him go?

yodm.com

${POD_TAGS}`,
  },
  {
    id: "yodm:2026-11-10:17:00:tiktok",
    topic: podcastTopic(
      "He's a good man who made bad decisions",
      "A mother on the YODM podcast says she lets her child know who their father is and that he is a good man who made bad decisions — even if he is bad to her, he can be a great person to that kid and the kid can build their own relationship with him. The host calls it honorable.",
    ),
    video: clip(
      "11-raising-children-honesty",
      "A YODM podcast clip: a mother says she tells her child their father is a good man who made bad decisions — he can be bad to her and still be a great person to that kid; the host calls it honorable",
    ),
    caption: `"He can be bad to me, but he can be a great person to that kid."

She tells her child their father is a good man who made bad decisions. The host called it honorable. The other side calls it a cover story the kid finds out about at fifteen.

Protecting the kid's picture of their dad, or lying to them?

yodm.com

${POD_TAGS}`,
  },
  {
    id: "yodm:2026-11-17:17:00:tiktok",
    topic: podcastTopic(
      "In love with the illusion",
      "A woman on the YODM podcast asks whether you were in love with the person or with the illusion of long distance — the reunion, eating out, hanging out, then somebody is back on a plane. She says it only works when you're young and have time to waste, and that she lives in Brooklyn and doesn't know what her person is doing four or five blocks away, much less a plane ride away.",
    ),
    video: clip(
      "04-long-distance-illusion",
      "A YODM podcast clip: a woman asks whether you were in love with the person or with the illusion of long distance — the reunion, the dinners, the plane back — and says she can't keep an eye on someone four blocks away, much less a plane ride away",
    ),
    caption: `Were you in love with the person, or with the airport reunion?

Her point: every visit is the highlight reel. Dinner out, no dishes, a flight home before anybody gets on anybody's nerves. You never meet the Tuesday version of them.

The other side says that's exactly why it works. You only wait for somebody worth waiting for.

Long distance: real love or a long vacation?

yodm.com

${POD_TAGS}`,
  },
  {
    id: "yodm:2026-11-24:17:00:tiktok",
    topic: podcastTopic(
      "A mother's job is never done",
      "A mother on the YODM podcast says a woman's job is never done, 24-7 — not just putting the kids in the latest Jordans, but washing the clothes while they sleep, making the food from scratch, boiling and mashing the potatoes, combing hair, and never having time for anything but her children.",
    ),
    video: clip(
      "09-the-unseen-hustle",
      "A YODM podcast clip: a mother says a woman's job is never done — not just the latest Jordans, but washing clothes while the kids sleep, cooking from scratch, mashing the potatoes, combing hair",
    ),
    caption: `Putting the kid in the latest Jordans is not the job. Washing the clothes while they sleep is.

She says a mother's job is never done, and she's describing the part nobody sees: food from scratch, hair combed, potatoes mashed, nothing left over for herself.

Here's where the table splits. Is that the standard for every parent, or the reason so many mothers are running on empty?

yodm.com

${POD_TAGS}`,
  },

  // ---- December: the Christmas game night, in season. ----
  {
    id: "yodm:2026-12-15:17:00:tiktok",
    topic: SCHOOL,
    video: clip(
      "school-third-world",
      "A game night: the same schooling card is on screen while a woman who homeschooled her own children to fifth grade calls the United States education system the equivalent of a third world country, and says homeschoolers do far better in college",
    ),
    caption: `She homeschooled her own kids to fifth grade, so she isn't guessing.

Her verdict on the school system is brutal. The other side of the room will say a kid at home misses the one thing a classroom can't fake: a room full of people who don't think like your family.

Who should be teaching your kids?

yodm.com

${GAME_TAGS}`,
  },
  {
    id: "yodm:2026-12-22:17:00:tiktok",
    topic: WNBA,
    video: clip(
      "wnba-pay",
      "A game night: the SPORTS card 'Should athletes in the WNBA get as much pay as those in the NBA?' is on screen while a woman at the table argues yes — they bring the fans in, they sacrifice their bodies, so they should get the same as the men",
    ),
    caption: `She says they bring the fans in and put their bodies on the line just like the men, so pay them the same.

The answer she gets at every table: pay follows the money, not the effort. And somebody always fires back asking when effort ever set anybody's salary.

Effort or earnings: which one should write the check?

yodm.com

${GAME_TAGS}`,
  },
  {
    id: "yodm:2026-12-29:17:00:tiktok",
    topic: TRUST,
    video: clip(
      "trust-hell-no",
      "A game night: the GAME NIGHT card 'When the trust is broken in a relationship, can you ever truly get it back?' is on screen while a woman answers hell no — even if they say they trust you again they will always question whatever you do",
    ),
    caption: `Her answer: hell no. Even if they say they trust you again, they'll question everything you do.

That's the honest version of forgiveness most people won't say out loud. You can stay. You can even be happy. But a phone face-down on the table will never just be a phone again.

New year, clean slate, or is that a lie couples tell each other?

yodm.com

${GAME_TAGS}`,
  },
];

const BANNED = [
  "30 seconds", "thirty seconds", "30-second", "92 cards", "one of 92", "pick a side",
  "pick your side", "make your case", "the ultimate debating game", "ends friendships",
  "end a friendship", "ending friendships", "elevate", "unleash", "game-changer",
];

const problems = [];
const records = {};
for (const p of POSTS) {
  const lower = p.caption.toLowerCase();
  for (const b of BANNED) if (lower.includes(b)) problems.push(`${p.id}: banned "${b}"`);
  if (!p.caption.includes("yodm.com")) problems.push(`${p.id}: never names yodm.com`);
  const [, , hh, mm] = p.id.split(":");
  records[p.id] = {
    caption: p.caption,
    suggested_hashtags: p.caption.match(/#\w+/g) ?? [],
    recommended_post_time: `${hh}:${mm}`,
    platform_notes: "Written by hand 2026-10-06 — the app's writer had no API credit. Moved off the Christmas 2021 footage in autumn; December gets it back.",
    generatedAt: new Date().toISOString(),
    topic: p.topic,
    video: p.video,
  };
}

// Every clip named here must really exist, or the post goes out with a dead video.
for (const p of POSTS) {
  for (const u of [p.video.url, p.video.poster]) {
    const r = await fetch(u, { method: "HEAD" });
    if (!r.ok) problems.push(`${p.id}: ${u} → ${r.status}`);
  }
}

if (problems.length) {
  console.error("refusing to write:\n  " + problems.join("\n  "));
  process.exit(1);
}

for (const [id, r] of Object.entries(records)) {
  console.log(`  ${id}  ${String(r.caption.length).padStart(4)} chars  ${r.video.name.padEnd(28)} ${r.topic.title}`);
}

if (!WRITE) {
  console.log("\ndry run — nothing written. Re-run with --write");
  process.exit(0);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN is not set");
  process.exit(1);
}
for (const [id, r] of Object.entries(records)) {
  await put(`caption-parts/${encodeURIComponent(id)}.json`, JSON.stringify({ id, ...r }), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
  console.log(`wrote ${id}`);
}
