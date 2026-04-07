-- OmniPost AI Database Schema
-- Run this in Supabase SQL Editor

-- Organizations table
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  website_url TEXT,
  voice_profile JSONB NOT NULL DEFAULT '{}',
  color_hex TEXT NOT NULL DEFAULT '#534AB7',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Social accounts table
CREATE TABLE social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'x')),
  access_token TEXT NOT NULL,
  account_name TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  caption TEXT NOT NULL,
  image_url TEXT,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'x')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'scheduled', 'published', 'rejected')),
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  ai_generated BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_posts_org_id ON posts(org_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_scheduled_at ON posts(scheduled_at);
CREATE INDEX idx_social_accounts_org_id ON social_accounts(org_id);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- RLS policies (single owner — allow authenticated users full access)
CREATE POLICY "Authenticated users can manage organizations"
  ON organizations FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage social accounts"
  ON social_accounts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage posts"
  ON posts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed the 5 organizations
INSERT INTO organizations (name, slug, voice_profile, color_hex, website_url) VALUES
(
  'WWSH',
  'wwsh',
  '{
    "tone": "Community-driven, warm, credible, Brooklyn-rooted",
    "audience": "Brooklyn community members, donors, DYCD partners, youth families",
    "cultural_context": "16+ years serving Brooklyn youth, Kings Bay YM-YWHA anchor, real relationships not press releases",
    "emoji_style": "minimal",
    "banned_words": ["synergy", "leverage", "innovative", "stakeholders", "impactful"],
    "hashtags": ["#WorkingWonders", "#BrooklynYouth", "#YouthDevelopment", "#WWSH"],
    "keywords": ["Brooklyn", "youth development", "community", "after-school", "Kings Bay"],
    "example_posts": []
  }'::jsonb,
  '#534AB7',
  NULL
),
(
  'BeyondChess',
  'beyondchess',
  '{
    "tone": "Smart, inspiring, education-forward, accessible to parents and kids",
    "audience": "Parents of middle schoolers, school administrators, funders, students",
    "cultural_context": "Chess as a bridge to critical thinking and CS literacy, PS 272 Brooklyn, after-school programming",
    "emoji_style": "minimal",
    "banned_words": ["gamification", "disruptive", "scalable", "innovative"],
    "hashtags": ["#BeyondChess", "#ChessEducation", "#BrooklynSchools", "#AfterSchool"],
    "keywords": ["chess", "education", "middle school", "critical thinking", "STEM"],
    "example_posts": []
  }'::jsonb,
  '#0D9488',
  'https://beyondchess.app'
),
(
  'Our Rose LLC',
  'ourrose',
  '{
    "tone": "Professional, credible, mission-aligned, government contracting context",
    "audience": "Government partners, school principals, contracting officers, LinkedIn",
    "cultural_context": "NYC MBE-certified entity focused on community-serving government contracts",
    "emoji_style": "none",
    "banned_words": ["synergy", "disruptive", "pivot"],
    "hashtags": ["#OurRoseLLC", "#NYBME", "#CommunityContracting"],
    "keywords": ["MBE", "government contracting", "NYC", "community services"],
    "example_posts": []
  }'::jsonb,
  '#D97706',
  NULL
),
(
  'Adaptive Basketball Program',
  'adaptive-basketball',
  '{
    "tone": "Celebratory, community-proud, youth-focused, inclusive",
    "audience": "Program families, Brooklyn community, DYCD, donors",
    "cultural_context": "60 Brooklyn youth, Kings Bay YM-YWHA, runs through June 2026",
    "emoji_style": "minimal",
    "banned_words": ["handicapped", "special needs", "suffering from"],
    "hashtags": ["#AdaptiveBasketball", "#BrooklynHoops", "#InclusiveSports", "#WWSH"],
    "keywords": ["adaptive", "basketball", "Brooklyn", "youth", "inclusive"],
    "example_posts": []
  }'::jsonb,
  '#EA580C',
  NULL
),
(
  'MostHatedNBA',
  'mosthated',
  '{
    "tone": "Bold, opinionated, barbershop energy, NBA culture-aware, debate-starting",
    "audience": "NBA fans who want real talk, not ESPN corporate takes",
    "cultural_context": "Brooklyn hip hop culture roots, golden era NYC authenticity, expert sports analysis without the filter",
    "emoji_style": "moderate",
    "banned_words": ["reportedly", "sources say", "allegedly", "per sources"],
    "hashtags": ["#MostHatedNBA", "#NBATwitter", "#HoopsDebate"],
    "keywords": ["NBA", "basketball", "debate", "hot takes", "playoffs"],
    "example_posts": []
  }'::jsonb,
  '#DC2626',
  'https://mosthatednba.com'
);
