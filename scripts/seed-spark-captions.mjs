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
import { readFileSync, existsSync } from "node:fs";
import { put } from "@vercel/blob";

const WRITE = process.argv.includes("--write");
const BRANDS = readFileSync(new URL("../src/lib/brands.ts", import.meta.url), "utf8");

/** The bare domain these posts send people to, as configured on the brand. */
const DEST = "sparkbuilders.org/discovery";

/*
 * Where each post's picture lives, written by scripts/upload-spark-library.mjs.
 *
 * Pinned onto the record by name rather than left to `libraryFor`'s hash. The
 * hash spreads a library across posts evenly, which is right when the pictures
 * are interchangeable and wrong here: the Ways Out screenshot belongs to the
 * Ways Out post and nowhere else. A pinned image also outranks every derivation
 * in `resolveStill`, including the generated card these were built to replace.
 */
const MANIFEST = process.argv.find((a) => a.startsWith("--manifest="))?.slice(11);
const IMAGES = MANIFEST && existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, "utf8"))
  : {};

/*
 * Rewritten 2026-09-29, on his note that the first fourteen were not making an
 * impression. They were true and they were flat, and the reasons were the same
 * in all fourteen:
 *
 *   - The explainer his 09-14 note asked for had grown into a sixty-word block
 *     pasted into every caption in slightly different words. Fourteen posts
 *     read as one post. It is now ONE sentence, still after the story, and
 *     still naming the age range and what the kid actually does.
 *   - The first line was usually a setup rather than the point. Instagram
 *     shows about 125 characters before "more", so the kid and the thing they
 *     made now arrive in that line.
 *   - Stock connective phrases ("That's the part that matters", "Here's what
 *     SPARK Builders is") that sound like a caption rather than a parent.
 *
 * And the first four dates (09-15 to 09-27) had passed with no account to post
 * them from, which put the notebook post first. The run now starts tonight and
 * opens with the builds: Emeka, Elija, Iye. The first post somebody sees is the
 * one that has to explain the program without trying to.
 *
 * No quote card repeats the opening line of its own caption — checked against
 * the text in make-spark-cards.mjs.
 */
