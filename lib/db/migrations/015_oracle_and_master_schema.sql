-- Migration: Oracle + Master v4 full schema (Full Build plan)
-- Run with: npx tsx scripts/run-migration.ts 015_oracle_and_master_schema.sql
-- Adds: receipt post-process columns, user_profiles level/season/income, all new tables.
-- receipt_rewards.ayumo_amount: always set = base_reward_amount + extra_reward_amount (trigger below).

-- ========== 1.1 receipts: post-process and slot columns ==========
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS post_process_state TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS post_process_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS post_process_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS post_process_retry_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS post_process_failed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS slot_type TEXT,
  ADD COLUMN IF NOT EXISTS rewarded BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS authenticity_score NUMERIC;

CREATE INDEX IF NOT EXISTS idx_receipts_post_process_state ON receipts(post_process_state);
CREATE INDEX IF NOT EXISTS idx_receipts_post_process_pending ON receipts(post_process_state) WHERE post_process_state = 'pending';

-- ========== 1.1 user_profiles: level, season, income, cards ==========
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS account_level INT,
  ADD COLUMN IF NOT EXISTS account_xp INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS season_level INT,
  ADD COLUMN IF NOT EXISTS season_xp INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS card_slot1_choice TEXT,
  ADD COLUMN IF NOT EXISTS card_slot2_choice TEXT,
  ADD COLUMN IF NOT EXISTS card_slot3_choice TEXT,
  ADD COLUMN IF NOT EXISTS declared_monthly_income_band TEXT,
  ADD COLUMN IF NOT EXISTS declared_income_currency CHAR(3);

-- ========== 1.2 New tables ==========

