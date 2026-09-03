import { Platform, PostSlot, VoiceProfile } from "./types";
import type { VideoClipMeta } from "./video-library";

/**
 * Every brand OmniPost writes for, and how each one sounds.
 *
 * These used to live in Supabase. They live here now: there is exactly one
 * owner, the set changes a few times a year, and keeping them in code means the
 * weekly digest runs with no database at all. Edit this file, push, done.
 *
 * To stop a brand appearing in the Monday digest, set `active: false` — don't
 * delete it, or you lose the voice profile you tuned.
 */

/** Where a brand's post topics come from. */
export interface TopicSource {
  /** Absolute URL of a sitemap.xml. */
  sitemap: string;
  /** If set, only paths matching one of these are eligible. */
  include?: RegExp[];
  /** Paths matching any of these are skipped, even if `include` matched. */
  exclude?: RegExp[];
  /**
   * Names this source's pool. A slot with a matching `topics` tag draws only
   * from here; every untagged slot draws only from the untagged sources. Leave
   * unset for a brand's ordinary source — one brand, one pool, as before.
   */
  tag?: string;
  /**
   * The page's own image IS the subject of these posts, so it beats both of the
   * things that normally outrank it: no video clip is chosen for them, and the
   * brand's own picture library does not override them.
   *
   * Set for the books. A clip normally wins because a moving Emeka beats a
   * static card, and the library normally wins because artwork Lamont chose
   * beats anything derived — both are right for a lesson and both are wrong
   * here. "Pre-order My Crown" as a Reel of Emeka blowing bubbles shows the
   * buyer everything except the thing being sold.
   */
  pageImageWins?: boolean;
}

/**
 * An evergreen angle to post about when a brand has no site (or the site gave
 * us nothing this week). Either a bare string, or a `{ title, facts }` pair
 * where `facts` is verified canon the model is then allowed to quote — real
 * book refrains, real premises. Without `facts` the grounding rule bars all
 * specifics, which is correct for a vague prompt but wrong for a book whose
 * lines are real. See the grounding rule in lib/compose.ts.
 */
export type EvergreenTopic = string | { title: string; facts: string };

/**
 * Where a post sends the reader, and what they get when they arrive.
 *
 * Every caption this app had written before 3 September 2026 ended without one.
 * Measured across the whole live calendar: 3 of 153 captions named a website at
 * all, and not one of them told anybody where to buy the game. The writer was
 * never asked for a destination, so it never wrote one — the posts were good
 * and they went nowhere.
 *
 * `url` is the bare domain because that is the form a person can read out and
 * type; the clickable `https://` version is derived where a link actually works
 * (see `destinationLine` in lib/compose.ts). `action` is what the reader is
 * being sent to DO, in the brand's own words — "buy the game", not "learn more",
 * which is the phrase that makes a call to action sound like an advert.
 */
export interface Destination {
  /**
   * Tested against the topic's own URL. First match wins; an entry with no
   * `match` is the brand's fallback and must come last.
   *
   * Emeka Explores is why this is a list rather than one field: a lesson post
   * belongs on emekaexplores.com and a book post belongs on emekabooks.com,
   * and sending a reader who wants the book to the lessons site is the same
   * class of mistake as putting the Instagram handle on a TikTok post.
   */
  match?: RegExp;
  /** Bare domain, no scheme — "yodm.com". */
  url: string;
  /** What they came to do: "buy the game", "read the lessons". */
  action: string;
}

export interface Brand {
  slug: string;
  name: string;
  colorHex: string;
  /**
   * One line, shown on the landing page. Required so a brand can't be added
   * here and then quietly go missing from the public list.
   */
  tagline: string;
  /** Included in the calendar. */
  active: boolean;
  /**
   * The real @handle, for the platform mock-ups.
   *
   * Without it the previews fall back to the slug, and that fallback is worse
   * than nothing: every one of them is a real Instagram account belonging to
   * somebody else. @emekaexplores has 506 followers and 588 posts and is not
   * his; his is @emeka_explores. @wwsh, @yodm, @mosthated, @theconductor and
   * @heartoftheblock all exist too. So the calendar was quietly showing him
   * other people's handles on his own posts.
   *
   * Only fill this in from a handle he has actually given, checked against the
   * live profile. A guessed handle here is the same bug with more confidence.
   *
   * This is the brand-wide default. Where a network differs, `handles` below
   * wins — resolution happens in schedule.ts, against the slot's own platform.
   */
  handle?: string;
  /**
   * Per-platform overrides, for brands whose handle is not the same everywhere.
   *
   * YODM is @yodm_debate on Instagram and X but @y_o_d_m on TikTok. One
   * brand-wide name cannot be true for both, and the mock-up would have put
   * the Instagram handle on a TikTok post — the same class of bug as the slug
   * fallback described above, just harder to spot because the handle is real.
   *
   * Only name the platforms that actually differ; everything else falls back
   * to `handle`. Same rule as `handle`: only from a handle he has given,
   * checked against the live profile.
   */
  handles?: Partial<Record<Platform, string>>;
  /**
   * Artwork this brand already publishes, as absolute URLs. Used ahead of the
   * page's share image, same as a Blob library — for a site that hosts good
   * pictures but doesn't set og:image on the pages that use them.
   */
  imageLibrary?: string[];
  /**
   * Extra hostnames this brand's artwork is served from, beyond its sitemap's.
   *
   * "Save image" proxies through /api/download, which checks the URL against
   * an allowlist built from each brand's sitemap host. That holds only while a
   * site serves its pictures from the domain its sitemap is on — and
   * emeka-books.com does not: its sitemap is hyphenated, its og:image points at
   * emekabooks.com, and all ten book covers 403'd on the button while looking
   * perfectly fine on screen. The same failure as the library brands before
   * isAllowedImageHost existed, arriving through a different door.
   *
   * Name only hosts you have checked actually belong to the brand. This widens
   * what the server will fetch on a caller's behalf, which is the one thing the
   * allowlist is there to keep narrow.
   */
  artworkHosts?: string[];
  /**
   * What each of this brand's video clips shows, keyed by the filename it was
   * uploaded under in Blob (`library/<slug>/video/<name>.mp4`).
   *
   * The clips themselves are discovered from Blob, so dropping another one in
   * is enough to put it in the rotation. This is the part a listing cannot
   * tell us: what is on screen, and which topics it suits. Both matter — the
   * caption writer is given the description so it never writes as though the
   * video shows the subject of the post, and the tags are what put a spacecraft
   * window on an astronaut's post instead of whatever came next in the cycle.
   *
   * A clip with no entry here still posts. It simply carries no tags, and the
   * writer is told nothing about it rather than something invented.
   */
  videoClips?: VideoClipMeta[];
  /**
   * True when the site publishes ONE og:image for every page, so it says
   * nothing about the topic and must never be attached to a post.
   *
   * This is not a theoretical worry. communitynyc.org is a GoDaddy site with a
   * single site-wide share image — a photo of kids at the chess programme — and
   * it is served on /basketball, /about-us and the homepage alike. So every
   * WWSH basketball post came out illustrated with chess. theconductor.net does
   * the same thing: /bus/B31 and /bus/B41 both return /opengraph-image.
   *
   * A brand marked this way falls through to its library, then to a generated
   * branded card. A card that says nothing is better than a picture that says
   * something untrue.
   *
   * Only set it after checking two different pages actually return the same
   * URL. yodm.com and mosthatednba.com both vary theirs per page and must not
   * be flagged — that per-page picture is the entire reason their sources were
   * narrowed to /card/ and /hall-of-villains/.
   */
  sitewideShareImage?: boolean;
  /**
   * Copy that appears word for word in EVERY page description on this brand's
   * site, stripped out before the description is handed over as a topic's
   * verified facts.
   *
   * It is furniture, not a fact about the topic — but the grounding rule in
   * lib/compose.ts says the facts block is the only place specifics may come
   * from, so whatever is in it is what the caption gets written out of. yodm.com
   * gives all 92 cards the same description: "<Category> · Pick a side and make
   * your case in 30 seconds. One of 92 cards from YODM, the ultimate debating
   * game." The only per-card word in it is the category. The writer was
   * therefore handed the same three specifics 39 times and used all three every
   * time, which is precisely what a recital looks like.
   *
   * Strip the shared sentence and the category survives, which is the part the
   * topic constraints match on. What is left is thin — correctly so. A thin
   * facts block makes the caption go and find an angle; a boilerplate one lets
   * it fill the space without one.
   */
  /**
   * A better picture than the page's share image, built from the topic's own
   * URL.
   *
   * A share image is sized for a link preview: 1200x630. Posted to an Instagram
   * feed that is a thin letterboxed strip with most of the screen empty above
   * and below it — on the one format where the picture IS the post. yodm.com
   * now renders the same card at 1080x1350 with a photograph of the actual game
   * in it, so this points at that instead.
   *
   * `match` runs against the topic URL and `template` may reference its capture
   * groups as $1, $2. Data rather than a function so the whole brand table stays
   * readable and nothing here can do anything but build a string.
   */
  postImage?: {
    match: RegExp;
    /** Instagram and Facebook, which show a tall picture whole. */
    template: string;
    /**
     * X, which crops a tall picture to roughly 16:9 in the timeline — so a
     * portrait post arrives there with its question cut off, the opposite of
     * the problem the post size was added to fix. Falls back to `template`.
     */
    wideTemplate?: string;
  };
  sitewidePageCopy?: RegExp;
  /**
   * What this brand's artwork already says IN WORDS, when the picture carries
   * legible copy of its own.
   *
   * Given to the writer as a prohibition, never as material. A YODM post is a
   * rendered card with the question printed across it in large type, and 26 of
   * the first 39 captions opened by typing that same question out again — so
   * the reader met the sentence twice and the post said one thing.
   *
   * Leave unset for a photograph. This is only for artwork whose words a reader
   * can read.
   */
  artworkSays?: string;
  /**
   * The posting schedule: one entry per weekly post — weekday, time, platform.
   * This is the whole "when do I post" model. The number of entries is how many
   * posts a week; edit these to change your cadence.
   */
  /**
   * Where this brand's posts send people. Unset means the caption ends without
   * a destination, which is what every brand did until 3 September 2026.
   */
  destinations?: Destination[];
  schedule: PostSlot[];
  voice: VoiceProfile;
  /**
   * Topic sources. A brand with none still works — it just falls back to
   * `evergreenTopics`, which is the right setup for anything without a site
   * (books, print runs).
   */
  sources: TopicSource[];
  /** Used when no source yields a fresh topic. Rotates week to week. */
  evergreenTopics: EvergreenTopic[];
}

