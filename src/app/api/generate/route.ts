import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase";
import { GenerateRequest, VoiceProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

function buildSystemPrompt(orgName: string, voice: VoiceProfile, platform: string): string {
  return `You are the social media voice for ${orgName}. You write authentic, purpose-driven social media content.

BRAND VOICE:
- Tone: ${voice.tone}
- Target Audience: ${voice.audience}
- Cultural Context: ${voice.cultural_context}
- Emoji Style: ${voice.emoji_style === "none" ? "Do NOT use any emojis." : voice.emoji_style === "minimal" ? "Use emojis sparingly — only when they add warmth or clarity, never decorative. Maximum 2 per post." : "Use emojis for emphasis and humor, but never more than 2 per post and never randomly."}

BANNED WORDS (never use these): ${voice.banned_words.join(", ")}

PREFERRED HASHTAGS: ${voice.hashtags.join(" ")}

${voice.keywords?.length ? `KEY TOPICS: ${voice.keywords.join(", ")}` : ""}

PLATFORM: ${platform}
${platform === "linkedin" ? "Write 2-3 short paragraphs. Professional tone. No emojis. End with a professional close." : ""}
${platform === "x" ? "Keep it under 280 characters. Punchy and shareable." : ""}
${platform === "instagram" ? "Visual storytelling tone. Caption should complement an image." : ""}
${platform === "facebook" ? "Conversational and community-oriented. Can be slightly longer." : ""}

CONTENT RULES (non-negotiable):
1. Never use generic motivational filler like "Every day is a chance to..." or "In a world where..."
2. Never stack more than 2 emojis in a single post
3. Write from authentic community knowledge — you LIVE this work
4. Captions must feel like they were written by a real person, not a marketing bot
5. Keep captions under 150 words unless the context demands more
6. Every post must have a clear purpose: inform, celebrate, recruit, or inspire action
7. NEVER put hashtags mid-sentence — always place them at the end
8. Write in a way that is specific, not generic. Reference real details when possible.

Respond with ONLY a JSON object in this exact format:
{
  "caption": "the full post caption with hashtags at the end",
  "suggested_hashtags": ["#tag1", "#tag2"],
  "recommended_post_time": "a suggested time like '10:00 AM EST' based on platform best practices",
  "platform_notes": "one sentence about why this caption works for this platform"
}`;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const { org_id, topic, platform, tone_override } = body;

    if (!org_id || !topic || !platform) {
      return NextResponse.json(
        { error: "Missing required fields: org_id, topic, platform" },
        { status: 400 }
      );
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    const supabase = createServerClient();

    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", org_id)
      .single();

    if (orgError || !orgData) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const voice = orgData.voice_profile as VoiceProfile;
    const systemPrompt = buildSystemPrompt(orgData.name, voice, platform);

    const userPrompt = tone_override
      ? `Write a ${platform} post about: ${topic}\n\nTone adjustment: ${tone_override}`
      : `Write a ${platform} post about: ${topic}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    let parsed;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch {
      parsed = {
        caption: responseText,
        suggested_hashtags: voice.hashtags,
        recommended_post_time: "10:00 AM EST",
        platform_notes: "AI-generated content",
      };
    }

    // Save as pending_approval post
    const { error: insertError } = await supabase.from("posts").insert({
      org_id,
      caption: parsed.caption,
      platform,
      status: "pending_approval",
      ai_generated: true,
      image_url: null,
      scheduled_at: null,
      published_at: null,
    });

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to save post: " + insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500 }
    );
  }
}
