/**
 * Seed the SPARK Builders calendar with captions written by hand.
 *
 * Why this exists rather than `weekly-digest`: the Anthropic key has no credit
 * (checked 2026-09-14 — "Your credit balance is too low to access the Anthropic
 * API"), so the app's own writer cannot run. `POST /api/caption` cannot help
 * either: it refuses a slot that has never been generated, on purpose, because
 * a caption with no topic and no clip would show on the calendar as a post
 * about nothing. So this writes the same records the writer would have written,
 * in the same place, with the topic pinned the same way.
 *
 * It writes ONE part blob per caption — `caption-parts/<id>.json`, body
 * `{ id, ...StoredCaption }` — which is exactly what `writeCaptions` does. Parts
 * cannot clobber each other and the next `compactCaptions` folds them into the
 * base. Nothing here touches captions.json.
 *
 * Every topic's `facts` is read back out of src/lib/brands.ts and compared, so
 * a record can never be pinned to a topic whose wording has drifted from the
 * brand file. A mismatch aborts the whole run before anything is written.
 *
 *   node scripts/seed-spark-captions.mjs --dry     (default: prints, writes nothing)
 *   node scripts/seed-spark-captions.mjs --write
 */
import { readFileSync } from "node:fs";
import { put } from "@vercel/blob";

const WRITE = process.argv.includes("--write");
const BRANDS = readFileSync(new URL("../src/lib/brands.ts", import.meta.url), "utf8");

/** The bare domain these posts send people to, as configured on the brand. */
const DEST = "sparkbuilders.org/discovery";

