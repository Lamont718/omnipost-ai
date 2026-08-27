import Anthropic from "@anthropic-ai/sdk";
import { Brand } from "./brands";
import { Platform, VoiceProfile, GenerateResponse } from "./types";
import { Budget, BudgetExceededError } from "./spend";

/** The one place the model id lives, so pricing in spend.ts can't drift from it. */
const MODEL = "claude-opus-4-8";

/**
 * Caption writing. Shared by the on-demand API route and the weekly cron so
 * both produce identical output for the same brand and topic.
 *
 * Model note: this is short-form brand-voice copy — one call, a few hundred
 * tokens out. Opus 4.8 at medium effort is the right tier. Don't reach for a
 * heavier model here; the win would be nil and the bill doubles.
 */

let client: Anthropic | null = null;

/** Lazy so a missing key fails at request time, not at build time. */
function anthropic(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function emojiRule(style: VoiceProfile["emoji_style"]): string {
  switch (style) {
    case "none":
      return "Do NOT use any emojis.";
    case "minimal":
      return "Use emojis sparingly — only when they add warmth or clarity, never decorative. Maximum 2 per post.";
    default:
      return "Use emojis for emphasis and humor, but never more than 2 per post and never randomly.";
  }
}

/**
 * What the post carries. A Reel is written differently from a photo post, and
 * the difference is not decorative: on a Reel the first line is the only line
 * most people read before "more", and it is the line that decides whether a
 * stranger stays.
 */
export interface PostMedia {
  kind: "image" | "video";
  /** What the clip shows. Only ever text a human wrote down — see brands.ts. */
  describes?: string;
}

function platformRule(platform: Platform, media?: PostMedia): string {
  switch (platform) {
    case "linkedin":
      return "Write 2-3 short paragraphs. Professional tone. No emojis. End with a professional close.";
    case "x":
      return media?.kind === "video"
        ? "Keep it under 280 characters including hashtags. Punchy and shareable. A short video is attached — do not describe it."
        : "Keep it under 280 characters including hashtags. Punchy and shareable.";
    case "instagram":
      return media?.kind === "video"
        ? [
            "This post is an Instagram REEL: a short silent video, not a photo.",
            "Front-load the hook. The first line is the only line most people see before the caption is cut off by “more”, so it has to work completely on its own and give a stranger a reason to stop.",
            "Keep it tighter than a photo caption — the video is doing the looking.",
            "Never tell anyone to look at, swipe, or tap the picture.",
          ].join(" ")
        : "Visual storytelling tone. The caption should complement an image, not describe it.";
    case "facebook":
      return "Conversational and community-oriented. Can run slightly longer.";
  }
}

/**
 * Ceilings the platform itself enforces, as opposed to house style.
 *
 * Only X actually rejects an overlong post, so it is the only one listed — a
 * caption over this is not "a bit long", it is unpostable. The rule in
 * `platformRule()` asks the model for 280; asking is not the same as checking,
 * and a 287-character X post reached the September calendar because nothing
 * verified it. `composePost` now measures and rewrites.
 *
 * `.length` is the right measure here rather than code-point count: X weights
 * most emoji as 2 characters, and a non-BMP emoji is exactly 2 UTF-16 units, so
 * the two agree. It stays slightly conservative, which is the safe direction.
 */
export const PLATFORM_LIMIT: Partial<Record<Platform, number>> = { x: 280 };

/** How many rewrites to spend pulling an overlong caption back under the limit. */
const LENGTH_RETRIES = 2;

/**
 * The opening line of a Reel caption, in characters.
 *
 * Not the same kind of number as PLATFORM_LIMIT. X REJECTS a post over 280;
 * Instagram merely truncates, and the caption still publishes — so this is a
 * design target, not a ceiling, and it is enforced softly.
 *
 * It still matters. The whole reason to write a Reel differently is that the
 * first line is the only line a stranger reads before deciding to scroll on,
 * and one of the first thirty-one captions opened with a 320-character
 * paragraph that Instagram would cut off mid-sentence. The rule asked for a
 * front-loaded hook and nothing measured it, which is exactly how a
 * 287-character X post reached the September calendar.
 *
 * TRIGGER is deliberately well above TARGET so this fires on the ones that are
 * genuinely a wall of text — it caught 1 of 31 — rather than spending a second
 * model call on every post to shave a few characters.
 */
const HOOK_TARGET = 125;
const HOOK_TRIGGER = 180;

function buildSystemPrompt(
  brandName: string,
  voice: VoiceProfile,
  platform: Platform,
  media?: PostMedia,
): string {
  return `You are the social media voice for ${brandName}. You write authentic, purpose-driven social media content.

BRAND VOICE:
- Tone: ${voice.tone}
- Target Audience: ${voice.audience}
- Cultural Context: ${voice.cultural_context}
- Emoji Style: ${emojiRule(voice.emoji_style)}

BANNED WORDS (never use these): ${voice.banned_words.join(", ")}

PREFERRED HASHTAGS: ${voice.hashtags.join(" ")}

${voice.keywords?.length ? `KEY TOPICS: ${voice.keywords.join(", ")}` : ""}

PLATFORM: ${platform}
${platformRule(platform, media)}

CONTENT RULES (non-negotiable):
1. Never use generic motivational filler like "Every day is a chance to..." or "In a world where..."
2. Never stack more than 2 emojis in a single post
3. Write from authentic community knowledge — you LIVE this work
4. Captions must feel like they were written by a real person, not a marketing bot
5. Keep captions under 150 words unless the context demands more
6. Every post must have a clear purpose: inform, celebrate, recruit, or inspire action
7. NEVER put hashtags mid-sentence — always place them at the end
8. Be specific, not generic. Use real details from the topic rather than restating it.

FACTUAL GROUNDING (the most important rule here):
The VERIFIED FACTS block in the user message is the only place you may take
specifics from. Prices, counts, dates, names, features, category lists, product
contents, statistics — if it is not in that block, you do not know it, and you
must not write it.

This applies even when a detail feels obvious or safe to guess. If the facts say
"seven categories" but do not name them, you may write "seven categories" and you
may NOT name any of them. If the facts mention a discount code, use it exactly;
if they don't, don't invent one. When a post would be better with a detail you
don't have, write around it or make the post about something else — a vaguer
post is always better than a confidently wrong one.

If there is no VERIFIED FACTS block, write from the brand voice and the angle
alone, and include no specifics whatsoever.

NEVER INVENT SOCIAL PROOF:
Do not write quotes, testimonials, messages, reviews, or anecdotes and present
them as real events. No "a parent messaged us last week", no "one of our coaches
said", no "a customer told us". These read as true to everyone who sees the post
and they are not — for a nonprofit or a children's brand that is a real problem,
not a stylistic one.

Write the same idea as a general observation instead. "A parent told us their son
started teaching them" becomes "Kids who see themselves in a story start
retelling it — often to you." If an angle only works as an anecdote, write about
the practice or belief behind it.

Respond with ONLY a JSON object in this exact format:
{
  "caption": "the full post caption with hashtags at the end",
  "suggested_hashtags": ["#tag1", "#tag2"],
  "recommended_post_time": "a suggested time like '10:00 AM EST' based on platform best practices",
  "platform_notes": "one sentence about why this caption works for this platform"
}`;
}

/** Pull the JSON object out of the reply, tolerating stray prose around it. */
function parseReply(text: string, voice: VoiceProfile): GenerateResponse {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : text) as GenerateResponse;
  } catch {
    return {
      caption: text,
      suggested_hashtags: voice.hashtags,
      recommended_post_time: "10:00 AM EST",
      platform_notes: "AI-generated content",
    };
  }
}