-- receipt_vision_raw: Google Vision JSON per receipt
CREATE TABLE IF NOT EXISTS receipt_vision_raw (
  receipt_id TEXT PRIMARY KEY REFERENCES receipts(receipt_id) ON DELETE CASCADE,
  vision_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- receipt_rewards: base/extra reward, hidden cost, ayumo_amount (trigger keeps ayumo = base + extra)
CREATE TABLE IF NOT EXISTS receipt_rewards (
  receipt_id TEXT PRIMARY KEY REFERENCES receipts(receipt_id) ON DELETE CASCADE,
  base_reward_amount NUMERIC NOT NULL,
  extra_reward_amount NUMERIC DEFAULT 0,
  base_hidden_cost NUMERIC,
  final_hidden_cost NUMERIC,
  ayumo_amount NUMERIC NOT NULL,
  ryumo_bonus_amount NUMERIC,
  cpi_multiplier_used NUMERIC,
  exchange_rate_used NUMERIC,
  season_level_multiplier_used NUMERIC,
  reward_version INT NOT NULL DEFAULT 1,
  account_xp_contribution NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Rule: ayumo_amount = base_reward_amount + extra_reward_amount on every insert/update
CREATE OR REPLACE FUNCTION set_receipt_rewards_ayumo_amount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ayumo_amount := COALESCE(NEW.base_reward_amount, 0) + COALESCE(NEW.extra_reward_amount, 0);
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_receipt_rewards_ayumo ON receipt_rewards;
CREATE TRIGGER tr_receipt_rewards_ayumo
  BEFORE INSERT OR UPDATE OF base_reward_amount, extra_reward_amount ON receipt_rewards
  FOR EACH ROW EXECUTE PROCEDURE set_receipt_rewards_ayumo_amount();

-- receipt_quality
CREATE TABLE IF NOT EXISTS receipt_quality (
  receipt_id TEXT PRIMARY KEY REFERENCES receipts(receipt_id) ON DELETE CASCADE,
  score INT CHECK (score >= 0 AND score <= 100),
  tier CHAR(1) CHECK (tier IN ('S','A','B','C')),
  reasons JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- receipt_line_items
CREATE TABLE IF NOT EXISTS receipt_line_items (
  id SERIAL PRIMARY KEY,
  receipt_id TEXT NOT NULL REFERENCES receipts(receipt_id) ON DELETE CASCADE,
  raw_name TEXT,
  canonical_name TEXT,
  brand TEXT,
  category_lvl1 TEXT,
  category_lvl2 TEXT,
  pack_size TEXT,
  unit_type TEXT,
  quantity NUMERIC,
  unit_price NUMERIC,
  line_total NUMERIC,
  vat_rate NUMERIC,
  observed_at TIMESTAMPTZ DEFAULT now(),
  line_fingerprint TEXT
);

CREATE INDEX IF NOT EXISTS idx_receipt_line_items_receipt ON receipt_line_items(receipt_id);

-- user_trust_scores
CREATE TABLE IF NOT EXISTS user_trust_scores (
  username VARCHAR(255) PRIMARY KEY,
  trust_score INT NOT NULL,
  tier CHAR(1) NOT NULL CHECK (tier IN ('G','F','E','D','C','B','A','S')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- user_trust_score_history (trust audit; no trust_events table)
CREATE TABLE IF NOT EXISTS user_trust_score_history (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  previous_score INT,
  new_score INT NOT NULL,
  previous_tier CHAR(1),
  new_tier CHAR(1),
  reason_type TEXT NOT NULL,
  reason_detail TEXT,
  reference_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trust_history_username ON user_trust_score_history(username);
CREATE INDEX IF NOT EXISTS idx_trust_history_created ON user_trust_score_history(created_at DESC);

-- user_archetypes
CREATE TABLE IF NOT EXISTS user_archetypes (
  username VARCHAR(255) PRIMARY KEY,
  archetype TEXT,
  dimensions JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- user_income_declarations
CREATE TABLE IF NOT EXISTS user_income_declarations (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  period_year INT NOT NULL,
  period_month INT NOT NULL,
  declared_amount NUMERIC,
  currency CHAR(3),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(username, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS idx_user_income_declarations_username ON user_income_declarations(username);

-- user_pipeline_quotas (daily slot counts per user)
CREATE TABLE IF NOT EXISTS user_pipeline_quotas (
  username VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  general_rewarded_count INT DEFAULT 0,
  slot1_count INT DEFAULT 0,
  slot2_count INT DEFAULT 0,
  slot3_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (username, date)
);

-- account_xp_events
CREATE TABLE IF NOT EXISTS account_xp_events (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  xp_delta INT NOT NULL,
  source_type TEXT NOT NULL,
  reference_id TEXT,
  ayumo_linked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_xp_events_username ON account_xp_events(username);

-- season_xp_events
CREATE TABLE IF NOT EXISTS season_xp_events (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  xp_delta INT NOT NULL,
  source_type TEXT NOT NULL,
  reference_id TEXT,
  season_number INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_season_xp_events_username_season ON season_xp_events(username, season_number);

-- seasons
CREATE TABLE IF NOT EXISTS seasons (
  id SERIAL PRIMARY KEY,
  season_number INT NOT NULL UNIQUE,
  name TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- surprise_challenges (before user_account_milestones for FK)
CREATE TABLE IF NOT EXISTS surprise_challenges (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  trigger_signal TEXT,
  title TEXT,
  description TEXT,
  reward_ryumo NUMERIC,
  reward_badge_id INT,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  completion_criteria JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- user_account_milestones
CREATE TABLE IF NOT EXISTS user_account_milestones (
  username VARCHAR(255) NOT NULL,
  milestone_number INT NOT NULL,
  account_level_reached INT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now(),
  surprise_challenge_id INT REFERENCES surprise_challenges(id) ON DELETE SET NULL,
  PRIMARY KEY (username, milestone_number)
);

-- quest_templates
CREATE TABLE IF NOT EXISTS quest_templates (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL,
  trigger_signal TEXT,
  title TEXT NOT NULL,
  reward_ryumo NUMERIC,
  reward_season_xp NUMERIC,
  min_account_level INT,
  min_season_level INT,
  trust_delta INT,
  platform_filter TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- user_quests
CREATE TABLE IF NOT EXISTS user_quests (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  quest_template_id INT NOT NULL REFERENCES quest_templates(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active',
  progress NUMERIC DEFAULT 0,
  target NUMERIC,
  season_number INT NOT NULL,
  expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_quests_username ON user_quests(username);
CREATE INDEX IF NOT EXISTS idx_user_quests_template ON user_quests(quest_template_id);

-- badges
CREATE TABLE IF NOT EXISTS badges (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- user_badges
CREATE TABLE IF NOT EXISTS user_badges (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  badge_id INT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(username, badge_id)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_username ON user_badges(username);

-- season_leaderboard (snapshot per season)
CREATE TABLE IF NOT EXISTS season_leaderboard (
  id SERIAL PRIMARY KEY,
  season_id INT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  username VARCHAR(255) NOT NULL,
  hidden_cost_score NUMERIC,
  trust_score INT,
  badge_points NUMERIC,
  quest_xp NUMERIC,
  total_score NUMERIC,
  rank INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(season_id, username)
);

CREATE INDEX IF NOT EXISTS idx_season_leaderboard_season_rank ON season_leaderboard(season_id, rank);

-- referral_relationships
CREATE TABLE IF NOT EXISTS referral_relationships (
  id SERIAL PRIMARY KEY,
  referrer_username VARCHAR(255) NOT NULL,
  referee_username VARCHAR(255) NOT NULL,
  referee_phone_verified_at TIMESTAMPTZ,
  seasons_remaining INT DEFAULT 2,
  active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(referrer_username, referee_username)
);

CREATE INDEX IF NOT EXISTS idx_referral_referee ON referral_relationships(referee_username);

-- referral_reward_log (per-receipt audit)
CREATE TABLE IF NOT EXISTS referral_reward_log (
  id SERIAL PRIMARY KEY,
  referral_relationship_id INT NOT NULL REFERENCES referral_relationships(id) ON DELETE CASCADE,
  receipt_id TEXT NOT NULL,
  season_number INT NOT NULL,
  amount_ryumo_referrer NUMERIC NOT NULL DEFAULT 0,
  amount_ryumo_referee NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_reward_log_receipt ON referral_reward_log(receipt_id);

-- notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;

-- ayumo_conversion_log
CREATE TABLE IF NOT EXISTS ayumo_conversion_log (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  ayumo_amount NUMERIC NOT NULL,
  yumo_amount NUMERIC NOT NULL,
  account_xp_burned NUMERIC,
  season_xp_penalty NUMERIC,
  conversion_type TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ayumo_conversion_username ON ayumo_conversion_log(username);
