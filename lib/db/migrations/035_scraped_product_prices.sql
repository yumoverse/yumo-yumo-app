-- Migration 035: scraped_product_prices
--
-- Amac: Web scraper'lardan toplanan guncel market fiyatlarini saklamak.
--
CREATE TABLE IF NOT EXISTS scraped_product_prices (
  id                      SERIAL PRIMARY KEY,
  merchant_canonical_name TEXT NOT NULL,
  raw_name                TEXT NOT NULL,
  canonical_name          TEXT,
  price_tl                NUMERIC NOT NULL CHECK (price_tl >= 0),
  unit                    TEXT,
  url                     TEXT,
  scraped_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scraped_product_prices_lookup
  ON scraped_product_prices (canonical_name, merchant_canonical_name, scraped_at DESC);

CREATE OR REPLACE VIEW v_basket_price_comparison AS
SELECT DISTINCT ON (canonical_name, merchant_canonical_name)
    canonical_name,
    merchant_canonical_name,
    price_tl,
    unit,
    raw_name,
    scraped_at
FROM scraped_product_prices
WHERE canonical_name IS NOT NULL
ORDER BY canonical_name, merchant_canonical_name, scraped_at DESC;

COMMENT ON TABLE scraped_product_prices IS 'Web scraperlar tarafindan toplanan guncel market ve restoran fiyatlari';
COMMENT ON VIEW v_basket_price_comparison IS 'Her bir (canonical_name, merchant) cifti icin en guncel kazinmis fiyati doner';
