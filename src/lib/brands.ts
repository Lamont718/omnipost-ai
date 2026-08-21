import { PostSlot, VoiceProfile } from "./types";
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
   * Artwork this brand already publishes, as absolute URLs. Used ahead of the
   * page's share image, same as a Blob library — for a site that hosts good
   * pictures but doesn't set og:image on the pages that use them.
   */
  imageLibrary?: string[];
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
   * The posting schedule: one entry per weekly post — weekday, time, platform.
   * This is the whole "when do I post" model. The number of entries is how many
   * posts a week; edit these to change your cadence.
   */
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
    schedule: [
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
    sources: [
      {
        sitemap: "https://yodm.com/sitemap.xml",
        include: [/\/card\/\d+$/i],
        exclude: BOILERPLATE,
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
    // Wednesday was Facebook until 14 Aug 2026 — see the note on YODM. Kept at
    // three posts a week, all Instagram, because that is the only platform this
    // brand actually has an audience on.
    schedule: [
      { day: 1, time: "09:00", platform: "instagram" },
      { day: 3, time: "19:00", platform: "instagram" },
      { day: 5, time: "09:00", platform: "instagram" },
    ],
    voice: {
      tone: "Warm, proud, parent-to-parent — encouraging without being saccharine",
      audience:
        "Black parents, teachers and homeschoolers of kids roughly 4–9 looking for learning that reflects their children",
      cultural_context:
        "Emeka Explores teaches Black history, science, culture and the alphabet to young kids — 130+ illustrated lessons, interactive stories, games and badges, plus free parent guides. Made by a Brooklyn dad for his own kids first.",
      emoji_style: "minimal",
      banned_words: [
        "empower",
        "engaging content",
        "learning journey",
        "unlock their potential",
        "screen time solution",
      ],
      hashtags: [
        "#EmekaExplores",
        "#BlackHistoryForKids",
        "#BlackBoyJoy",
        "#RaisingReaders",
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
    schedule: [
      { day: 1, time: "20:00", platform: "x" },
      { day: 3, time: "20:00", platform: "x" },
      { day: 5, time: "12:00", platform: "instagram" },
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
    active: true,
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
    // ⚠️ There are no social accounts for this brand yet. Posts are being
    // written ahead of the accounts existing, at Lamont's request — so treat
    // the queue as a bank of drafts, not something anyone is waiting on.
    active: true,
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

export function brandBySlug(slug: string): Brand | undefined {
  return BRANDS.find((b) => b.slug === slug);
}
