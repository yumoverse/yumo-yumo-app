-- Migration: receipt_vision_raw table only (for Vision JSON download in Evidence panel)
-- Run with: npx tsx scripts/run-migration.ts 016_receipt_vision_raw.sql
-- Requires: receipts table (from earlier migrations)

CREATE TABLE IF NOT EXISTS public.receipt_vision_raw (
  receipt_id TEXT PRIMARY KEY REFERENCES public.receipts(receipt_id) ON DELETE CASCADE,
  vision_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