export async function composePost(opts: {
  brand: Brand;
  /** What to write about. `context` is verified page copy — see the grounding rule. */
  topic: { title: string; context?: string };
  platform: Platform;
  toneOverride?: string;
  /**
   * Captions for this brand that he marked as having worked — see lib/examples.ts.
   * Tone only; the block below is explicit that they carry no usable facts.
   */
  examples?: string[];
  /**
   * Captions this brand has already published about this exact topic.
   *
   * Not tone examples — the opposite. These are the things not to say again.
   * See `priorCaptionsForTopic` in lib/store.ts for why they exist.
   */
  alreadySaid?: string[];
  /**
   * True things about the brand, typed by Lamont on /facts. These ARE usable
   * specifics — a human wrote them down deliberately, which is precisely the
   * grounding the thin-page brands never had.
   */
  brandFacts?: string[];
  /** Per-run spend ceiling. Generation throws once it is reached. */
  budget?: Budget;
  /**
   * The picture or clip this post will carry, decided before it is written.
   *
   * A caption written blind and then handed a video is a caption that will
   * sooner or later describe the wrong five seconds, which is the same failure
   * as a caption re-paired with the wrong topic.
   */
  media?: PostMedia;
}): Promise<GenerateResponse> {
  const { brand, topic, platform, toneOverride, examples, alreadySaid, brandFacts, budget, media } =
    opts;
  const system = buildSystemPrompt(brand.name, brand.voice, platform, media);

  const parts = [`Write a ${platform} post about: ${topic.title}`];
  if (topic.context) {
    parts.push(
      `VERIFIED FACTS (the only specifics you may use):\n"""\n${topic.context}\n"""`,
    );
  } else {
    parts.push(
      "VERIFIED FACTS: none available. Use no specific numbers, names, prices or feature lists.",
    );
  }
  // What is on screen. Placed with the facts because that is what it is: a
  // sentence a human wrote after watching the clip. The prohibition matters as
  // much as the description — an illustrated character next to a post about a
  // real aviator is fine, and "watch her take to the sky" is not, because it
  // tells a reader the video shows something it does not.
  if (media?.kind === "video") {
    parts.push(
      media.describes
        ? `THE VIDEO ON THIS POST (about five seconds, silent, illustrated):
"""
${media.describes}
"""

` +
            "That is the brand's own illustrated character, not footage of anything in " +
            "the topic. It does not show any real person, place or event named in this " +
            "post, and it is not evidence of anything. Do not narrate it, do not write " +
            '"watch her…" or "see the moment…", and never imply the clip depicts the ' +
            "subject. The video is what makes someone stop scrolling; the caption carries " +
            "the meaning. Write a first line that works whether or not it plays."
        : "THE VIDEO ON THIS POST: a short silent clip of the brand's own illustrated " +
            "character. You have not been told what it shows, so do not refer to it at " +
            "all — write a caption that stands on its own.",
    );
  }

  // Facts about the brand itself, as opposed to about this topic's page. These
  // count as verified — he typed them — so they widen what a post is allowed to
  // say. For a brand whose whole site yields two topics, this is the difference
  // between ten posts that repeat and ten posts that don't.
  if (brandFacts?.length) {
    parts.push(
      `VERIFIED FACTS ABOUT ${brand.name.toUpperCase()} (also usable as specifics):\n` +
        brandFacts.map((f) => `- ${f}`).join("\n") +
        "\n\nUse at most one or two, whichever genuinely fits the angle, and work them " +
        "into the writing rather than listing them. They are ordered for you — prefer " +
        "the earlier ones. Everything above about not inventing detail still applies: " +
        "these are the only brand specifics you have.",
    );
  }

  // Rules that only bite on some topics, selected here rather than left for the
  // model to infer from the background paragraph. Matched against the title and
  // the verified facts together, because the distinguishing detail is usually in
  // the facts (a YODM card's category lives in its page description).
  const haystack = `${topic.title}\n${topic.context ?? ""}`;
  const constraints = (brand.voice.topic_constraints ?? []).filter(
    (c) => (!c.when || c.when.test(haystack)) && (!c.unless || !c.unless.test(haystack)),
  );
  if (constraints.length) {
    parts.push(
      "HARD CONSTRAINTS FOR THIS TOPIC — these override everything above:\n" +
        constraints.map((c) => `- ${c.rule}`).join("\n"),
    );
  }

  // What this brand has already posted about this same topic. Placed before the
  // tone examples deliberately: the examples say "sound like this", and a rule
  // about what not to repeat has to be read before an invitation to imitate.
  if (alreadySaid?.length) {
    parts.push(
      "ALREADY POSTED BY THIS BRAND ABOUT THIS EXACT TOPIC:\n" +
        alreadySaid.map((c, i) => `${i + 1}. """${c}"""`).join("\n\n") +
        "\n\nThis is a repeat visit to the same subject, which is fine — saying the " +
        "same thing again is not. Take a different angle: a different opening line, a " +
        "different specific from the facts above, a different question or call to " +
        "action. If the only honest angle is one of the above, say it in genuinely " +
        "different words rather than reordering theirs. These carry no new facts.",
    );
  }

  // Past posts he judged to have worked. Placed after the facts and the hard
  // constraints so nothing here can read as permission to loosen them, and
  // fenced with an explicit warning: every fabrication in this repo's history
  // began with the model lifting a plausible specific out of nearby text, and
  // three real captions about other subjects is exactly that hazard.
  if (examples?.length) {
    parts.push(
      "POSTS FROM THIS BRAND THAT WORKED — match their REGISTER only:\n" +
        examples.map((e, i) => `${i + 1}. """${e}"""`).join("\n\n") +
        "\n\nThese are here for rhythm, sentence length, how the hook opens and how " +
        "hard the ending pushes. They are NOT facts and NOT this post's subject. Do " +
        "not reuse their specifics, their hooks, their examples or their hashtags, " +
        "and do not write about what they are about. Write about the topic above.",
    );
  }

  if (examples?.length) {
    // Worth a line in the logs: it's the only visible sign that anything the
    // app has learned reached the thing that writes.
    console.log(`compose: ${brand.slug} ${platform} — ${examples.length} tone example(s)`);
  }

  if (toneOverride) parts.push(`Tone adjustment: ${toneOverride}`);
  const userPrompt = parts.join("\n\n");

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];
  let best = await generate(system, messages, brand.voice, budget);

  // Ask, then check. The model is told the limit up front but does overshoot,
  // and an over-limit X caption is unpostable rather than merely untidy. Hand
  // back its own draft with the arithmetic and let it cut.
  const limit = PLATFORM_LIMIT[platform];
  if (limit) {
    for (let attempt = 0; attempt < LENGTH_RETRIES && best.caption.length > limit; attempt++) {
      const over = best.caption.length - limit;
      messages.push(
        { role: "assistant", content: JSON.stringify(best) },
        {
          role: "user",
          content:
            `That caption is ${best.caption.length} characters — ${over} over the ${limit}-character ` +
            `limit for ${platform}. Rewrite it under ${limit} characters including hashtags. Cut words, ` +
            `not facts: keep the same subject and every verified detail, and do not add anything new. ` +
            `Reply with the same JSON shape.`,
        },
      );
      const retry = await generate(system, messages, brand.voice, budget);
      // Keep whichever is shortest — a retry that came back longer is no use.
      if (retry.caption.length < best.caption.length) best = retry;
      if (best.caption.length <= limit) break;
    }

    if (best.caption.length > limit) {
      // Surfaced rather than swallowed: the caller stores this, and a silently
      // overlong caption is exactly the failure this block exists to stop.
      console.warn(
        `[compose] ${brand.slug}/${platform}: caption still ${best.caption.length} chars ` +
          `after ${LENGTH_RETRIES} rewrites (limit ${limit}) — topic: ${topic.title}`,
      );
    }
  }

  // The Reel hook. Same shape as the length pass above and for the same reason:
  // the instruction was already in the prompt, and asking is not checking.
  if (media?.kind === "video" && platform === "instagram") {
    const opening = firstLine(best.caption);
    if (opening.length > HOOK_TRIGGER) {
      messages.push(
        { role: "assistant", content: JSON.stringify(best) },
        {
          role: "user",
          content:
            `That caption opens with a ${opening.length}-character paragraph. Instagram cuts a ` +
            `caption off after roughly ${HOOK_TARGET} characters, so a reader sees it break ` +
            `mid-sentence and scrolls on. Rewrite it so the FIRST line is a hook under ` +
            `${HOOK_TARGET} characters that works on its own, with a line break after it. ` +
            `Keep every fact, every verified detail and the same subject — move the words, ` +
            `do not add any. Reply with the same JSON shape.`,
        },
      );
      const retry = await generate(system, messages, brand.voice, budget);
      if (firstLine(retry.caption).length < opening.length) best = retry;
      console.log(
        `compose: ${brand.slug} reel hook ${opening.length} -> ${firstLine(best.caption).length} chars`,
      );
    }
  }

  return best;
}

/** The caption's opening line, which is all Instagram shows before "more". */
function firstLine(caption: string): string {
  return caption.split("\n")[0].trim();
}

async function generate(
  system: string,
  messages: Anthropic.MessageParam[],
  voice: VoiceProfile,
  budget?: Budget,
): Promise<GenerateResponse> {
  // Checked before the request, not after: the point is to stop new spending,
  // and a check on the way out would only ever report a bill already incurred.
  if (budget?.exceeded()) {
    throw new BudgetExceededError(budget.spent(), budget.limit);
  }

  const message = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system,
    messages,
  });

  budget?.record(MODEL, message.usage);

  // With adaptive thinking, content[0] may be a thinking block.
  const block = message.content.find((b) => b.type === "text");
  return parseReply(block && block.type === "text" ? block.text : "", voice);
}
