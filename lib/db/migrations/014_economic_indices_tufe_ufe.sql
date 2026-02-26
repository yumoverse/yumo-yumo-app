-- Add series column and PPI type for TÜFE/ÜFE category-level indices
-- series: '' = legacy aggregate (CPI, FUEL, etc.), non-empty = category/series code (e.g. '01', 'GENEL', 'ARM')

ALTER TABLE economic_indices
  ADD COLUMN IF NOT EXISTS series VARCHAR(120) NOT NULL DEFAULT '';

-- Backfill existing rows to have series = '' (already default)
UPDATE economic_indices SET series = '' WHERE series IS NULL OR series = '';

-- Allow PPI (ÜFE) in index_type
ALTER TABLE economic_indices DROP CONSTRAINT IF EXISTS economic_indices_index_type_check;
ALTER TABLE economic_indices ADD CONSTRAINT economic_indices_index_type_check
  CHECK (index_type IN ('CPI', 'FUEL', 'LABOR', 'RENT', 'DIGITAL', 'PPI'));

-- New unique key: (country, index_type, series, year_month)
ALTER TABLE economic_indices DROP CONSTRAINT IF EXISTS economic_indices_country_index_type_year_month_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_economic_indices_country_type_series_month
  ON economic_indices (country, index_type, series, year_month);

-- Lookup index for category/series queries
CREATE INDEX IF NOT EXISTS idx_economic_indices_series_lookup
  ON economic_indices (country, index_type, series, year_month DESC);

COMMENT ON COLUMN economic_indices.series IS 'Series/category code: empty for aggregate, e.g. 01=Gıda TÜFE, ARM=ÜFE Ara Malı, GENEL=genel TÜFE';