const POSTS = [
  {
    id: "spark-builders:2026-09-15:19:00:instagram",
    topic: "Star Math, built by a seven-year-old",
    caption: `Math practice was the most boring part of her school day. She's seven. She rebuilt it.

Star Math started as her own complaint and ended up being the thing her whole class uses. It's live right now, and it measures real growth for the kids on it.

That's the move: a kid notices something that's actually wrong, decides what would fix it, and then stays with it long enough to finish. She drew it first, in a notebook, by hand. Everything after that was just making it real.

If you want to find the thing your own kid would rebuild, there's a sheet for it at ${DEST} — fifteen minutes at the kitchen table.

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools #BrooklynKids`,
  },
  {
    id: "spark-builders:2026-09-20:11:00:facebook",
    topic: "Fifteen minutes at the kitchen table",
    caption: `The hardest part of helping a kid solve a problem: you're the scribe, not the answer key.

That's the actual instruction on the SPARK Discovery sheet, and the whole thing is fifteen minutes at the kitchen table. You read the questions out loud, then you get quiet. You write down what your kid says — their exact words. You don't fix the grammar and you don't suggest a better answer.

No wrong answers. Blank ones are fine. You're not testing them, you're helping them notice.

And you're not trying to fill the page. You're listening for the one thing they light up about. That's the thing worth building.

The sheet is sitting there whenever you've got the fifteen minutes.

https://${DEST}

#SparkBuilders #KidsWhoBuild #ParentingOutLoud`,
  },
  {
    id: "spark-builders:2026-09-22:19:00:instagram",
    topic: "Emeka, 7 — Our Cleaning List",
    caption: `The chores argument in her apartment ended because a seven-year-old got tired of it.

Emeka built Our Cleaning List. It's the chore tool her family actually uses, which is the only kind that counts. Two stars lit — one for her family, one for her class.

Nobody assigned it to her. She noticed the thing everybody in the house kept arguing about and decided that was the problem worth fixing.

That's what's really being taught here. Not how to make something. How to notice what's worth making.

Your kid already has a list like that. Fifteen minutes at the kitchen table and you'll find out what's on it: ${DEST}

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools #BrooklynKids`,
  },
  {
    id: "spark-builders:2026-09-27:11:00:facebook",
    topic: "Elija, 14 — Ways Out",
    caption: `Elija is 14. He built a one-tap hub for free, 24/7 help against violence — crisis lines, a way out of the streets, and real paid youth jobs.

He built it for kids on his block.

That's the part that matters. Not that a fourteen-year-old made something that works, but that he looked around at where he actually lives, named who was in trouble, and built the kind of help you need at two in the morning.

A build doesn't count here until a real person uses it. That's what lights a star.

If you want to know what your own kid would build for the people around them, the sheet takes fifteen minutes.

https://${DEST}

#SparkBuilders #RealProblemsRealTools #BrooklynKids`,
  },
  {
    id: "spark-builders:2026-09-29:19:00:instagram",
    topic: "Every kid gets a notebook before anything gets built",
    caption: `Before anything gets built, every SPARK kid gets a real notebook.

They write what they notice. They draw what they want. By hand — Leonardo kept his notebooks the same way.

The journal is the seed, and the build grows out of it. Nothing gets made without it.

Here's the reason it's paper: a drawing they made is theirs in a way a screen never is. Can't be faked, can't be copied, and a year from now they can still hold it.

Start your kid's first page tonight. Fifteen minutes at your table: ${DEST}

#SparkBuilders #KidsWhoBuild #ParentingOutLoud`,
  },
  {
    id: "spark-builders:2026-10-04:11:00:facebook",
    topic: "The four places a builder looks",
    caption: `There's an order to where a builder looks, and it runs closest to widest.

Yourself — what's hard for me, and who else feels it?
Your Home — what's hard for my family?
Your School — what's hard for kids and teachers here?
Your Community — what's hard for people around me?

Most kids start at Yourself, because that's the one they can see without help. The interesting part is what happens next: the question keeps turning outward, until it stops being about them and starts being about somebody else.

That turn is the point. Empathy isn't the side effect here. It's the target.

Four places, four sets of questions, fifteen minutes.

https://${DEST}

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-10-06:19:00:instagram",
    topic: "The moment it breaks is the lesson",
    caption: `The best moment in a session is when the thing breaks.

Not a metaphor. When a build stops working, the kid is suddenly standing in front of a real problem they actually care about — not a worksheet, not a hypothetical. Theirs.

So nobody rescues it. The coach asks why, and the explanation comes back in words the kid already uses.

"Oh, I see." Then they redraw.

That's the moment stuck stops being a wall and turns into the next small move. They keep that long after they've forgotten what they built.

Find out what your kid would build in the first place: ${DEST}

#SparkBuilders #KidsWhoBuild #ParentingOutLoud`,
  },
  {
    id: "spark-builders:2026-10-11:11:00:facebook",
    topic: "It shows up the first time anything breaks",
    caption: `You've probably watched this happen.

The laptop dies. There's no charger. And instead of working it out, they just… stop.

Or the form has one confusing field and the whole thing gets abandoned.

It isn't laziness and it isn't "kids these days." The muscle that says "this is hard, let me figure it out" never got built, because nothing smooth ever asked for it.

That's the muscle being trained here. Not less of anything — a kid who can stay with one hard, real thing long enough to finish it, and who knows what to do when it breaks.

Fifteen minutes to find the thing worth staying with.

https://${DEST}

#SparkBuilders #ParentingOutLoud #KidsWhoBuild`,
  },
  {
    id: "spark-builders:2026-10-13:19:00:instagram",
    topic: "Iye, 7 — Story Detective",
    caption: `Iye is seven. She built Story Detective — a game that turns reading into solving cases.

Read it or listen to it, work out what it actually means, earn a detective badge.

She built it for herself first. Then it turned out to be for every kid who freezes at reading.

That's how a star gets lit here. Not when the thing is finished — when a real person uses it.

What would your kid rebuild if somebody asked them properly? Fifteen minutes at your table: ${DEST}

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-10-18:11:00:facebook",
    topic: "We build it exactly as they drew it",
    caption: `Here's a rule that surprises people: we build exactly what the kid drew. Not the better version. Not what we'd have done with it.

Then we show it to them and ask three questions. What do you notice? What's right? What's missing?

And they see it — the gap between the thing in their head and the thing in front of them.

That gap is where a designer gets born. They jot it down, they redraw, we rebuild. Then they do it again.

Nobody learns that from being handed a polished version of their own idea.

Fifteen minutes to get the first drawing out of them.

https://${DEST}

#SparkBuilders #KidsWhoBuild #ParentingOutLoud`,
  },
  {
    id: "spark-builders:2026-10-20:19:00:instagram",
    topic: "A star lights when a real person uses it",
    caption: `A build doesn't count here until somebody actually uses it.

That's the rule. Finish it and it's a project. Give it to a real person who needed it and it becomes a star.

Every builder grows a constellation that way. Five kids, ages 7 to 14, have lit stars so far — among them a chore list, a reading game, a two-minute family ritual, and a hub for kids who need a way out.

None of them got there by having a good idea. They got there by giving it to someone.

Your kid's first one starts with fifteen minutes at the table: ${DEST}

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools #BrooklynKids`,
  },
  {
    id: "spark-builders:2026-10-25:11:00:facebook",
    topic: "Kourtney, 14 — Together",
    caption: `Kourtney is 14, and the thing she built for her family takes two minutes a day.

It's called Together. Everybody says how they really feel, answers one connection question, and protects a little real time together. Two minutes. That's the whole thing.

She wasn't trying to fix her family. She was trying to make one small thing happen every day that couldn't get skipped.

Her family uses it. That's the star.

If you want to know what your own kid has noticed about your house — and they have noticed — the sheet takes fifteen minutes.

https://${DEST}

#SparkBuilders #RealProblemsRealTools #ParentingOutLoud`,
  },
  {
    id: "spark-builders:2026-10-27:19:00:instagram",
    topic: "The answer isn't less screen",
    caption: `People ask if this is a break from screens. It isn't, and that's deliberate.

Block the channel a feed exploits and you block the same one wonder and learning come through. Taking it away doesn't build anything.

The aim is a kid holding the wheel instead of being steered by it. Author, not spectator.

Which is why the thinking happens on paper, with people — noticing, asking, sketching, deciding — and the making only starts once the kid knows what they actually want.

Start with what they'd want to make: ${DEST}

#SparkBuilders #ParentingOutLoud #KidsWhoBuild`,
  },
  {
    id: "spark-builders:2026-11-01:11:00:facebook",
    topic: "Week two is an interview, not a build",
    caption: `The second session of a cohort has no building in it at all.

The kid goes and interviews the person who actually has the problem. A parent, a friend, a teacher. They come back with real quotes — what the person said, not what the kid assumed they'd say.

It's the step everyone wants to skip, and it's the one that decides whether the thing is any good. You can't fix a problem you only imagined.

It's also the step with no screen in it whatsoever. A kid, a notebook, and somebody who has to answer honestly.

The first two steps of that loop are the sheet: notice it, then go ask.

https://${DEST}

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools`,
  },
];

