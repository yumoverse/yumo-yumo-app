-- Migration: Receipt feedback (Report a bug) for user-reported extraction errors.
-- Run with: npx tsx scripts/run-migration.ts 011_receipt_feedback.sql (if available)

CREATE TABLE IF NOT EXISTS receipt_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  bug_types TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipt_feedback_receipt_id ON receipt_feedback(receipt_id);
CREATE INDEX IF NOT EXISTS idx_receipt_feedback_created_at ON receipt_feedback(created_at DESC);
