-- Migration: Add honor column to user_profiles for Honor system
-- Run with: npx tsx scripts/run-migration.ts 008_add_user_honor.sql
-- Or execute directly in Neon Console

-- Add honor column (default 50 for new and existing users)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS honor INTEGER DEFAULT 50;

-- Backfill existing rows that have NULL honor
UPDATE user_profiles SET honor = 50 WHERE honor IS NULL;

-- Optional: enforce not null after backfill (uncomment if desired)
-- ALTER TABLE user_profiles ALTER COLUMN honor SET NOT NULL;
-- ALTER TABLE user_profiles ALTER COLUMN honor SET DEFAULT 50;

-- Index for leaderboard ORDER BY honor
CREATE INDEX IF NOT EXISTS idx_user_profiles_honor ON user_profiles(honor DESC);
