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
 * Rewritten 2026-10-06, on his note: "the spark builders post are generic in
 * the text it doesnt even say what spark is about or any description".
 *
 * The 09-29 set did describe the program, but in the THIRD paragraph, after
 * the kid's story. Instagram shows about 125 characters before "more", so a
 * stranger saw a kid and a problem and never reached the sentence that says
 * what SPARK Builders is. Every post now names SPARK Builders in its first
 * line and says what it is by the second, then tells the story, then says how
 * it works — the seven moves, two coaches, the kid designs and the coach types,
 * a build counts once a real person uses it. Those specifics are read off
 * sparkbuilders.org (homepage, 2026-10-06) and the topic facts in brands.ts.
 *
 * Covers every slot from tonight to the end of December, including the
 * thirteen from 17 Nov that had never been written — the writer still has no
 * API credit. A topic that comes round again gets a different angle, not the
 * same caption twice.
 */
const POSTS = [
  {
    id: "spark-builders:2026-10-06:19:00:instagram",
    image: "build-story-detective",
    topic: "Iye, 7 — Story Detective",
    caption: `SPARK Builders is a program where kids 7 to 14 find a real problem in their own world and build the fix. Iye is 7. Her problem was reading.

Some kids freeze when it's time to read. Iye was one of them, so she turned reading into a case to crack. Story Detective is her game: read the story or listen to it, work out what it really means, earn a detective badge. She built it for herself first. Now it's for any kid who locks up at the sight of a page.

How it works: Iye noticed the problem, drew the fix by hand in her notebook, and told the coach what was right and what was missing until it worked. The kid does the thinking. The coach does the typing. Two coaches in every session.

What would your kid fix? Find out together in 15 minutes: sparkbuilders.org/discovery

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-10-11:11:00:facebook",
    image: "quote-the-sheet",
    topic: "Fifteen minutes at the kitchen table",
    caption: `What is SPARK Builders? A program for kids 7 to 14 built on one way of thinking: notice a real problem somebody has, listen to them, design the fix by hand, build it, and give it away. It starts with a sheet you can do at your kitchen table tonight.

The SPARK Discovery sheet takes 15 minutes. Your job, in the sheet's own words: you're the scribe, not the answer key. Read each question out loud. Get quiet. Write down exactly what your kid says. Don't fix the grammar, don't suggest a better answer. A blank is fine.

You're not grading anything. You're listening for the one thing your kid lights up about. That's where every SPARK build begins, and it covers the first two of the seven moves SPARK kids practice: Identify and Research.

https://sparkbuilders.org/discovery

#SparkBuilders #ParentingOutLoud #KidsWhoBuild`,
  },
  {
    id: "spark-builders:2026-10-13:19:00:instagram",
    image: "build-together",
    topic: "Kourtney, 14 — Together",
    caption: `Kourtney is 14. At SPARK Builders she built something for her family: two minutes a day nobody gets to skip.

SPARK Builders is where kids 7 to 14 look at their own home, school or block, find something that's hard for real people, and build the fix with two coaches.

Kourtney's build is called Together. Everyone says how they really feel, answers one connection question, and protects a little real time with each other. Her family uses it, and that's the only way a build counts at SPARK: it has to be given to a real person.

Your kid has noticed things about your house. Ask them. The 15-minute sheet: sparkbuilders.org/discovery

#SparkBuilders #ParentingOutLoud #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-10-18:11:00:facebook",
    image: "quote-i-dont-know",
    topic: "It shows up the first time anything breaks",
    caption: `SPARK Builders is a program for kids 7 to 14 that works on one skill: the part of a kid that says "this is hard, let me figure it out."

You've probably seen it missing. The laptop dies, there's no charger, and instead of working it out your kid just… stops. It isn't laziness. That part never got a workout, because nothing smooth ever asked for one.

At SPARK, kids get that workout on purpose. They choose a real problem somebody has, interview that person, design the fix on paper, and stay with it through every version that breaks until it works and they hand it over. Two coaches run every session. The goal isn't the app. It's the way of thinking they keep afterward.

Start with 15 minutes and one question: what's hard for your kid?

https://sparkbuilders.org/discovery

#SparkBuilders #ParentingOutLoud #KidsWhoBuild`,
  },
  {
    id: "spark-builders:2026-10-20:19:00:instagram",
    image: "build-star-math",
    topic: "Star Math, built by a seven-year-old",
    caption: `Math practice was the most boring part of the school day. A 7-year-old at SPARK Builders rebuilt it, and now her whole class uses it.

SPARK Builders is a program where kids 7 to 14 take something that isn't working for real people and design a better one by hand.

Hers is called Star Math. It started from her school's own math practice, it's live today, and it measures each kid's real growth. The most boring part of the day became the win the whole room shares.

She drew it, judged every version the coach built, and kept going until it was right.

Which part of your kid's day would they rebuild? 15 minutes to find out: sparkbuilders.org/discovery

#SparkBuilders #KidsWhoBuild #BrooklynKids`,
  },
  {
    id: "spark-builders:2026-10-25:11:00:facebook",
    image: "quote-their-name",
    topic: "We build it exactly as they drew it",
    caption: `At SPARK Builders the kid is the designer. We build exactly what they drew. Not a better version. Not what a grown-up would have done.

SPARK Builders is a program for kids 7 to 14. Each one finds a real problem somebody has, sketches the fix in a notebook, and directs two coaches through building it.

Then we put the first version in front of them and ask three questions. What do you notice? What's right? What's missing?

They see the gap between what was in their head and what showed up. That gap is where a designer is born. They grab the notebook, redraw it, and we build it again, and again, until it works for the person who needed it.

The first drawing can start at your kitchen table.

https://sparkbuilders.org/discovery

#SparkBuilders #KidsWhoBuild #ParentingOutLoud`,
  },
  {
    id: "spark-builders:2026-10-27:19:00:instagram",
    image: "quote-the-notebook",
    topic: "Every kid gets a notebook before anything gets built",
    caption: `Every kid at SPARK Builders gets a real notebook, and nothing gets built until there's something in it.

SPARK Builders is a program where kids 7 to 14 notice a real problem, design the fix by hand, and build it with two coaches until a real person can use it.

The notebook is where that starts. What they notice goes in it. What they want gets drawn, by hand. The site compares it to Leonardo's notebooks: the journal is the seed, and the build grows from it.

Start one together. The 15-minute sheet: sparkbuilders.org/discovery

#SparkBuilders #KidsWhoBuild #ParentingOutLoud`,
  },
  {
    id: "spark-builders:2026-11-01:11:00:facebook",
    image: "pillars-four-places",
    topic: "The four places a builder looks",
    caption: `SPARK Builders teaches kids 7 to 14 to find a real problem and build the fix. The first question is always where to look.

Ask a kid "what's a problem you could solve?" and you'll probably get a shrug. SPARK sends them to four places instead, closest to widest:

Yourself: What's hard for me, and who else feels it?
Your Home: What's hard for my family?
Your School: What's hard for kids and teachers here?
Your Community: What's hard for people around me?

Every SPARK builder started in one of those four. A 7-year-old ended the chore fights at home. A 14-year-old built a one-tap help hub for kids on his block.

Try the four questions at dinner. The sheet walks you through it in 15 minutes.

https://sparkbuilders.org/discovery

#SparkBuilders #ParentingOutLoud #KidsWhoBuild`,
  },
  {
    id: "spark-builders:2026-11-03:19:00:instagram",
    image: "quote-stuck",
    topic: "The moment it breaks is the lesson",
    caption: `At SPARK Builders, the best moment in a session is the second the thing breaks.

SPARK Builders is a program where kids 7 to 14 design a fix for a real problem somebody has, then build it with two coaches, version after version.

When a build breaks, the kid is standing in front of a problem they actually care about. So we slow down, explain what happened at their level, and let them pick the next move.

That's the habit they take home. The build is just where they practice it.

Find your kid's first problem in 15 minutes: sparkbuilders.org/discovery

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-11-08:11:00:facebook",
    image: "quote-real-quotes",
    topic: "Week two is an interview, not a build",
    caption: `At SPARK Builders, week two isn't building. It's an interview.

SPARK Builders is a program for kids 7 to 14: notice a real problem, listen to the person who has it, design the fix by hand, build it with two coaches, give it away, and keep improving it.

Session two is the listening part. The kid finds the person who has the problem: a parent, a friend, a teacher. They ask what's hard. Then they come back with what that person actually said, not a guess about it.

It's the step most grown-ups skip. A kid who learns to ask before building keeps that habit.

You can practice it at home. The SPARK sheet starts with exactly this, in 15 minutes.

https://sparkbuilders.org/discovery

#SparkBuilders #ParentingOutLoud #KidsWhoBuild`,
  },
  {
    id: "spark-builders:2026-11-10:19:00:instagram",
    image: "quote-star-lights",
    topic: "A star lights when a real person uses it",
    caption: `At SPARK Builders, finishing a build doesn't count. Giving it away does.

SPARK Builders is a program where kids 7 to 14 find a real problem in their own world, design the fix by hand, and build it with two coaches.

When a kid hands what they made to a real person who needed it, a star lights in the SPARK Sky, and every builder grows a constellation. Five builders, ages 7 to 14, have lit stars so far: a chore list, a reading game, a family ritual, a math tool, a help hub for kids on the block.

What would your kid give away? Start with the 15-minute sheet: sparkbuilders.org/discovery

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-11-15:11:00:facebook",
    image: "quote-not-less-screen",
    topic: "The answer isn't less screen",
    caption: `People ask if SPARK Builders is a break from screens. It isn't, and that's on purpose.

SPARK Builders is a program for kids 7 to 14. They notice a real problem, interview the person who has it, and design the fix by hand in a notebook. Then two coaches build it with them: the kid directs and judges, the coach types.

Cut a kid off from the feed and you also cut them off from what wonder and learning need. SPARK aims for something else: a kid holding the wheel of their own attention. Author, not spectator.

Want to see what your kid would author? 15 minutes at the kitchen table:

https://sparkbuilders.org/discovery

#SparkBuilders #ParentingOutLoud #KidsWhoBuild`,
  },
  {
    id: "spark-builders:2026-11-17:19:00:instagram",
    image: "quote-stuck",
    topic: "The moment it breaks is the lesson",
    caption: `When something your kid built stops working, what do they do next? At SPARK Builders, that moment is the lesson.

SPARK Builders is a program for kids 7 to 14 who pick a real problem somebody has and build the fix one version at a time, with two coaches beside them.

Version one never works the way they pictured it. So the kid looks at what broke, says what's wrong, redraws it in the notebook, and we build the next one. Improve is the last of SPARK's seven moves, and it loops back to the start. A builder never really finishes.

Start with the 15-minute sheet: sparkbuilders.org/discovery

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-11-22:11:00:facebook",
    image: "build-ways-out",
    topic: "Elija, 14 — Ways Out",
    caption: `Elija is 14. At SPARK Builders he built Ways Out, a one-tap phone hub to free, 24/7 help against violence: crisis lines, a way out of the streets, and real paid youth jobs.

He built it for kids on his block.

SPARK Builders is a program where kids 7 to 14 look at the people around them, find what's hard, and build the fix with two coaches. Elija went to the widest of the four places SPARK sends a kid to look: Your Community. He named who needed help, drew the fix, and directed the build until it worked. Then he gave it to them.

What does your kid see on your block that you don't?

https://sparkbuilders.org/discovery

#SparkBuilders #RealProblemsRealTools #BrooklynKids`,
  },
  {
    id: "spark-builders:2026-11-24:19:00:instagram",
    image: "quote-i-dont-know",
    topic: "It shows up the first time anything breaks",
    caption: `The form gets abandoned at the first confusing field. Sound familiar? SPARK Builders is built for that moment.

SPARK Builders is a program for kids 7 to 14. They find a real problem somebody has, design a fix by hand, and stick with it through every version that breaks until a real person can use it.

The muscle that says "this is hard, let me figure it out" doesn't grow on its own. It grows on something a kid cares about, made for someone they know. That's what every SPARK session is for.

15 minutes to find your kid's first problem: sparkbuilders.org/discovery

#SparkBuilders #ParentingOutLoud #KidsWhoBuild`,
  },
  {
    id: "spark-builders:2026-11-29:11:00:facebook",
    image: "build-story-detective",
    topic: "Iye, 7 — Story Detective",
    caption: `Iye is 7, and she's one of five kids who have built something real at SPARK Builders.

SPARK Builders is a program for kids 7 to 14. Each kid looks in four places for a problem: themselves, their home, their school, their community. Iye started with the closest one. Reading made her freeze.

So she designed Story Detective, a game that turns reading into solving cases. Read or listen, figure out what the story means, earn detective badges. She drew it, judged every version the coaches built, and now it's there for any kid who locks up at a page.

The problem your kid fixes might be their own, too.

https://sparkbuilders.org/discovery

#SparkBuilders #KidsWhoBuild #ParentingOutLoud`,
  },
  {
    id: "spark-builders:2026-12-01:19:00:instagram",
    image: "quote-their-name",
    topic: "A build is a story",
    caption: `At SPARK Builders, every build starts as a story: I want this to happen, then this.

SPARK Builders is a program for kids 7 to 14 who find a real problem somebody has and design the fix by hand, in a notebook, before two coaches build it with them.

Sequence. Cause and effect. What happens first, and what that leads to. It's the same thinking underneath reading, math and everything else. A kid telling the story of their build is practicing all of it, and the notebook is where the story is kept.

Ask your kid to tell you the story of something they'd fix. The 15-minute sheet helps: sparkbuilders.org/discovery

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-12-06:11:00:facebook",
    image: "quote-the-notebook",
    topic: "Every kid gets a notebook before anything gets built",
    caption: `Before anything gets built at SPARK Builders, there's a notebook, and the kid is the only one writing in it.

SPARK Builders is a program for kids 7 to 14. They notice a real problem, go ask the person who has it, and design a fix. Two coaches build it exactly as drawn, and the kid decides what's right and what's missing.

The notebook holds all of it: what they noticed, what people told them, what they want the fix to do. By hand. It's the seed the build grows from, and it stays theirs.

Got a kid who draws on everything? Start with 15 minutes at the kitchen table.

https://sparkbuilders.org/discovery

#SparkBuilders #ParentingOutLoud #KidsWhoBuild`,
  },
  {
    id: "spark-builders:2026-12-08:19:00:instagram",
    image: "pillars-four-places",
    topic: "The four places a builder looks",
    caption: `Where does a 7-year-old find a problem worth solving? SPARK Builders gives them four places to look.

SPARK Builders is a program where kids 7 to 14 notice a real problem, design the fix by hand, and build it with two coaches.

Closest to widest: Yourself. Your Home. Your School. Your Community.

Iye started with herself, and reading. Emeka started at home, with the chore fights. Elija went widest, to kids on his block.

Which place would your kid start? Find out in 15 minutes: sparkbuilders.org/discovery

#SparkBuilders #KidsWhoBuild #ParentingOutLoud`,
  },
  {
    id: "spark-builders:2026-12-13:11:00:facebook",
    image: "quote-stuck",
    topic: "The moment it breaks is the lesson",
    caption: `A lot of activities try to keep kids from getting stuck. SPARK Builders plans for it.

SPARK Builders is a program for kids 7 to 14. Each kid picks a real problem somebody has, designs the fix in a notebook, and directs two coaches through building it, one version at a time.

Something always breaks. That's when we stop and explain what happened at the kid's level, because it's a problem they actually care about. Then they choose the next small move. Do that enough times and "I'm stuck" turns into "what's next."

Start with the 15-minute sheet at your kitchen table:

https://sparkbuilders.org/discovery

#SparkBuilders #ParentingOutLoud #KidsWhoBuild`,
  },
  {
    id: "spark-builders:2026-12-15:19:00:instagram",
    image: "build-cleaning-list",
    topic: "Emeka, 7 — Our Cleaning List",
    caption: `Emeka is 7. She got tired of her family arguing about chores, so at SPARK Builders she built the fix.

SPARK Builders is a program where kids 7 to 14 find a real problem in their own life and design a tool that solves it.

Hers is Our Cleaning List, the chore tool her family actually uses, so the apartment stops being something to argue about. It helped her family and her class. Two stars lit.

She noticed the problem, drew the fix, and told the coaches what was right and what was missing until it worked.

What argument in your house could your kid end? 15 minutes: sparkbuilders.org/discovery

#SparkBuilders #KidsWhoBuild #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-12-20:11:00:facebook",
    image: "quote-i-dont-know",
    topic: "It shows up the first time anything breaks",
    caption: `A kid who quits at the first hard thing isn't lazy. They just haven't had a reason to keep going yet. SPARK Builders gives them one.

SPARK Builders is a program for kids 7 to 14. They choose a real problem somebody they know has, design the fix by hand, and build it with two coaches until that person can use it.

It's easier to push through a broken version when it's something you drew yourself, for someone you know. That's the muscle every session works: this is hard, let me figure it out.

Over the break, try 15 minutes at the kitchen table with the SPARK sheet.

https://sparkbuilders.org/discovery

#SparkBuilders #ParentingOutLoud #KidsWhoBuild`,
  },
  {
    id: "spark-builders:2026-12-22:19:00:instagram",
    image: "build-together",
    topic: "Kourtney, 14 — Together",
    caption: `What would your teenager build for your family? At SPARK Builders, Kourtney, 14, built two minutes a day nobody gets to skip.

SPARK Builders is a program where kids 7 to 14 notice what's hard for the people around them and build the fix with two coaches.

Kourtney's is Together: everyone shares how they really feel, answers one connection question, and protects real time with each other. Her family uses it. That's when a SPARK build counts: when it's given to a real person.

Ask your kid what they'd change at home. The 15-minute sheet: sparkbuilders.org/discovery

#SparkBuilders #ParentingOutLoud #RealProblemsRealTools`,
  },
  {
    id: "spark-builders:2026-12-27:11:00:facebook",
    image: "quote-their-name",
    topic: "A build is a story",
    caption: `"I want this to happen, then this." That's how every build starts at SPARK Builders: as a story.

SPARK Builders is a program for kids 7 to 14. They find a real problem somebody has, design the fix by hand in a notebook, and direct two coaches through building it until it works.

Designing a build is storytelling: what happens first, what that causes, what comes next. It's the same structure underneath writing and math. When your kid explains their fix, they're practicing all of it.

Ask them for the story of something they'd fix. The SPARK sheet makes it 15 minutes.

https://sparkbuilders.org/discovery

#SparkBuilders #KidsWhoBuild #ParentingOutLoud`,
  },
  {
    id: "spark-builders:2026-12-29:19:00:instagram",
    image: "build-star-math",
    topic: "Star Math, built by a seven-year-old",
    caption: `A 7-year-old at SPARK Builders took her school's math practice and rebuilt it. Now her whole class uses it.

SPARK Builders is a program where kids 7 to 14 take something that isn't working for real people and design a better version by hand, with two coaches.

Star Math is live today and measures each kid's real growth, with the same timed check at the start and at the latest try, inside the app she built.

What would your kid rebuild in the new year? Find out in 15 minutes: sparkbuilders.org/discovery

#SparkBuilders #KidsWhoBuild #BrooklynKids`,
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
    platform_notes: `Written by hand, rewritten 2026-10-06 — the app's writer had no API credit. Parent-facing; sends to ${DEST}.`,
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
