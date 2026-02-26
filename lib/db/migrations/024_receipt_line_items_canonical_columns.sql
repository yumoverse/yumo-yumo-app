-- Migration: receipt_line_items canonical and hidden-cost columns
-- Neon SQL Editor'da bu dosyanın içeriğini çalıştırın.
-- Aligns with CanonicalPayload observations and line-level reference + hidden cost.

ALTER TABLE receipt_line_items
  ADD COLUMN IF NOT EXISTS reference_price NUMERIC,
  ADD COLUMN IF NOT EXISTS hidden_cost_line NUMERIC,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_price_gross NUMERIC,
  ADD COLUMN IF NOT EXISTS line_total_gross NUMERIC;

COMMENT ON COLUMN receipt_line_items.reference_price IS 'Line-level reference (ÜretimMaliyeti × profit_margin or fallback)';
COMMENT ON COLUMN receipt_line_items.hidden_cost_line IS 'line_total_gross - reference_price';
COMMENT ON COLUMN receipt_line_items.confidence_score IS 'From CanonicalPayload observation (0-1)';
COMMENT ON COLUMN receipt_line_items.unit_price_gross IS 'CanonicalPayload unit_price_gross (VAT-inclusive if applicable)';
COMMENT ON COLUMN receipt_line_items.line_total_gross IS 'CanonicalPayload line_total_gross';
