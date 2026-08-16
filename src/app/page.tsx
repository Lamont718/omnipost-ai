import Link from "next/link";
import { activeBrands } from "@/lib/brands";

// The brands actually on the calendar — read from lib/brands.ts so this list
// can never drift from what the app really posts for.
const ORGS = activeBrands();

/**
 * The platforms the live schedules actually use, derived rather than listed.
 *
 * The hardcoded version said "Instagram, Facebook, LinkedIn, and X" and was
 * wrong twice over: no brand has ever scheduled LinkedIn, and every Facebook
 * slot was removed in August once it was clear there are no Pages to post to.
 * Same failure as the brand list that advertised three dead brands — so this
 * one computes itself.
 */
const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  x: "X",
};
const LIVE_PLATFORMS = Array.from(
  new Set(ORGS.flatMap((b) => b.schedule.map((s) => s.platform))),
).map((p) => PLATFORM_LABELS[p] ?? p);

function listPhrase(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

const FEATURES = [
  {
    title: "AI Brand Voice Engine",
    desc: "Each organization gets a deep voice profile — tone, audience, cultural context, banned words. Every post sounds like it was written by someone who lives the work.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
  {
    // Was "Approval Queue", describing a Supabase-backed review flow that has
    // not existed since the July rebuild. The posting sheet is what actually
    // stands between a written post and a posted one.
    title: "The posting sheet",
    desc: "One column in send order: the caption with a Copy button, the picture with a Save button, and a tick when it's done. The day's list also arrives by email at 8am so you don't have to remember to look.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: "Content Calendar",
    desc: "See your entire content pipeline across all organizations in one monthly view. Color-coded by org so nothing gets lost.",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
  },
  {
    title: "Written for the platform",
    desc: `Every post is shaped for where it's going — currently ${listPhrase(
      LIVE_PLATFORMS,
    )}. X posts are held under 280 characters at the point they're written, not flagged afterwards.`,
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">
            OmniPost <span className="text-brand-500">AI</span>
          </h1>
          {/*
            Said "Sign In" and went to the calendar. There is no sign-in — the
            Supabase auth this promised died in July, and the calendar
            deliberately has no AuthGuard. A button that names something the app
            can't do is how a page stops being believed.
          */}
          <Link
            href="/sheet"
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
          >
            Today&apos;s posts
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand-600 text-xs font-medium px-3 py-1.5 rounded-full mb-6">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Powered by Claude AI
        </div>

        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight leading-tight max-w-4xl mx-auto">
          One platform.{" "}
          <span className="text-brand-500">
            {ORGS.length} organization{ORGS.length === 1 ? "" : "s"}.
          </span>{" "}
          Authentic content at scale.
        </h2>

        <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
          OmniPost AI generates social media content that sounds like it was written by someone
          who lives the work — because the AI knows your brand voice, your audience, and your culture.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/calendar"
            className="bg-brand-500 hover:bg-brand-600 text-white font-medium px-8 py-3 rounded-lg text-sm transition"
          >
            Get Started
          </Link>
          <Link
            href="/sheet"
            className="border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium px-8 py-3 rounded-lg text-sm transition"
          >
            Open the posting sheet
          </Link>
          <Link
            href="/designs"
            className="border border-gray-200 text-gray-700 hover:bg-gray-50 font-medium px-8 py-3 rounded-lg text-sm transition"
          >
            See what the posts look like
          </Link>
        </div>
      </section>

      {/* Org Badges */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <p className="text-center text-xs font-medium text-gray-400 uppercase tracking-widest mb-6">
          Built for these organizations
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {ORGS.map((org) => (
            <div
              key={org.slug}
              className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-full px-4 py-2.5"
            >
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: org.colorHex }}
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{org.name}</p>
                <p className="text-[11px] text-gray-400">{org.tagline}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-gray-50 py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-900">
              Not another generic social tool
            </h3>
            <p className="mt-3 text-gray-500 max-w-xl mx-auto">
              Every feature is built around brand authenticity — because your community
              can tell when content is fake.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="bg-white rounded-xl border border-gray-100 p-8"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-500 flex items-center justify-center mb-4">
                  {feature.icon}
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {feature.title}
                </h4>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-gray-900">How it works</h3>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              // Rewritten to describe what the app does now. The old three
              // steps — pick an org, type a topic, approve it in a queue —
              // described the flow that died with Supabase in July, and the
              // middle one was never true again: topics come from each brand's
              // own sitemap, so a topic is never typed.
              {
                step: "01",
                title: "It picks the topics",
                desc: "Every week it reads each brand's own sitemap and chooses what to write about — a real card, a real lesson, a real page. You never type a topic.",
              },
              {
                step: "02",
                title: "It writes and illustrates",
                desc: "A caption in that brand's voice, grounded in what the page actually says, with the right picture attached. Months ahead of when it's needed.",
              },
              {
                step: "03",
                title: "You post it",
                desc: "Copy the words, save the picture, tick it off. Marking a post good teaches the next one; the tick follows you between your phone and your laptop.",
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-brand-500 text-white font-bold text-sm flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">
                  {item.title}
                </h4>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-500 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-3xl font-bold text-white">
            Ready to post with purpose?
          </h3>
          <p className="mt-3 text-brand-200 max-w-lg mx-auto">
            Stop spending hours writing social content. Let AI handle the drafts
            while you keep the final say.
          </p>
          <Link
            href="/calendar"
            className="mt-8 inline-block bg-white text-brand-600 font-medium px-8 py-3 rounded-lg text-sm hover:bg-brand-50 transition"
          >
            Open the Calendar
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-gray-400">
            OmniPost AI — Built for organizations that do real work.
          </p>
        </div>
      </footer>
    </div>
  );
}