/**
 * The `facts` string brands.ts carries for a topic title.
 *
 * Read out of the source rather than restated here, so a record can never be
 * pinned to wording that has drifted from the brand file. Both the topic list
 * and the evergreens are searched: `topicsFromPool` labels literal topics
 * "evergreen" downstream anyway, so the two are the same kind of thing here.
 */
function factsFor(title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `title:\\s*"${escaped}",\\s*\\n\\s*facts:\\s*\\n?\\s*"((?:[^"\\\\]|\\\\.)*)"`,
  );
  const m = BRANDS.match(re);
  if (!m) return null;
  return JSON.parse(`"${m[1]}"`);
}

const records = {};
const problems = [];

for (const post of POSTS) {
  const facts = factsFor(post.topic);
  if (!facts) {
    problems.push(`no topic in brands.ts titled "${post.topic}"`);
    continue;
  }
  // brand:date:HH:MM:platform — the colon inside the time is why this is split
  // by position rather than destructured.
  const parts = post.id.split(":");
  if (parts.length !== 5) {
    problems.push(`${post.id}: not a slot id`);
    continue;
  }
  const time = `${parts[2]}:${parts[3]}`;
  const platform = parts[4];
  const hashtags = post.caption.match(/#\w+/g) ?? [];
  if (!post.caption.includes(DEST)) {
    problems.push(`${post.id}: caption never names ${DEST}`);
  }
  if (platform === "instagram" && post.caption.includes("https://")) {
    problems.push(`${post.id}: an Instagram caption must not paste a URL — it is dead text there`);
  }
  if (platform === "facebook" && !post.caption.includes(`https://${DEST}`)) {
    problems.push(`${post.id}: a Facebook caption should carry the clickable link`);
  }
  records[post.id] = {
    caption: post.caption,
    suggested_hashtags: hashtags,
    recommended_post_time: time,
    platform_notes: `Written by hand on 2026-09-14 — the app's writer had no API credit. Parent-facing; sends to ${DEST}.`,
    generatedAt: new Date().toISOString(),
    topic: { title: post.topic, context: facts, source: "evergreen" },
  };
}

if (problems.length) {
  console.error("refusing to write:\n  " + problems.join("\n  "));
  process.exit(1);
}

const ids = Object.keys(records);
console.log(`${ids.length} caption records built, all topics matched against brands.ts`);
for (const id of ids) {
  const r = records[id];
  console.log(`  ${id}  ${String(r.caption.length).padStart(4)} chars  ${r.topic.title}`);
}

if (!WRITE) {
  console.log("\ndry run — nothing written. Re-run with --write");
  process.exit(0);
}

if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN is not set");
  process.exit(1);
}

let written = 0;
for (const id of ids) {
  await put(`caption-parts/${encodeURIComponent(id)}.json`, JSON.stringify({ id, ...records[id] }), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 0,
  });
  written++;
  console.log(`wrote ${id}`);
}
console.log(`\n${written} of ${ids.length} written`);
