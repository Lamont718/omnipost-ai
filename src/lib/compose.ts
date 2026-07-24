import Anthropic from "@anthropic-ai/sdk";
import { Brand } from "./brands";
import { Platform, VoiceProfile, GenerateResponse } from "./types";

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

function platformRule(platform: Platform): string {
  switch (platform) {
    case "linkedin":
      return "Write 2-3 short paragraphs. Professional tone. No emojis. End with a professional close.";
    case "x":
      return "Keep it under 280 characters including hashtags. Punchy and shareable.";
    case "instagram":
      return "Visual storytelling tone. The caption should complement an image, not describe it.";
    case "facebook":
      return "Conversational and community-oriented. Can run slightly longer.";
  }
}

function buildSystemPrompt(
  brandName: string,
  voice: VoiceProfile,
  platform: Platform,
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
${platformRule(platform)}

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
}): Promise<GenerateResponse> {
  const { brand, topic, platform, toneOverride } = opts;
  const system = buildSystemPrompt(brand.name, brand.voice, platform);

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
  if (toneOverride) parts.push(`Tone adjustment: ${toneOverride}`);
  const userPrompt = parts.join("\n\n");

  const message = await anthropic().messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system,
    messages: [{ role: "user", content: userPrompt }],
  });

  // With adaptive thinking, content[0] may be a thinking block.
  const block = message.content.find((b) => b.type === "text");
  return parseReply(block && block.type === "text" ? block.text : "", brand.voice);
}
