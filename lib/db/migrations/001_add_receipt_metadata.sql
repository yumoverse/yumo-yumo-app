-- Migration: Add receipt metadata fields
-- Run with: npx tsx scripts/run-migration.ts 001_add_receipt_metadata.sql
-- Or execute directly in Neon Console

-- Add new columns to receipts table
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS proof_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS is_rewarded BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS reward_tier VARCHAR(10) DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS risk_score NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS evidence JSONB,
  ADD COLUMN IF NOT EXISTS source JSONB;

-- Set default values for existing records
-- isRewarded: true for all existing non-manual records (we can't distinguish manual yet, so set all to true)
UPDATE receipts
SET 
  is_rewarded = true,
  reward_tier = 'A'
WHERE is_rewarded IS NULL OR reward_tier IS NULL;

-- Create index on proof_type for filtering
CREATE INDEX IF NOT EXISTS idx_receipts_proof_type ON receipts(proof_type);

-- Create index on is_rewarded for filtering
CREATE INDEX IF NOT EXISTS idx_receipts_is_rewarded ON receipts(is_rewarded);

-- Create index on reward_tier for filtering
CREATE INDEX IF NOT EXISTS idx_receipts_reward_tier ON receipts(reward_tier);

-- Create index on risk_score for filtering/sorting
CREATE INDEX IF NOT EXISTS idx_receipts_risk_score ON receipts(risk_score);
