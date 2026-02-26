-- Migration: Add fraud detection hash columns (perceptual hash and content hash)
-- Run with: npx tsx scripts/run-migration.ts 003_add_fraud_hashes.sql
-- Or execute directly in Neon Console

-- Add image_phash column for perceptual hash (visual similarity detection)
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS image_phash VARCHAR(64);

-- Add content_hash column for content-based duplicate detection
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS content_hash VARCHAR(64);

-- Create index on image_phash for faster perceptual hash lookups
-- Note: NULL values are allowed (for existing receipts without perceptual hash)
CREATE INDEX IF NOT EXISTS idx_receipts_image_phash 
  ON receipts(image_phash)
  WHERE image_phash IS NOT NULL;

-- Create index on content_hash for faster content hash lookups
-- Note: NULL values are allowed (for existing receipts without content hash)
CREATE INDEX IF NOT EXISTS idx_receipts_content_hash 
  ON receipts(content_hash)
  WHERE content_hash IS NOT NULL;

-- Create composite index for recent receipts (last 90 days) with perceptual hash
-- This speeds up duplicate checks on recent receipts
CREATE INDEX IF NOT EXISTS idx_receipts_phash_recent 
  ON receipts(image_phash, created_at)
  WHERE image_phash IS NOT NULL AND created_at > NOW() - INTERVAL '90 days';

-- Create composite index for recent receipts (last 90 days) with content hash
CREATE INDEX IF NOT EXISTS idx_receipts_content_hash_recent 
  ON receipts(content_hash, created_at)
  WHERE content_hash IS NOT NULL AND created_at > NOW() - INTERVAL '90 days';
