-- Migration: Track first uploader per merchant (unverified→verified) and one-time 1.2x bonus.
-- Run with: npx tsx scripts/run-migration.ts 010_merchant_first_uploader_and_bonus.sql (if available)

-- Who triggered the creation of this merchant (first receipt that caused unverified insert)
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS first_receipt_username TEXT;

-- One-time 1.2x bonus: (username, merchant_id) = user already received bonus for this merchant
CREATE TABLE IF NOT EXISTS user_verified_merchant_bonus (
  username TEXT NOT NULL,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (username, merchant_id)
);

CREATE INDEX IF NOT EXISTS idx_user_verified_merchant_bonus_username ON user_verified_merchant_bonus(username);
CREATE INDEX IF NOT EXISTS idx_user_verified_merchant_bonus_merchant ON user_verified_merchant_bonus(merchant_id);
