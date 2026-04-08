import Link from "next/link";

const ORGS = [
  { name: "WWSH", desc: "Youth development nonprofit", color: "bg-purple-500" },
  { name: "BeyondChess", desc: "Chess-based education", color: "bg-teal-500" },
  { name: "Our Rose LLC", desc: "Government contracting", color: "bg-amber-500" },
  { name: "Adaptive Basketball", desc: "Inclusive youth sports", color: "bg-orange-500" },
  { name: "MostHatedNBA", desc: "NBA culture & commentary", color: "bg-red-500" },
];

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
    title: "Approval Queue",
    desc: "Every AI-generated post goes through review before publishing. Approve, reject, or edit inline. Bulk approve when you're confident.",
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
    title: "Multi-Platform Ready",
    desc: "Generate content optimized for Instagram, Facebook, LinkedIn, and X. Each platform gets tailored formatting and tone.",
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
          <Link
            href="/login"
            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition"
          >
            Sign In
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
          <span className="text-brand-500">Five organizations.</span>{" "}
          Authentic content at scale.
        </h2>

        <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
          OmniPost AI generates social media content that sounds like it was written by someone
          who lives the work — because the AI knows your brand voice, your audience, and your culture.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="bg-brand-500 hover:bg-brand-600 text-white font-medium px-8 py-3 rounded-lg text-sm transition"
          >
            Get Started
          </Link>
          <a
            href="#features"
            className="text-gray-600 hover:text-gray-900 font-medium px-8 py-3 rounded-lg text-sm transition"
          >
            See Features
          </a>
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
              key={org.name}
              className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-full px-4 py-2.5"
            >
              <div className={`w-2.5 h-2.5 rounded-full ${org.color}`} />
              <div>
                <p className="text-sm font-medium text-gray-900">{org.name}</p>
                <p className="text-[11px] text-gray-400">{org.desc}</p>
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
              {
                step: "01",
                title: "Select your organization",
                desc: "Choose which brand you're creating for. The AI loads that org's complete voice profile.",
              },
              {
                step: "02",
                title: "Enter a topic",
                desc: "Tell the AI what the post should be about. It handles tone, hashtags, and platform formatting.",
              },
              {
                step: "03",
                title: "Review and approve",
                desc: "Every post goes through your approval queue. Edit, approve, or reject before anything goes live.",
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
            href="/login"
            className="mt-8 inline-block bg-white text-brand-600 font-medium px-8 py-3 rounded-lg text-sm hover:bg-brand-50 transition"
          >
            Sign In to Your Dashboard
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
