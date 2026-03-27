-- Migration 038: Receipts — structured address components (İl/İlçe/Mahalle/Sokak)
-- Adds merchant_city, merchant_district, merchant_neighborhood, merchant_street
-- and backfills from receipt_data JSONB (both Gemini and GPT paths).

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS merchant_city         text,
  ADD COLUMN IF NOT EXISTS merchant_district     text,
  ADD COLUMN IF NOT EXISTS merchant_neighborhood text,
  ADD COLUMN IF NOT EXISTS merchant_street       text;

-- Backfill: prefer top-level JSONB keys (Gemini path), fallback to gptFullReceiptResult
UPDATE receipts
SET
  merchant_city = COALESCE(
    merchant_city,
    receipt_data->>'addressCity',
    receipt_data->'gptFullReceiptResult'->>'addressCity'
  ),
  merchant_district = COALESCE(
    merchant_district,
    receipt_data->>'addressDistrict',
    receipt_data->'gptFullReceiptResult'->>'addressDistrict'
  ),
  merchant_neighborhood = COALESCE(
    merchant_neighborhood,
    receipt_data->>'addressNeighborhood',
    receipt_data->'gptFullReceiptResult'->>'addressNeighborhood'
  ),
  merchant_street = COALESCE(
    merchant_street,
    receipt_data->>'addressStreet',
    receipt_data->'gptFullReceiptResult'->>'addressStreet'
  )
WHERE receipt_data IS NOT NULL;

-- Indexes for filtering/grouping by city/district
CREATE INDEX IF NOT EXISTS idx_receipts_merchant_city
  ON receipts (merchant_city)
  WHERE merchant_city IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_receipts_merchant_district
  ON receipts (merchant_district)
  WHERE merchant_district IS NOT NULL;