const POSTS = [
  {
    id: "spark-builders:2026-09-29:19:00:instagram",
    image: "build-cleaning-list",
    topic: "Emeka, 7 — Our Cleaning List",
    caption: `A seven-year-old got tired of her family arguing about chores. So she built the fix.

Emeka made Our Cleaning List: one button that says "Something needs cleaning!", a job list for everyone in the house, and thank-you stars for whoever does the work. It's the chore tool her family actually uses, so the apartment stops being something to argue about.

She built it at SPARK Builders, where kids 7 to 14 pick a real problem somebody has, draw the fix by hand in a notebook, and direct a coach who builds it with them until it works.

Ask your kid what they'd fix at home. Then write down exactly what they say. The 15-minute sheet is at ${DEST}

#SparkBuilders #KidsWhoBuild #BrooklynKids #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-10-04:11:00:facebook",
    image: "build-ways-out",
    topic: "Elija, 14 — Ways Out",
    caption: `Elija is 14. He built something for the kids on his block who need help at two in the morning.

It's called Ways Out. One tap on a phone and it's all there: crisis lines, a way off the streets, and real paid youth jobs. Help against violence, around the clock, in one place.

Nobody gave him that problem. He looked at where he lives, named who was in trouble, and designed the answer himself.

That's SPARK Builders: kids 7 to 14 find a problem a real person has, go and talk to them, sketch the fix by hand, and work with two coaches until it's built. Then they give it to the people it's for.

What has your kid noticed about the neighborhood? Fifteen minutes and a pencil will tell you.

https://${DEST}

#SparkBuilders #BrooklynKids #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-10-06:19:00:instagram",
    image: "build-story-detective",
    topic: "Iye, 7 — Story Detective",
    caption: `Some kids freeze when it's time to read. Iye, 7, turned reading into a case to crack.

Story Detective is her game. Read the story or listen to it, work out what it really means, earn a detective badge. She built it for herself first. Now it's for any kid who locks up at the sight of a page.

At SPARK Builders, kids 7 to 14 start with a problem they actually feel, draw the fix in a notebook, tell the coach what's right and what's missing until it works, and then hand it to whoever needs it.

Your kid has a problem like that. Find it together in 15 minutes: ${DEST}

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-10-11:11:00:facebook",
    image: "quote-the-sheet",
    topic: "Fifteen minutes at the kitchen table",
    caption: `Parents, here's your whole job: you're the scribe, not the answer key.

That's the instruction on the SPARK Discovery sheet. Read each question out loud. Then get quiet. Write down exactly what your kid says, in their words. Don't fix the grammar. Don't suggest a better answer. A blank is fine.

You're not grading anything. You're listening for the thing that makes their voice change.

Every build at SPARK Builders starts there. It's a program where kids 7 to 14 take a problem a real person has, design the fix by hand, and build it with two coaches until it works for the person who needed it. This sheet is the first two steps, done at your table.

Fifteen minutes. That's all it takes.

https://${DEST}

#SparkBuilders #ParentingOutLoud #KidsWhoBuild`,
  },
  {
    id: "spark-builders:2026-10-13:19:00:instagram",
    image: "build-together",
    topic: "Kourtney, 14 — Together",
    caption: `Kourtney is 14. She gave her family two minutes a day that nobody gets to skip.

It's called Together. Everyone says how they really feel, answers one connection question, and protects a little real time with each other. Two minutes. Her family uses it.

She made it at SPARK Builders, where kids 7 to 14 notice a real problem at home, at school or down the block, sketch the fix in a notebook, and direct a coach who builds it until it works, then give it to the people it's for.

Your kid has noticed things about your house. Ask them. The 15-minute sheet: ${DEST}

#SparkBuilders #ParentingOutLoud #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-10-18:11:00:facebook",
    image: "quote-i-dont-know",
    topic: "It shows up the first time anything breaks",
    caption: `The laptop dies. There's no charger. And instead of working it out, your kid just… stops.

If you've watched that happen, you're not imagining it, and it isn't laziness. The part of a kid that says "this is hard, let me figure it out" never got a workout, because nothing smooth ever asked for one.

SPARK Builders is where it gets one. Kids 7 to 14 choose a real problem somebody has, interview that person, design the fix on paper, and stay with it through every version that breaks, a coach beside them, until it works and they hand it over.

It's a lot easier to keep going on something you drew yourself, for somebody you know.

Start with 15 minutes and one question: what's hard for your kid?

https://${DEST}

#SparkBuilders #ParentingOutLoud #KidsWhoBuild`,
  },
  {
    id: "spark-builders:2026-10-20:19:00:instagram",
    image: "build-star-math",
    topic: "Star Math, built by a seven-year-old",
    caption: `Math practice was the most boring part of the school day. A seven-year-old rebuilt it, and now her whole class uses it.

It's called Star Math. It's live today, and it measures each kid's real growth. The most boring part of the day became the win the whole room shares.

She did it through SPARK Builders. Kids 7 to 14 take something that isn't working for real people, redesign it by hand in a notebook, and judge every version a coach builds until it's right. Then it goes to the people who need it.

Which part of your kid's day would they rebuild? Find out in 15 minutes: ${DEST}

#SparkBuilders #KidsWhoBuild #BrooklynKids`,
  },
  {
    id: "spark-builders:2026-10-25:11:00:facebook",
    image: "quote-their-name",
    topic: "We build it exactly as they drew it",
    caption: `We build exactly what the kid drew. Not a better version. Not what a grown-up would have done with it.

Then we put it in front of them and ask three questions. What do you notice? What's right? What's missing?

And they see it: the gap between what was in their head and what showed up. That gap is where a designer is born. They grab the notebook, redraw it, and we build it again. And again.

That loop is SPARK Builders. Kids 7 to 14 find a real problem somebody has, design the fix by hand, and direct two coaches through version after version until it works for the person who needed it.

The first drawing starts at your kitchen table.

https://${DEST}

#SparkBuilders #KidsWhoBuild #ParentingOutLoud`,
  },
  {
    id: "spark-builders:2026-10-27:19:00:instagram",
    image: "quote-the-notebook",
    topic: "Every kid gets a notebook before anything gets built",
    caption: `Before anything gets built, every SPARK kid gets a real notebook.

What they notice goes in it. What they want goes in it, drawn by hand. Leonardo kept his ideas the same way. The build grows out of those pages, never the other way round.

SPARK Builders is a program for kids 7 to 14 where the noticing, asking and sketching all happen with pen, paper and people. Then a coach builds what the kid designed, and the kid decides what's right, what's missing, and who it goes to.

Find them a pen tonight. The first page starts with our 15-minute sheet: ${DEST}

#SparkBuilders #KidsWhoBuild #ParentingOutLoud`,
  },
  {
    id: "spark-builders:2026-11-01:11:00:facebook",
    image: "pillars-four-places",
    topic: "The four places a builder looks",
    caption: `Ask a kid "what's a problem you could solve?" and you'll probably get a shrug. Ask these four instead.

What's hard for me, and who else feels it?
What's hard for my family?
What's hard for kids and teachers at my school?
What's hard for people around me?

Closest to widest. Most kids start with themselves, because that's the one they can see without help. Then the question keeps turning outward until it's about somebody else. That turn is the point.

It's step one at SPARK Builders, a program where kids 7 to 14 pick one of those problems, interview the person who has it, design the fix by hand, and build it with two coaches, then give it away.

Try the four questions tonight.

https://${DEST}

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-11-03:19:00:instagram",
    image: "quote-stuck",
    topic: "The moment it breaks is the lesson",
    caption: `The best moment in a SPARK session? The second the thing breaks.

Because now the kid is standing in front of a real problem they care about. Not a worksheet. Theirs.

Nobody rescues it. The coach asks what happened and explains it in words the kid already uses. "Oh, I see." Then out comes the notebook, and they redraw.

SPARK Builders is a program for kids 7 to 14: find a problem a real person has, sketch the fix, judge every version a coach builds, and keep going until it works and goes to the person who needed it.

Find what your kid would build: ${DEST}

#SparkBuilders #KidsWhoBuild #ParentingOutLoud`,
  },
  {
    id: "spark-builders:2026-11-08:11:00:facebook",
    image: "quote-real-quotes",
    topic: "Week two is an interview, not a build",
    caption: `Before a SPARK kid builds anything, they go and ask.

They find the person who has the problem: a parent, a friend, a teacher. They come back with that person's actual words, not what the kid guessed they'd say.

It's the step everybody wants to skip. It's also the one that decides whether the build is any good.

That's how SPARK Builders works. Kids 7 to 14 notice a real problem, interview the person who lives with it, design the fix by hand in a notebook, and build it with two coaches until it works, then hand it over.

Want to practice the asking part at home? That's what the sheet is for.

https://${DEST}

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-11-10:19:00:instagram",
    image: "quote-star-lights",
    topic: "A star lights when a real person uses it",
    caption: `Finishing a build doesn't count here. Giving it away does.

When a kid hands what they made to a real person who needed it, a star lights, and every builder grows their own constellation. The ones lit so far include a chore list, a reading game, a two-minute family ritual and a hub for kids who need a way out.

That's SPARK Builders: kids 7 to 14 notice a problem somebody has, sketch the fix in a notebook, direct a coach through building it, and then give it to them.

Your kid's first star starts with a 15-minute conversation: ${DEST}

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools #BrooklynKids`,
  },
  {
    id: "spark-builders:2026-11-15:11:00:facebook",
    image: "quote-not-less-screen",
    topic: "The answer isn't less screen",
    caption: `People ask if SPARK is a break from screens. It isn't, and that's on purpose.

Cut a kid off from the feed and you also cut them off from the channel wonder and learning come through. Taking something away doesn't build anything.

So we build. At SPARK Builders, kids 7 to 14 do all their thinking on paper and with people: noticing a real problem somebody has, asking them about it, sketching the fix. Then a coach makes it real while the kid calls every shot, fixes what breaks, and hands it to the person who needed it. Two coaches in the room.

Author, not spectator.

Start with what your kid would want to make.

https://${DEST}

#SparkBuilders #ParentingOutLoud #KidsWhoBuild`,
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
const pinned = {};
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
  if (post.image) {
    const url = IMAGES[post.image];
    if (!url) {
      problems.push(`${post.id}: no uploaded picture called "${post.image}" — run upload-spark-library.mjs first`);
    } else {
      pinned[post.id] = { url, name: post.image };
    }
  }
  records[post.id] = {
    caption: post.caption,
    ...(pinned[post.id] ? { image: pinned[post.id] } : {}),
    suggested_hashtags: hashtags,
    recommended_post_time: time,
    platform_notes: `Written by hand, rewritten 2026-09-29 — the app's writer had no API credit. Parent-facing; sends to ${DEST}.`,
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
  console.log(`  ${id}  ${String(r.caption.length).padStart(4)} chars  ${(r.image?.name ?? 'NO IMAGE').padEnd(22)} ${r.topic.title}`);
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
