-- Migration: receipt_canonical table for Vision -> CanonicalPayload output
-- Neon SQL Editor'da bu dosyanın içeriğini çalıştırın.
-- Stores full canonical payload and total_hidden_canonical (sum of line-level hidden costs).

CREATE TABLE IF NOT EXISTS receipt_canonical (
  receipt_id TEXT PRIMARY KEY REFERENCES receipts(receipt_id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}',
  total_hidden_canonical NUMERIC,
  analyzed_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE receipt_canonical IS 'Canonical receipt payload from Vision; total_hidden_canonical = sum of line-level hidden costs';
COMMENT ON COLUMN receipt_canonical.payload IS 'CanonicalPayload JSON: merchant, observations[], date, currency, total_gross';
COMMENT ON COLUMN receipt_canonical.total_hidden_canonical IS 'Sum of hidden_cost_line from receipt_line_items; NULL until line-level calc runs';

CREATE INDEX IF NOT EXISTS idx_receipt_canonical_analyzed_at ON receipt_canonical(analyzed_at);
