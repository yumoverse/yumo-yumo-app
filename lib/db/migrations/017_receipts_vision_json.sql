-- Vision JSON in receipts table (no dependency on receipt_vision_raw).
-- API reads from receipts.vision_json so 503 "table not available" never happens.
-- Run once: npx tsx scripts/run-migration.ts 017_receipts_vision_json.sql

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS vision_json JSONB;
