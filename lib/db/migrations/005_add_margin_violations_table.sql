-- Migration: Add margin violations tracking table
-- Run with: npx tsx scripts/run-migration.ts 005_add_margin_violations_table.sql
-- Description: Tracks margin violations per user per day (3 violations = reject)

CREATE TABLE IF NOT EXISTS margin_violations (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  violation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(username, violation_date)
);

-- Track count per day
CREATE INDEX IF NOT EXISTS idx_margin_violations_user_date 
  ON margin_violations(username, violation_date);

-- Add comment
COMMENT ON TABLE margin_violations IS 
  'Tracks margin violations per user per day. After 3 violations, user is blocked for the day.';
