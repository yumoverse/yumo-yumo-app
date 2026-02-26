-- Migration: Fallback storage for receipt images when Vercel Blob times out
-- Run with: npx tsx scripts/run-migration.ts 012_receipt_upload_fallback.sql
-- Description: When Blob put() exceeds 8s, we store the image here; analyze loads from this table.

CREATE TABLE IF NOT EXISTS receipt_upload_fallback (
  receipt_id UUID PRIMARY KEY,
  image_data BYTEA NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_receipt_upload_fallback_created_at
  ON receipt_upload_fallback(created_at);

COMMENT ON TABLE receipt_upload_fallback IS
  'Temporary storage for receipt image when Vercel Blob put() times out (8s). Deleted after analyze loads it.';
