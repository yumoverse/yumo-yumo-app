-- Migration 034: Add vkn (tax ID) column to merchants table.
-- VKN = 10-digit Turkish corporate tax number (Vergi Kimlik Numarası).
-- Unique per country to avoid collisions with non-TR merchants.

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS vkn VARCHAR(11);

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_vkn_country
  ON merchants(vkn, COALESCE(country_code, ''))
  WHERE vkn IS NOT NULL;

COMMENT ON COLUMN merchants.vkn IS 'TR: 10-digit Vergi Kimlik Numarası (VKN). Null for non-TR or unknown.';
