-- Migration: Add receipt_hash column for duplicate detection
-- Run with: npx tsx scripts/run-migration.ts 002_add_receipt_hash.sql
-- Or execute directly in Neon Console

-- Add receipt_hash column to receipts table
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS receipt_hash VARCHAR(64); -- SHA-256 hash is 64 hex characters

-- Create unique index on receipt_hash for fast duplicate detection
-- Note: NULL values are allowed (for existing receipts without hash)
CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_hash_unique 
  ON receipts(receipt_hash) 
  WHERE receipt_hash IS NOT NULL;

-- Create regular index for faster lookups
CREATE INDEX IF NOT EXISTS idx_receipts_hash 
  ON receipts(receipt_hash);
