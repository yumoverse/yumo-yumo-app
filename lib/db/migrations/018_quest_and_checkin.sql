-- Migration: Quest & Check-in (Yarisma demo)
-- Run with: npx tsx scripts/run-migration.ts 018_quest_and_checkin.sql
-- Adds: check_ins table, user_profiles ryumo/streak, seasons + quest_templates seed.

-- ========== 1. user_profiles: ryumo_balance, streak, current_season_number ==========
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS ryumo_balance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_season_number INT;

-- ========== 2. check_ins table ==========
CREATE TABLE IF NOT EXISTS check_ins (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  check_in_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(username, check_in_date)
);

CREATE INDEX IF NOT EXISTS idx_check_ins_username ON check_ins(username);
CREATE INDEX IF NOT EXISTS idx_check_ins_date ON check_ins(check_in_date);

-- ========== 3. seasons seed (14 gun demo: 2026-02-18 ~ 2026-03-04) ==========
INSERT INTO seasons (season_number, name, start_at, end_at, status)
SELECT 1, 'Trial Season', '2026-02-18 00:00:00+00'::timestamptz, '2026-03-04 00:00:00+00'::timestamptz, 'active'
WHERE NOT EXISTS (SELECT 1 FROM seasons WHERE season_number = 1);

-- ========== 4. quest_templates seed (Daily D1-D9, Weekly W1A-W6) ==========
-- Daily
INSERT INTO quest_templates (type, title, reward_ryumo, reward_season_xp, min_account_level, min_season_level)
SELECT v.type, v.title, v.reward_ryumo, v.reward_season_xp, v.min_account_level, v.min_season_level
FROM (VALUES
  ('D1'::text, 'Gunluk Check-in'::text, 12::numeric, 32::numeric, 1, 1),
  ('D3', 'Bugunun kategorisinden 1 fis', 12, 60, 1, 1),
  ('D4', '2 farkli kategori tamamla', 12, 75, 1, 1),
  ('D5', 'Hidden cost >= threshold', 17, 85, 1, 1),
  ('D6', 'Hidden cost orani >= %X', 12, 75, 1, 1),
  ('D7', 'Yeni merchant', 12, 65, 1, 1),
  ('D8', '2 farkli merchant', 12, 75, 1, 1),
  ('D9', 'Zaman penceresinde fis yukle', 12, 55, 1, 1)
) AS v(type, title, reward_ryumo, reward_season_xp, min_account_level, min_season_level)
WHERE NOT EXISTS (SELECT 1 FROM quest_templates q WHERE q.type = v.type);

-- Weekly
INSERT INTO quest_templates (type, title, reward_ryumo, reward_season_xp, min_account_level, min_season_level)
SELECT v.type, v.title, v.reward_ryumo, v.reward_season_xp, v.min_account_level, v.min_season_level
FROM (VALUES
  ('W1A'::text, 'Minimalist Plan'::text, 220::numeric, 500::numeric, 1, 1),
  ('W1B', 'Agresif Plan', 230, 550, 1, 1),
  ('W1C', 'Dengeli Plan', 225, 520, 1, 1),
  ('W2', 'Hedef Kullaniciyi Gec', 235, 550, 1, 1),
  ('W3', 'Kendi Rekorunu Kir', 220, 500, 1, 1),
  ('W4', 'Tek Sektor Uzmani', 225, 520, 1, 1),
  ('W5', 'Riskli Hafta', 240, 600, 1, 1),
  ('W6', 'Sosyal Tirmanis', 230, 550, 1, 1)
) AS v(type, title, reward_ryumo, reward_season_xp, min_account_level, min_season_level)
WHERE NOT EXISTS (SELECT 1 FROM quest_templates q WHERE q.type = v.type);
