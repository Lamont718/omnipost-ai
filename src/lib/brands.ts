import { PostSlot, VoiceProfile } from "./types";

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
    schedule: [
      { day: 2, time: "18:00", platform: "instagram" },
      { day: 4, time: "19:00", platform: "facebook" },
      { day: 6, time: "11:00", platform: "x" },
    ],
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
    tagline: "Kids' learning site — 130+ lessons",
    active: true,
    schedule: [
      { day: 1, time: "09:00", platform: "instagram" },
      { day: 3, time: "19:00", platform: "facebook" },
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
    tagline: "Youth development nonprofit",
    active: true,
    schedule: [
      { day: 2, time: "17:00", platform: "facebook" },
      { day: 4, time: "12:00", platform: "instagram" },
    ],
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
    tagline: "NYC subway & bus history",
    active: true,
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
    active: true,
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
    active: true,
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