/** Paths that are never worth a social post, on any site. */
const BOILERPLATE = [
  /\/(privacy|terms|refunds?|shipping|contact|login|signup|account|cart|checkout|faq)\b/i,
];

export const BRANDS: Brand[] = [
  // ---------------------------------------------------------------- revenue
  {
    slug: "yodm",
    name: "YODM",
    colorHex: "#7C3AED",
    tagline: "Party debate card game",
    // Given 2026-08-24 and checked: "Your Opinion Doesn't Matter
    // (@yodm_debate)", 162 followers, 135 posts. The slug fallback said @yodm,
    // which is somebody else.
    handle: "@yodm_debate",
    // Given by Lamont 2026-09-01 and checked against the live profile: TikTok
    // "Your Opinion Doesn't Matter (y_o_d_m)", 155 followers, 1,757 likes, bio
    // linking yodmpodcast.com and yodm.com. Deliberately different from the
    // Instagram and X handle above — this brand is the reason `handles` exists.
    handles: { tiktok: "@y_o_d_m" },
    // Was stood down on 2026-08-09 in favour of The Shop (repos/the-shop),
    // which writes YODM from the 92-card deck with its own rendered images and
    // a Critic agent. Turned back on the same day at Lamont's request.
    //
    // ⚠️ Both systems now caption YODM. That means duplicate Anthropic spend and
    // two independent queues that can schedule competing posts to the same
    // account on the same day — check one against the other before posting, or
    // stand one of them down again.
    active: true,
    // Thursday was Facebook until 14 Aug 2026. There is no YODM Facebook Page
    // and there isn't going to be one — Lamont's Facebook is personal. The slot
    // moved to Instagram rather than being deleted because the card graphic is
    // the strongest thing this brand has and Instagram is where it lands.
    // The one sentence every card page shares. See `sitewidePageCopy` above:
    // leaving it in the facts block is what made 39 captions out of 39 recite
    // the rules of the game instead of arguing the question on the card.
    // The portrait card with a real photograph of the game in it, rather than
    // the 1200x630 link-preview card. Both come off the same deck and the same
    // design in the YODM repo; only the shape and the picture differ.
    postImage: {
      match: /\/card\/(\d+)$/,
      template: "https://yodm.com/api/card-image?id=$1&format=post",
      wideTemplate: "https://yodm.com/api/card-image?id=$1&format=post-wide",
    },
    sitewidePageCopy:
      /\s*Pick a side and make your case in 30 seconds\.\s*One of 92 cards from YODM,? the ultimate debating game\.?/i,
    // The post IS the card: yodm.com renders the question across a 1200x630
    // graphic with the category strip and the logo on it.
    artworkSays:
      "the card's question in large type, its category, and the YODM logo — a reader " +
      "has already read the question before reaching the first word of the caption",
    /*
     * The game-night clips, uploaded 2026-09-03. Real footage from a table
     * playing YODM, each one opening on the card being argued — cut by
     * yodm-podcast-kit/make-gamenight-clip.py, 1080x1920, 31s / 63s / 68s.
     *
     * The fourteen podcast clips are still in the same folder and still in the
     * rotation for the untagged slots. They are not declared here, so they
     * carry no description and no tags, which is the honest state: nobody has
     * written down what is on them and they are not the game.
     *
     * `tags` are the card number, because that is the only word in a YODM topic
     * URL — yodm.com/card/47 flattens to "...card47", so the tag "card/47" is
     * the one thing that can match. It is what pairs the clip to the question
     * it actually contains, on every slot, not just the TikTok one.
     */
    videoClips: [
      {
        name: "next-iconic-athlete",
        describes:
          "A game night: the SPORTS card 'Who's the next iconic athlete?' fills the screen, then a player at the table makes his case for a college kid nobody has seen yet",
        tags: ["card/47"],
      },
      {
        name: "one-night-stands",
        describes:
          "A game night: the FOR IT OR AGAINST IT card 'One Night Stands' fills the screen, then two players take opposite sides — one argues no strings, the other answers that you leave a piece of yourself behind",
        tags: ["card/81"],
      },
      {
        name: "oral-sex-relationship",
        describes:
          "A game night: the SEX & LIES card 'Is oral sex important in a relationship?' fills the screen, then the host takes it to a group at the table and they answer him together",
        tags: ["card/23"],
      },
    ],
    schedule: [
      /*
       * TikTok Tuesday 17:00: added 2026-09-01, removed 2026-09-02, back on
       * 2026-09-03. Worth the whole story, because it is a slot that looked
       * fine and was not.
       *
       * The slot was never the problem. The library behind it was: fourteen
       * clips cut from the PODCAST and from an ad, each carrying burned-in
       * captions about its own subject. Paired with a debate card by rotation,
       * a viewer read "Stop Being a Bum Dad" on screen while the caption asked
       * about television, and one post put "Is torture justified for national
       * security?" over two men joking about drinking. His words: "we have to
       * come very close to the actual game".
       *
       * What brings it back is not a better pairing rule. It is three clips of
       * the actual game, uploaded to library/yodm/video/ on 2026-09-03, each
       * opening on the card being argued — and a topic pool of exactly the
       * three cards they argue, so the footage picks the subject instead of
       * being stapled to whatever the rotation reached. See `videoClips` and
       * the `gamenight` source below.
       *
       * Three clips, one slot a week: the same card comes round every third
       * week. That is the cost of a small library, and it is visible rather
       * than hidden — the fix is more footage, not a longer rotation.
       *
       * The thirteen captions written against the old library are orphaned, not
       * deleted, backed up in yodm-tiktok-captions-BACKUP.json.
       */
      { day: 2, time: "17:00", platform: "tiktok", topics: "gamenight" },
      { day: 2, time: "18:00", platform: "instagram" },
      { day: 4, time: "19:00", platform: "instagram" },
      { day: 6, time: "11:00", platform: "x" },
    ],
    voice: {
      tone: "Bold, funny, a little confrontational — game-night energy, never corporate",
      audience:
        "Adults 21+ who host game nights, buy party games as gifts, and like to argue for sport",
      cultural_context:
        "YODM = 'Your Opinion Doesn't Matter'. A debating card game: 92 cards, 7 categories, a 30-second timer, and a die. " +
        "⚠️ The die is ONLY used on cards in the 'For It or Against It' category — those carry a topic, you roll, and you argue whichever side it lands on. " +
        "Every other category (Social Matters, Sex & Lies, Politics, Sports, Entertainment, The Ism's) is a straight debate question: you pick a side and make your case, no roll. " +
        "The card's own category is given in the topic context — never mention the die, rolling, or 'you don't get to pick your side' unless that category is literally 'For It or Against It'. " +
        "The name is about the arguing, not about the die.",
      emoji_style: "moderate",
      // The category is printed in every card page's description, so whether the
      // die applies is knowable per topic rather than something to reason about.
      // Saying it in cultural_context was not enough: card 7, Social Matters,
      // still went out telling people to roll for their side.
      topic_constraints: [
        {
          unless: /For It or Against It/i,
          rule:
            "This card is NOT in the 'For It or Against It' category, so the die is not used on it. " +
            "Do not mention a die, rolling, chance, or being assigned or given a side. " +
            "On this card the player picks their own side and argues it.",
        },
      ],
      // Every one of these is either printed on the card in the picture or true
      // of all 92 of them, so none of it is news to anyone reading the post. The
      // first 39 captions were built almost entirely out of this list — 39/39
      // "30 seconds", 36/39 "92 cards", 33/39 "pick a side" — because the card
      // page's description is the only thing the grounding rule let them use.
      // Checked after writing, not just asked for; see composePost.
      banned_phrases: [
        "30 seconds",
        "thirty seconds",
        "30-second",
        "92 cards",
        "one of 92",
        "pick a side",
        "pick your side",
        "make your case",
        "the ultimate debating game",
        "ends friendships",
        "end a friendship",
        "ending friendships",
      ],
      house_rules: [
        "The card graphic carries the question. Do NOT open by quoting or " +
          "rephrasing it — the reader has already read it. Start where the card " +
          "stops.",
        "The caption's job is to be the FIRST ARGUMENT, not the instructions. " +
          "Take a side and defend it in a line or two, or name the exact opinion " +
          "someone is about to have about this card. Something a person could " +
          "disagree with.",
        "Argue it with reasoning, NOT with evidence. A debate card is an opinion " +
          "question, and you have not been given any research on it — so no " +
          "figures, no statistics, no salaries, no percentages, no dates, no studies, " +
          "no named people, companies, teams or cases, and no \"most people\" claims. " +
          "If the argument needs a number to work, it is the wrong argument for this " +
          "card. An honest opinion stated plainly beats a confident invented fact, " +
          "and this brand argues for sport, not for citation.",
        "Do not explain how the game works. Everyone scrolling past a debate card " +
          "can see it is a debate card, and the rules are on it.",
        "End by asking for their side, not by telling them to play. One question, " +
          "answerable in a comment, about the card — never \"tag a friend\" or " +
          "\"bring it to game night\".",
        "Never claim a post will end friendships, ruin a night, or clear a room. " +
          "That line has been used more than any other and it is a claim about the " +
          "reader's friends that the card cannot make.",
      ],
      banned_words: [
        "elevate",
        "unleash",
        "game-changer",
        "revolutionary",
        "must-have",
        "perfect for anyone",
      ],
      hashtags: ["#YODM", "#GameNight", "#PartyGames", "#DebateMe"],
      keywords: [
        "card game",
        "party game",
        "debate",
        "game night",
        "adults",
        "argument",
      ],
      example_posts: [],
    },
    // Post the actual cards, not the marketing pages.
    //
    // yodm.com publishes all 92 cards at /card/<n>, and each one already gives
    // us everything a post needs: the page <title> IS the real question, the
    // description carries the category, and the share image is the finished
    // card graphic the site renders — red border, category strip, YODM.COM
    // footer. So a YODM post ends up being a real card, with the real card
    // image, and no part of it is invented. That matters more here than
    // anywhere else: an earlier version of this app made up the seven category
    // names because it was writing from a marketing page with nothing concrete
    // on it.
    //
    // 92 cards also means a topic never repeats within a month.
    // yodm.com is the shop as well as the cards, so one destination covers
    // both the card a post is about and the game it is selling.
    destinations: [{ url: "yodm.com", action: "buy the game" }],
    sources: [
      {
        sitemap: "https://yodm.com/sitemap.xml",
        include: [/\/card\/\d+$/i],
        exclude: BOILERPLATE,
      },
      {
        /*
         * The three cards there is game-night footage of, and nothing else.
         *
         * TikTok is video-only, and on a platform where the clip IS the post
         * the clip has to choose the subject rather than the other way round.
         * Left to the ordinary pool, the Tuesday slot would land on any of 92
         * cards and the rotation would staple whichever clip came next to it —
         * which is precisely the pairing that took this slot off the calendar
         * on 2 September.
         *
         * So the pool is the footage. Add a clip, add its card here, and the
         * slot has another week in it; until then it cycles these three.
         */
        sitemap: "https://yodm.com/sitemap.xml",
        include: [/\/card\/(23|47|81)$/i],
        tag: "gamenight",
      },
    ],
    evergreenTopics: [
      "On a 'For It or Against It' card the die picks your side, not you — the one rule that changes the whole night",
      "What happens when someone has to argue against something they actually believe",
      "Why 30 seconds is exactly the right amount of time to make a bad argument",
      // Don't write evergreens that invite the model to enumerate something the
      // site never lists — an earlier version of this line asked it to name the
      // seven categories and it happily made all seven up.
      "The moment someone realises they have to argue the side they disagree with",
    ],
  },
  {
    slug: "emeka-explores",
    name: "Emeka Explores",
    colorHex: "#7C3AED",
    tagline: "Kids' learning site — 130+ lessons",
    active: true,
    // Created 2026-08-22. Note the underscore: @emekaexplores without it is a
    // different account with 506 followers and 588 posts.
    handle: "@emeka_explores",
    // Given by Lamont 2026-09-01 and checked against the live profile: TikTok
    // "Emeka_Explores (emeka_explores)", 0 following, 0 followers, no bio yet.
    // New and empty, but real. It matches the Instagram handle today; recorded
    // explicitly so the Tuesday TikTok slot never depends on the two staying
    // the same if either is ever renamed.
    handles: { tiktok: "@emeka_explores" },
    // The book covers are served from emekabooks.com, which is now also the
    // host this brand's sitemap is read from. Verified 2026-08-24: both hosts
    // return the identical 134,012-byte cover.jpg, and only the hyphenated one
    // was on the allowlist.
    artworkHosts: ["emekabooks.com", "www.emekabooks.com"],
    // Wednesday was Facebook until 14 Aug 2026 — see the note on YODM. Kept at
    // three posts a week, all Instagram, because that is the only platform this
    // brand actually has an audience on.
    // Friday is the books slot — one post a week out of the three, so the shop
    // shows up without the feed turning into a shop. Lamont posts every one of
    // these by hand, so buying the books their own slots would have meant
    // asking him to post more, not asking the feed to work harder.
    schedule: [
      { day: 1, time: "09:00", platform: "instagram" },
      { day: 3, time: "19:00", platform: "instagram" },
      { day: 5, time: "09:00", platform: "instagram", topics: "books" },
      // TikTok, added 30 Aug 2026. One a week, not three: TikTok rewards
      // frequency more than anything else here, but every post on this
      // calendar is one Lamont pastes in by hand, and the tick rate says
      // the constraint is his thumb rather than the schedule. Raise it once
      // posts are actually going out.
      //
      // Video only, and enforced — see platformRequiresVideo. The thirty
      // clips under library/emeka-explores/video/ are what this draws from,
      // so this slot cannot be copied to a brand with no clips.
      { day: 2, time: "17:00", platform: "tiktok" },
    ],
    voice: {
      tone: "Warm, proud, parent-to-parent — encouraging without being saccharine",
      audience:
        "Black parents, teachers and homeschoolers of kids roughly 4–9 looking for learning that reflects their children",
      cultural_context:
        "Emeka Explores teaches Black history, science, culture and the alphabet to young kids — 130+ illustrated lessons, interactive stories, games and badges, plus free parent guides. Made by a Brooklyn dad for his own kids first. EMEKA IS A GIRL — a seven-year-old girl from Brooklyn with a yellow star on her shirt, she/her every time. Never write 'he', 'his' or 'him' about Emeka. A book blurb that reads 'Emeka, Dad, and Coco' means HER dad, and Coco is her puppy.",
      emoji_style: "minimal",
      banned_words: [
        "empower",
        "engaging content",
        "learning journey",
        "unlock their potential",
        "screen time solution",
      ],
      // Ordered brand → what it is → who it is for. The previous set was four
      // tags of which two led with race, so every post announced its audience
      // twice before it said what the book was. #BlackKidsRead stays last and
      // stays deliberately: a parent searching it wants exactly this, and that
      // is a warmer lead than the ocean of #picturebooks. Rebalanced, not erased.
      hashtags: [
        "#EmekaExplores",
        "#PictureBooks",
        "#ReadAloud",
        "#KidLit",
        "#RaisingReaders",
        "#BlackKidsRead",
      ],
      // ⚠️ The commerce facts below were re-read off the LIVE pages on
      // emekabooks.com on 2026-08-30, not carried forward. Two things had
      // changed since 2026-08-22 and both were still being written into
      // captions:
      //
      //   1. The signed-and-personalised promise was killed on 2026-08-28. It
      //      is nowhere on the live buy box any more, but it was still the
      //      "strongest thing here" in this file, so the writer kept selling
      //      it. Two drafts carried it. An offer that has been withdrawn from
      //      the site is still live anywhere it was copied to — this file,
      //      and Stripe's own confirmation message.
      //   2. The House That Smiled now has its own Stripe buy link at $40.
      //      It was still classed as not-for-sale here, so two future drafts
      //      sent people to an email box for a book they could have bought.
      //
      // Live on 2026-08-30, both buyable books: pre-order $40, hardcover,
      // 20 pages, 11 x 8.5 in, free US shipping, ships by September 24, full
      // refund if it slips, "not printed yet". The 25-copy first run is stated
      // on My Crown's offer block only, so it stays scoped to My Crown.
      // Re-check all of this when the run actually ships, or the September 24
      // date silently becomes a false promise in a live post.
      topic_constraints: [
        {
          when: /Emeka Books/,
          rule:
            "This topic is a BOOK, not a lesson on the website. It is a printed hardcover — " +
            "the book pages call it 'a 20-page hardcover' and show the opening five pages. " +
            "Write about the story: who is in it, what happens, why a child would want it read " +
            "to them. Name the book by its title. Never describe it as a lesson, a guide, an " +
            "activity or something to do online, and never say how many pages, how much it " +
            "costs or when it ships beyond what the verified facts above state.",
        },
        {
          when: /(My Crown|The House That Smiled).*Emeka Books/,
          rule:
            "This book CAN be ordered right now, so this post has a real ask. These facts are " +
            "read off its live page and you may state them: it is a PRE-ORDER at $40, " +
            "hardcover, 20 pages, 11 x 8.5 in; it ships by September 24 with free US shipping, " +
            "and there is a full refund if that date slips. It is not printed yet — say so " +
            "plainly rather than implying it is in stock. Ask once, at the end, and send them " +
            "to the link in the bio. " +
            "NEVER say the book is signed, autographed, personalised, or that a child's name " +
            "is printed in it. That offer was withdrawn on 28 August 2026 and promising it " +
            "again is a promise nobody can keep. Claim nothing beyond this list.",
        },
        {
          when: /My Crown.*Emeka Books/,
          rule:
            "My Crown only: its page also states a first print run of 25 copies, and that " +
            "pre-orders are what pay the printer — once 25 are spoken for the run goes in. " +
            "That scarcity is the strongest true thing here: prefer it to the price. Do not " +
            "attach a print-run number to any other book.",
        },
        {
          when: /Emeka Books/,
          unless: /(My Crown|The House That Smiled).*Emeka Books/,
          rule:
            "This book is NOT for sale yet — its page has no price and no cart, only a 'Tell me " +
            "when it prints' box that takes an email address. So the ask is exactly that: tell " +
            "them the book is coming and invite them to leave their email to hear when it " +
            "prints, via the link in the bio. NEVER write 'buy', 'order', 'shop', 'get your " +
            "copy', 'out now', 'available now', or any price — none of those are true of this " +
            "book, and a reader who taps expecting to buy finds an email box instead.",
        },
      ],
      keywords: [
        "Black history",
        "kids",
        "lessons",
        "parents",
        "homeschool",
        "representation",
      ],
      example_posts: [],
    },
    // Fifteen 1080x1920 clips, uploaded to Blob under
    // library/emeka-explores/video/. Six were already cut for social in July
    // and had never been posted; the other nine were reframed from the raw
    // generator output with the blurred-fill recipe (fills the frame rather
    // than cropping, so nobody's hair puffs get cut off the top).
    //
    // The descriptions are what is ACTUALLY on screen — three of these files
    // are named after the prompt that generated them rather than the footage
    // that came back, and the names lie: "bounces with joy" is a counting
    // scene, "proud smile" is a science flask, "gazes out the window" is a
    // spacecraft porthole. Every one was checked frame by frame before it was
    // written down here, because the caption writer is handed this text as
    // fact and a wrong description becomes a wrong sentence in a real post.
    //
    // Every clip is silent and about five seconds. He picks music in Instagram.
    videoClips: [
      {
        name: "01-emeka-hello-wave",
        describes: "Emeka waves at the camera and smiles, close up, plain warm background",
        tags: ["hello", "welcome", "school", "first", "meet"],
      },
      {
        name: "02-emeka-reading",
        describes:
          "Emeka sits cross-legged on a rug turning the page of a picture book, a bookshelf behind her",
        // Not "story": it is a substring of "history", so it quietly claimed
        // every Black-history topic on the site. Tags are matched against a
        // flattened URL, which has no word boundaries to lean on.
        tags: ["reading", "book", "books", "words", "sight", "literacy", "representation"],
      },
      {
        name: "03-emeka-science-bubbles",
        describes: "Emeka laughs as soap bubbles and coloured letter blocks float around her",
        tags: ["science", "bubbles", "curious", "discover", "experiment"],
      },
      {
        name: "04-emeka-celebrate",
        describes: "Emeka throws both arms up under falling confetti",
        tags: ["celebrate", "kwanzaa", "holiday", "month", "proud", "activities"],
      },
      {
        name: "05-emeka-friends-hug",
        describes: "Emeka, Heaven and Sandra hug each other in a park",
        tags: ["friends", "community", "together", "heritage", "kindness", "african"],
      },
      {
        name: "06-emeka-coco-hug",
        describes: "Emeka sits on the grass hugging Coco, her golden curly-haired dog",
        tags: ["coco", "comfort", "anxiety", "feelings"],
      },
      {
        name: "07-emeka-counting-numbers",
        describes: "Emeka holds up her fingers while brightly coloured numbers float around her",
        tags: ["counting", "numbers", "preschool", "math", "kindergarten"],
      },
      {
        name: "08-emeka-welcome-smile",
        describes: "Emeka gives a warm welcoming smile and tilts her head, close up",
        tags: ["welcome", "routine", "readiness", "school", "checklist"],
      },
      {
        name: "09-emeka-apple",
        describes: "Emeka holds up a big red apple at a classroom desk",
        tags: ["apple", "alphabet", "letters", "teacher", "classroom"],
      },
      {
        name: "10-emeka-science-flask",
        describes:
          "Emeka holds up a flask of blue liquid next to an open book in a classroom",
        tags: ["science", "inventors", "invention", "carver", "experiment"],
      },
      {
        name: "11-emeka-coco-hug-2",
        describes: "Emeka and Coco sit together in the grass among flowers",
        tags: ["coco", "comfort", "gentle"],
      },
      {
        name: "12-emeka-space-window",
        describes:
          "Emeka, seen from behind, looks out of a round spacecraft window at the Earth below",
        tags: ["space", "astronaut", "jemison", "johnson", "earth", "orbit"],
      },
      {
        name: "13-emeka-moon",
        describes: "Emeka holds a glowing crescent moon in both hands under a starry sky",
        tags: ["moon", "night", "stars", "dream", "wonder", "space"],
      },
      {
        name: "14-emeka-kite",
        describes: "Emeka runs through a field flying a rainbow kite",
        tags: ["kite", "flying", "flight", "aviation", "coleman", "outside"],
      },
      {
        name: "15-emeka-writing",
        describes: "Emeka writes with a pencil at a classroom desk, then looks up smiling",
        tags: ["writing", "practice", "homework", "school", "letters", "words"],
      },
    ],
    destinations: [
      // A book post sends people to the book site. Same rule as the handles:
      // the right domain for the wrong subject reads as correct and isn't.
      { match: /emekabooks\.com/i, url: "emekabooks.com", action: "get the book" },
      { url: "emekaexplores.com", action: "read the lessons" },
    ],
    sources: [
      {
        sitemap: "https://www.emekaexplores.com/sitemap.xml",
        // Only real lessons. Taking the whole sitemap meant the rotation kept
        // landing on pages that are not posts: /press produced a caption
        // addressed to "writers, reporters and bloggers", /schools/pilot is a
        // sales page, and /sample/math-island/1 gave the topic the title "1".
        // The bare /guides and /heroes hubs are excluded by the trailing slug —
        // a hub has nothing specific to say, which is the thin grounding that
        // has caused every fabrication in this app.
        include: [/\/(guides|heroes)\/[a-z0-9-]+$/i],
        exclude: BOILERPLATE,
      },
      {
        // The books. A separate site, so a separate source, and tagged so only
        // the Friday slot draws from it.
        //
        // Twelve pages, each with its own cover as og:image at
        // /pages/<slug>/cover.jpg and its real jacket copy as the meta
        // description — which is the whole reason these are worth posting: the
        // grounding is the publisher's own words, not a summary of a summary.
        // emekabooks.com, no hyphen. The hyphenated host is a legacy alias
        // that 308s here — verified 2026-08-27 — and every <loc> in this
        // sitemap already names the canonical one. Pointing at the redirect
        // cost a round trip and made the wrong domain look official.
        sitemap: "https://emekabooks.com/sitemap.xml",
        include: [/\/books\/[a-z0-9-]+$/i],
        exclude: BOILERPLATE,
        tag: "books",
        // The cover is the product — see the note in post-artwork.ts.
        pageImageWins: true,
      },
    ],
    evergreenTopics: [
      "Why every lesson starts with a kid who looks like the kid reading it",
      "The free parent guides, and how to use one on a weeknight",
      "Why kids retell the lessons where they see themselves",
    ],
  },
  {
    slug: "mosthated",
    name: "MostHatedNBA",
    colorHex: "#DC2626",
    tagline: "NBA culture & commentary",
    active: true,
    // Given by Lamont 2026-09-01 and checked against the live profile:
    // "MostHatedNBA (@NbaHated)", 30 posts, 0 following, 1 follower, joined
    // April 2026, dormant since 31 May. The banner carries mosthatednba.com.
    // The slug fallback would have said @mosthated, which is somebody else.
    //
    // X only. This brand has no Instagram account, and its Instagram slot came
    // off the schedule the same day, so this one brand-wide field can only ever
    // render on an X row. If an Instagram slot is ever added back, get the real
    // Instagram handle first — otherwise this claims @NbaHated on Instagram,
    // where it is not true, which is the bug the note on `handle` warns about.
    handle: "@NbaHated",
    schedule: [
      { day: 1, time: "20:00", platform: "x" },
      { day: 3, time: "20:00", platform: "x" },
      // Friday 12:00 Instagram removed 2026-09-01, Lamont's call. There is no
      // MostHatedNBA Instagram account, so this slot had 14 written posts
      // queued for a place that does not exist — the same shape as The
      // Conductor in the note on BrandReadiness.handle in accounts.ts. Put it
      // back only once an account exists and its handle is recorded above.
      { day: 0, time: "19:00", platform: "x" },
    ],
    voice: {
      tone: "Bold, opinionated, barbershop energy — debate-starting, never ESPN-corporate",
      audience: "NBA fans who want real talk, not sanitized takes",
      cultural_context:
        "Brooklyn hip hop roots, golden-era NYC authenticity. Expert basketball analysis without the filter. The site ranks and profiles the most hated players ever, and readers vote.",
      emoji_style: "moderate",
      banned_words: [
        "reportedly",
        "sources say",
        "allegedly",
        "per sources",
        "arguably",
      ],
      hashtags: ["#MostHatedNBA", "#NBATwitter", "#HoopsDebate"],
      keywords: ["NBA", "basketball", "debate", "villains", "rankings", "vote"],
      example_posts: [],
    },
    // Only the page types that carry a real picture.
    //
    // /hall-of-villains/<player> and /blog/<why-everyone-hates-x> each set
    // og:image to that player's own portrait — /villain-portraits/<player>.jpg.
    // /rivalry/, /team/ and /era/ pages all fall back to the site-wide
    // og-image.png, so posting them means the same generic graphic over and
    // over. 97 pages still have portraits, which is four times the 24 slots a
    // month, so nothing repeats.
    //
    // Worth revisiting if those page types ever get their own artwork.
    destinations: [{ url: "mosthatednba.com", action: "read the rest" }],
    sources: [
      {
        sitemap: "https://www.mosthatednba.com/sitemap.xml",
        include: [/\/hall-of-villains\//i, /\/blog\//i],
        exclude: BOILERPLATE,
      },
    ],
    evergreenTopics: [
      "The player everyone forgets belongs in the Hall of Villains",
      "Most hated is not the same as worst — make the case",
    ],
  },

  // ---------------------------------------------------------------- mission
  {
    slug: "wwsh",
    name: "WWSH",
    colorHex: "#534AB7",
    tagline: "Youth development nonprofit",
    active: true,
    // Given by Lamont 2026-08-24 and checked: "Lamont (@wwsh_community_nyc)",
    // 132 followers, 33 posts. The slug fallback would have said @wwsh, which
    // is a different, dormant account.
    handle: "@wwsh_community_nyc",
    // Given by Lamont 2026-09-01 and checked against the live profile:
    // linkedin.com/in/lamont-kirton-17058b333, "Lamont Kirton — Founder & CEO,
    // Working Wonders Starting Home Inc.", Jamaica NY, 3 connections. It is his
    // personal profile rather than a company page, which is why it sits on the
    // WWSH brand: the banner is WWSH's and the posts would be WWSH's.
    //
    // Recorded, deliberately not scheduled. There is no LinkedIn slot on this
    // brand and no LinkedIn support in the publisher — readiness only knows
    // instagram, facebook and x, and /connect only builds instagram and x rows.
    // A slot here today would write posts nothing can send and no page would
    // show as waiting, which is worse than the MostHatedNBA Instagram case
    // because that one at least showed up in red. Three connections is the
    // other reason to wait.
    handles: { linkedin: "linkedin.com/in/lamont-kirton-17058b333" },
    // communitynyc.org serves the same chess-programme photo as og:image on
    // every page, so basketball posts were going out illustrated with chess.
    // Lift this the moment WWSH has real basketball photos in library/wwsh/.
    sitewideShareImage: true,
    // Was Tuesday Facebook + Thursday Instagram. The Facebook slot is gone
    // rather than moved: WWSH has only two postable pages on communitynyc.org,
    // so it was already writing near-duplicates — three September posts opened
    // with the same sentence. Fewer slots against the same two topics is an
    // improvement, not a loss. Restore this when the site has more to say.
    schedule: [{ day: 4, time: "12:00", platform: "instagram" }],
    voice: {
      tone: "Community-driven, warm, credible, Brooklyn-rooted",
      audience:
        "Brooklyn community members, donors, DYCD partners, youth and their families",
      cultural_context:
        "16+ years serving Brooklyn youth, anchored at Kings Bay YM-YWHA. Real relationships, not press releases.",
      emoji_style: "minimal",
      banned_words: [
        "synergy",
        "leverage",
        "innovative",
        "stakeholders",
        "impactful",
      ],
      hashtags: [
        "#WorkingWonders",
        "#BrooklynYouth",
        "#YouthDevelopment",
        "#WWSH",
      ],
      keywords: [
        "Brooklyn",
        "youth development",
        "community",
        "after-school",
        "Kings Bay",
      ],
      example_posts: [],
    },
    // WWSH posts from communitynyc.org — that is the nonprofit's public site.
    // ⚠️ Point at the child sitemap, not /sitemap.xml: GoDaddy serves a
    // <sitemapindex> there and parseSitemap only reads <url> entries, so the
    // index yields nothing at all. sitemap.ols.xml is the online store.
    // The nonprofit's public site. "Find the programme" and not "donate":
    // nothing on communitynyc.org asks for money, and a caption must not send
    // people somewhere to do a thing the page does not offer.
    destinations: [{ url: "communitynyc.org", action: "find the programme" }],
    sources: [
      {
        sitemap: "https://communitynyc.org/sitemap.website.xml",
        exclude: BOILERPLATE.concat([/\/dycd-registration-form\b/i]),
      },
    ],
    evergreenTopics: [
      "Sunday basketball at 2670 Coyle St — what a session actually looks like",
      "What 16 years in the same neighborhood buys you that a grant cycle can't",
      "The signs a coach learns to read long before a kid says anything",
    ],
  },
  {
    slug: "the-conductor",
    name: "The Conductor",
    colorHex: "#0EA5E9",
    tagline: "NYC subway & bus history",
    /*
     * Off, 2026-08-27, because Lamont decided there will be no social account
     * for this one. Not "not yet" — not at all.
     *
     * It had been writing a post every Wednesday into nothing: 14 written, 9 of
     * them still ahead, 5 already sitting in the backlog. Leaving it on would
     * have kept spending the weekly writer's budget on an audience that is
     * never going to exist, and kept five rows in a list of missed posts that
     * could not be missed.
     *
     * Nothing is deleted. The captions stay in storage keyed by slot id and are
     * simply never resolved again; flipping this back to true brings all of it
     * straight back.
     */
    active: false,
    // Every page returns the same /opengraph-image — verified on /bus/B31 and
    // /bus/B41 — so a post about one route would carry the site's generic card.
    sitewideShareImage: true,
    schedule: [{ day: 3, time: "08:00", platform: "x" }],
    voice: {
      tone: "Practical, plainspoken, New York — helpful with zero hype",
      audience:
        "NYC commuters, and riders who need to know whether a station is actually accessible before they leave",
      cultural_context:
        "A transit companion covering 496 subway stations and 345 bus routes with live arrivals, built with Antoine White. It asks which borough you mean, because 55 station names repeat across the system.",
      emoji_style: "none",
      banned_words: [
        "seamless",
        "revolutionize",
        "one-stop",
        "cutting-edge",
        "effortless",
      ],
      hashtags: ["#NYCTransit", "#MTA", "#TheConductor"],
      keywords: [
        "subway",
        "bus",
        "NYC",
        "accessibility",
        "live arrivals",
        "commute",
      ],
      example_posts: [],
    },
    sources: [
      {
        sitemap: "https://theconductor.net/sitemap.xml",
        exclude: BOILERPLATE,
      },
    ],
    evergreenTopics: [
      "Fifty-five station names repeat across the boroughs. Here's how The Conductor handles it.",
      "Checking whether a station has a working elevator before you leave the house",
    ],
  },
  {
    slug: "heart-of-the-block",
    name: "Heart of the Block",
    // The site's own theme-color, so the calendar dot matches the real brand.
    colorHex: "#c23a22",
    tagline: "Brooklyn heart health",
    /*
     * Off, 2026-08-31, because Lamont said he doesn't need posts for this one.
     *
     * The comment that used to sit here said the queue was a bank of drafts,
     * written ahead of accounts that did not exist yet. The accounts are not
     * coming, so the bank has no depositor. It was writing a post every Monday
     * at 18:00 into nothing: 21 captions across Jun 2026 - Jan 2027, 18 of them
     * still ahead of today, plus 3 sitting in the backlog as missed posts that
     * could not have been missed.
     *
     * Nothing is deleted. The captions stay in storage keyed by slot id and are
     * simply never resolved again; flipping this back to true brings all of it
     * straight back.
     */
    active: false,
    // The site has real food photography but sets og:image on none of the
    // lesson or recipe pages, so posts were falling back to a generated card.
    // These are the actual pictures heartoftheblock.org serves, already public
    // — the oxtail lesson gets the oxtail photograph. Filename-matched where it
    // can be (see pickForSlot), rotated where it can't.
    imageLibrary: [
      "https://heartoftheblock.org/images/food/oxtail.jpg",
      "https://heartoftheblock.org/images/food/friedchicken.jpg",
      "https://heartoftheblock.org/images/food/greens.jpg",
      "https://heartoftheblock.org/images/food/beans.jpg",
      "https://heartoftheblock.org/images/food/salmon.jpg",
      "https://heartoftheblock.org/images/food/seafoodrice.jpg",
      "https://heartoftheblock.org/images/food/soda.jpg",
      "https://heartoftheblock.org/images/food/porridge.jpg",
      "https://heartoftheblock.org/images/food/move.jpg",
      "https://heartoftheblock.org/images/cooking.jpg",
      "https://heartoftheblock.org/images/market.jpg",
      "https://heartoftheblock.org/images/hero-block.jpg",
    ],
    // Thursday's Facebook slot dropped 14 Aug 2026. Heart of the Block has no
    // social accounts at all yet, so its posts are a bank of drafts either way —
    // writing twice as many of them into a bank nobody is emptying was the
    // wrong end to spend on.
    schedule: [{ day: 1, time: "18:00", platform: "instagram" }],
    voice: {
      tone: "Warm, plain, neighbour-to-neighbour — never clinical, never scolding about food",
      audience:
        "Black and Caribbean adults in Brooklyn looking after their blood pressure, cholesterol and weight, and the family members who cook for them",
      cultural_context:
        "A Brooklyn heart-health platform: understand your numbers, make real food swaps, scan products in the store, and find genuinely healthy places to shop nearby. The lessons work with the food people actually cook — oxtail, rice and peas, fried chicken, greens — making them lighter rather than telling anyone to give them up. The site is published in English, Spanish and Haitian Creole.",
      emoji_style: "minimal",
      banned_words: [
        // Diet-culture and shame language — the whole premise is the opposite.
        "superfood",
        "clean eating",
        "guilt-free",
        "cheat meal",
        "obesity epidemic",
        "bad foods",
        "indulge",
        "sinful",
        // Nothing here may read as medical advice or a promise.
        "cure",
        "reverse your",
        "doctor-approved",
        "miracle",
      ],
      hashtags: [
        "#HeartOfTheBlock",
        "#BrooklynHealth",
        "#HeartHealth",
        "#KnowYourNumbers",
      ],
      keywords: [
        "heart health",
        "blood pressure",
        "cholesterol",
        "Brooklyn",
        "food swaps",
        "Caribbean cooking",
      ],
      example_posts: [],
    },
    sources: [
      {
        sitemap: "https://heartoftheblock.org/sitemap.xml",
        // /scan, /tracker, /plans and /directory are app screens behind a
        // login — the lessons and recipes are what's worth sending people to.
        include: [/\/learn\b/i, /\/recipes\b/i, /\/abcs\b/i, /\/swaps\b/i, /\/get-screened\b/i, /\/healthy-buys\b/i, /\/money-for-produce\b/i, /\/heart-risk\b/i],
        // The bare /learn hub lists the articles instead of being one, so it
        // gives the writer nothing concrete — same reason Emeka's hubs are out.
        exclude: BOILERPLATE.concat([/\/disclaimer\b/i, /\/learn\/?$/i]),
      },
    ],
    evergreenTopics: [
      "Making oxtail lighter without making it something else",
      "What the numbers on a blood-pressure reading actually mean",
      "Reading a food label in the aisle, in under ten seconds",
    ],
  },
  {
    slug: "beyondchess",
    name: "BeyondChess",
    colorHex: "#0D9488",
    tagline: "Chess-based education",
    active: false,
    schedule: [{ day: 3, time: "16:00", platform: "facebook" }],
    voice: {
      tone: "Smart, inspiring, education-forward, accessible to parents and kids",
      audience:
        "Parents of middle schoolers, school administrators, funders, students",
      cultural_context:
        "Chess as a bridge to critical thinking and CS literacy. After-school programming, PS 272 Brooklyn.",
      emoji_style: "minimal",
      banned_words: [
        "gamification",
        "disruptive",
        "scalable",
        "innovative",
      ],
      hashtags: [
        "#BeyondChess",
        "#ChessEducation",
        "#BrooklynSchools",
        "#AfterSchool",
      ],
      keywords: [
        "chess",
        "education",
        "middle school",
        "critical thinking",
        "STEM",
      ],
      example_posts: [],
    },
    sources: [],
    evergreenTopics: [
      "What a kid learns from losing a game they thought they had won",
    ],
  },
  {
    slug: "adaptive-basketball",
    name: "Adaptive Basketball Program",
    colorHex: "#EA580C",
    tagline: "Inclusive youth sports",
    active: false,
    schedule: [{ day: 5, time: "17:00", platform: "facebook" }],
    voice: {
      tone: "Celebratory, community-proud, youth-focused, inclusive",
      audience: "Program families, Brooklyn community, DYCD, donors",
      cultural_context:
        "60 Brooklyn youth at Kings Bay YM-YWHA. Write about players as players.",
      emoji_style: "minimal",
      banned_words: [
        "handicapped",
        "special needs",
        "suffering from",
        "confined to",
        "inspirational despite",
      ],
      hashtags: [
        "#AdaptiveBasketball",
        "#BrooklynHoops",
        "#InclusiveSports",
        "#WWSH",
      ],
      keywords: ["adaptive", "basketball", "Brooklyn", "youth", "inclusive"],
      example_posts: [],
    },
    sources: [],
    evergreenTopics: [
      "What people miss the first time they watch an adaptive game",
    ],
  },
  // ------------------------------------------------------------------ books
  {
    slug: "iris-and-sage",
    name: "Iris & Sage",
    colorHex: "#4338CA",
    tagline: "Children's book series (pre-launch)",
    // Off since 2026-08-09: posting only for brands with a live website, and
    // the books don't have one yet. Turn back on when the print order is placed
    // and there's somewhere for a post to send people.
    active: false,
    schedule: [
      { day: 1, time: "10:00", platform: "instagram" },
      { day: 4, time: "20:00", platform: "facebook" },
    ],
    voice: {
      tone: "Warm, calm, emotionally intelligent — gentle without being soft-headed; talks to a grown-up who wants to help a child, never preachy",
      audience:
        "Parents, teachers, counselors and homeschoolers of kids roughly 5–9 who want real language for big feelings",
      cultural_context:
        "Iris & Sage is an illustrated feelings series with two Black kid-guardians, both age 9. The premise: Iris sees, Sage grows, the storm passes. Each book takes one hard feeling and gives a child a concrete move to make with it. The books are still being finished — nothing is on sale yet; the work now is building the audience that will want them.",
      emoji_style: "minimal",
      banned_words: [
        "empower",
        "screen time",
        "must-have",
        "content",
        "leverage",
        "SEL solution",
        "toolkit",
      ],
      hashtags: [
        "#IrisAndSage",
        "#BigFeelings",
        "#KidsBooks",
        "#SocialEmotionalLearning",
        "#PictureBooks",
      ],
      keywords: [
        "feelings",
        "picture book",
        "kids",
        "emotions",
        "parenting",
        "classroom",
      ],
      example_posts: [],
    },
    sources: [],
    evergreenTopics: [
      {
        title: "The whole series in three lines",
        facts:
          "The premise of Iris & Sage: Iris sees. Sage grows. The storm passes. Two Black kid-guardians, both age 9, who help a child through one big feeling per book.",
      },
      {
        title: "The book about fear, and the move it teaches",
        facts:
          "The Iris & Sage book about fear ends on the refrain: 'Look at it. Name it. Take one small step.' A child learns to face a fear by naming it and taking one small action, not by pretending it isn't there.",
      },
      {
        title: "The book about anger",
        facts:
          "The Iris & Sage book about anger ends on the refrain: 'Anger is real. Let it cool before you let it out.' The point is that anger is allowed — the skill is the pause before acting on it.",
      },
      {
        title: "The book about grief",
        facts:
          "The Iris & Sage book about grief ends on the refrain: 'Love doesn't leave when they do.' It's about letting yourself be sad and letting love keep growing forward.",
      },
      {
        title: "The book about loneliness",
        facts:
          "The Iris & Sage book about loneliness ends on the refrain: 'Reach, and you'll find you were never alone.' The lie it names is 'you're the only one'; the room is full of others also hiding.",
      },
      {
        title: "The book about making mistakes",
        facts:
          "The Iris & Sage book about shame and mistakes ends on the refrain: 'A mistake is a step, not a stain.' It reframes a public mistake as part of learning rather than proof of failure.",
      },
      {
        title: "Why one feeling per book",
        facts:
          "Iris & Sage gives each hard feeling its own book — fear, anger, grief, jealousy, loneliness, shame, and change — so a child and grown-up can reach for the one that matches the day.",
      },
    ],
  },
  {
    slug: "emeka-ignites",
    name: "Emeka Ignites",
    colorHex: "#F59E0B",
    tagline: "Chapter-book series (pre-launch)",
    // Off since 2026-08-09, same reason as Iris & Sage: no live site to post
    // toward until the books are ordered.
    active: false,
    schedule: [
      { day: 2, time: "10:00", platform: "instagram" },
      { day: 6, time: "09:00", platform: "facebook" },
    ],
    voice: {
      tone: "Warm, proud and wonder-filled — adventure energy for young kids, never cynical; the same parent-to-parent voice as Emeka Explores with a spark of the heroic",
      audience:
        "Black parents, teachers and homeschoolers of kids roughly 4–9 who already love a hero story",
      cultural_context:
        "Emeka Ignites is a superhero series where the superpower is curiosity. The yellow star on Emeka's shirt lights up when she truly learns something. She never becomes someone else — she stays Emeka. Her opposite is 'The Dim', a force that makes people stop wondering. It's a spin-off of Emeka Explores. The books are being built now and are not yet released; the work is building anticipation.",
      emoji_style: "minimal",
      banned_words: [
        "empower",
        "content",
        "must-have",
        "learning journey",
        "STEM solution",
        "gritty",
      ],
      hashtags: [
        "#EmekaIgnites",
        "#CuriosityIsThePower",
        "#BlackGirlMagic",
        "#KidsBooks",
        "#BlackKidsBooks",
      ],
      keywords: [
        "curiosity",
        "superhero",
        "Emeka",
        "kids",
        "wonder",
        "learning",
      ],
      example_posts: [],
    },
    sources: [],
    evergreenTopics: [
      {
        title: "The one idea the whole series is built on",
        facts:
          "In Emeka Ignites, curiosity is the superpower. The yellow star on Emeka's shirt lights up when she truly learns something — the more she wonders and discovers, the brighter it burns.",
      },
      {
        title: "Meet the villain: The Dim",
        facts:
          "The villain in Emeka Ignites is 'The Dim' — not a person, but a force that makes people stop wondering and stop asking questions. Emeka fights it by staying curious.",
      },
      {
        title: "A hero who never changes who she is",
        facts:
          "Emeka Ignites has no secret identity and no costume change. Emeka doesn't become someone else to be powerful — she stays herself. The power was already hers.",
      },
      {
        title: "The rules that give the power its stakes",
        facts:
          "In Emeka Ignites the star-power has rules: it can't be forced, it can't be learned alone, and it fades if you stop using it. Curiosity has to be real, shared, and kept alive.",
      },
      {
        title: "The first book, told through the North Star",
        facts:
          "The first Emeka Ignites book centers on a grandmother's story of the North Star and people walking toward freedom — told hopefully and gently, faces lit by starlight.",
      },
    ],
  },
  {
    slug: "ourrose",
    name: "Our Rose LLC",
    colorHex: "#D97706",
    tagline: "Government contracting",
    active: false,
    schedule: [{ day: 2, time: "09:00", platform: "linkedin" }],
    voice: {
      tone: "Professional, credible, mission-aligned, government contracting context",
      audience:
        "Government partners, school principals, contracting officers, LinkedIn",
      cultural_context:
        "NYC MBE-certified entity focused on community-serving government contracts.",
      emoji_style: "none",
      banned_words: ["synergy", "disruptive", "pivot", "best-in-class"],
      hashtags: ["#OurRoseLLC", "#MBE", "#CommunityContracting"],
      keywords: [
        "MBE",
        "government contracting",
        "NYC",
        "community services",
      ],
      example_posts: [],
    },
    sources: [],
    evergreenTopics: [
      "What MBE certification actually changes about who gets to bid",
    ],
  },
];

export function activeBrands(): Brand[] {
  return BRANDS.filter((b) => b.active);
}

/**
 * A page description with the brand's site-wide furniture taken out.
 *
 * Lives here, next to `sitewidePageCopy`, because it has to run in two places.
 * Stripping it in lib/sources.ts alone would only clean topics discovered from
 * now on — and a caption record stores the topic it was written from, so every
 * slot already on the calendar would hand the boilerplate straight back to the
 * writer on the next reroll. lib/compose.ts runs it again on the way into the
 * facts block, which is the point where it actually matters.
 *
 * Returns undefined rather than an empty string when nothing survives: an empty
 * context and a missing one mean the same thing to the prompt builder, and only
 * one of them is handled there.
 */
export function withoutSitewideCopy(
  description: string | undefined,
  brand: Brand,
): string | undefined {
  if (!description || !brand.sitewidePageCopy) return description;
  const stripped = description
    .replace(brand.sitewidePageCopy, " ")
    // "<Category> · <boilerplate>" leaves a dangling separator behind, and a
    // facts block that opens with a bullet reads like something went missing.
    .replace(/[·—–-]\s*$/, "")
    .replace(/^\s*[·—–-]/, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped || undefined;
}

/**
 * The brand's own post-sized image for a topic, if it has one and the URL fits.
 *
 * Returns undefined for every brand without a `postImage` rule and for any URL
 * that does not match it, so the ordinary share-image path is untouched.
 */
export function postImageUrlFor(
  brand: Brand,
  url?: string,
  platform?: Platform,
): string | undefined {
  if (!brand.postImage || !url) return undefined;
  const m = url.match(brand.postImage.match);
  if (!m) return undefined;
  const template =
    (platform === "x" ? brand.postImage.wideTemplate : undefined) ??
    brand.postImage.template;
  return template.replace(/\$(\d)/g, (_, i) => m[Number(i)] ?? "");
}

export function brandBySlug(slug: string): Brand | undefined {
  return BRANDS.find((b) => b.slug === slug);
}
