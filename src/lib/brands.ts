import { Platform, VoiceProfile } from "./types";

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

export interface Brand {
  slug: string;
  name: string;
  colorHex: string;
  /** Included in the weekly digest. */
  active: boolean;
  /** How many posts the digest drafts each week. */
  postsPerWeek: number;
  /** Platforms to rotate through when drafting. */
  platforms: Platform[];
  voice: VoiceProfile;
  /**
   * Topic sources. A brand with none still works — it just falls back to
   * `evergreenTopics`, which is the right setup for anything without a site
   * (books, print runs).
   */
  sources: TopicSource[];
  /** Used when no source yields a fresh topic. Rotates week to week. */
  evergreenTopics: string[];
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
    active: true,
    postsPerWeek: 3,
    platforms: ["instagram", "facebook", "x"],
    voice: {
      tone: "Bold, funny, a little confrontational — game-night energy, never corporate",
      audience:
        "Adults 21+ who host game nights, buy party games as gifts, and like to argue for sport",
      cultural_context:
        "YODM = 'Your Opinion Doesn't Matter'. A debating card game: 92 cards, 7 categories, a 30-second timer, and a 'For It or Against It' die. You draw a card, roll the die, and argue whichever side the die gives you — even if you disagree. The joke is that you don't get to pick.",
      emoji_style: "moderate",
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
    sources: [
      {
        sitemap: "https://yodm.com/sitemap.xml",
        exclude: BOILERPLATE,
      },
    ],
    evergreenTopics: [
      "The rule that makes YODM work: the die picks your side, not you",
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
    active: true,
    postsPerWeek: 3,
    platforms: ["instagram", "facebook"],
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
    sources: [
      {
        sitemap: "https://www.emekaexplores.com/sitemap.xml",
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
    active: true,
    postsPerWeek: 4,
    platforms: ["x", "instagram"],
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
    sources: [
      {
        sitemap: "https://www.mosthatednba.com/sitemap.xml",
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
    active: true,
    postsPerWeek: 2,
    platforms: ["facebook", "instagram", "linkedin"],
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
    sources: [],
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
    active: true,
    postsPerWeek: 1,
    platforms: ["x", "facebook"],
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
    slug: "beyondchess",
    name: "BeyondChess",
    colorHex: "#0D9488",
    active: false,
    postsPerWeek: 1,
    platforms: ["facebook", "linkedin"],
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
    active: false,
    postsPerWeek: 1,
    platforms: ["facebook", "instagram"],
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
  {
    slug: "ourrose",
    name: "Our Rose LLC",
    colorHex: "#D97706",
    active: false,
    postsPerWeek: 1,
    platforms: ["linkedin"],
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
