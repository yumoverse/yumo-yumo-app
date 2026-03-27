-- Migration 036: scraped_product_prices store-level columns and per-store latest view
--
-- Adds store_id / store_name / store_lat / store_lng so that we can
-- compute basket totals per branch ("en yakın market" deneyimi için temel).

ALTER TABLE scraped_product_prices
  ADD COLUMN IF NOT EXISTS store_id   TEXT,
  ADD COLUMN IF NOT EXISTS store_name TEXT,
  ADD COLUMN IF NOT EXISTS store_lat  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS store_lng  DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_scraped_store_lookup
  ON scraped_product_prices (store_id, canonical_name, merchant_canonical_name, scraped_at DESC);

-- Latest price per (store, merchant, canonical_name)
CREATE OR REPLACE VIEW v_scraped_store_latest AS
SELECT DISTINCT ON (store_id, merchant_canonical_name, canonical_name)
  id,
  store_id,
  store_name,
  merchant_canonical_name,
  canonical_name,
  raw_name,
  price_tl,
  unit,
  scraped_at
FROM scraped_product_prices
WHERE canonical_name IS NOT NULL
ORDER BY store_id, merchant_canonical_name, canonical_name, scraped_at DESC;

COMMENT ON VIEW v_scraped_store_latest IS
  ''Her bir (store_id, merchant_canonical_name, canonical_name) çifti için en güncel fiyat'';
