-- Migration: Add extraction_time_value for daily expense duplicate detection
-- Run with: npx tsx scripts/run-migration.ts 006_add_extraction_time.sql
-- Or execute directly in Neon Console

-- Add extraction_time_value column (HH:MM or HH:MM:SS format)
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS extraction_time_value VARCHAR(10);
