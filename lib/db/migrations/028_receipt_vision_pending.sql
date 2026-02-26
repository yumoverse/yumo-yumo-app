-- Migration: receipt_vision_pending table (no FK).
-- Analyze persists Vision JSON here before receipt exists; vision-json API reads from it.
-- Neon SQL Editor'da bu dosyanın içeriğini çalıştırın.

CREATE TABLE IF NOT EXISTS public.receipt_vision_pending (
  receipt_id TEXT PRIMARY KEY,
  vision_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.receipt_vision_pending IS 'Vision JSON stored at analyze time (before receipt saved). No FK so insert works before receipt exists.';
