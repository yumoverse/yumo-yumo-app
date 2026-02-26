-- Migration 031: HKS (Hal Kayıt Sistemi) tarım ürünleri hal fiyatı tablosu
--
-- HKS, Tarım ve Orman Bakanlığı'nın tarım ürünleri hal piyasası fiyat sistemidir.
-- Hal fiyatları market rafına kıyasla 7-8 kat düşük olabiliyor.
-- Bu, "market perakende marjı" hesabı için en güçlü Türkiye verisini sunar.
--
-- Kaynak: hal.gov.tr — günlük ücretsiz erişim, Türkiye'nin tüm hal pazarları
-- Manus Task 4: "Araştırmalar hal fiyatlarından market rafına 7-8 kat fiyat farkı olduğunu göstermektedir"
-- Örnek (Şubat 2026): domates (Ayaş) 6.29 TL/kg, market: ~50 TL/kg
--
-- Kullanım amacı:
--   ReferencePrice (taze meyve/sebze) = hks_avg_price × (1 + retail_distribution_markup)
--   HiddenCost = PaidPrice - ReferencePrice
--   Retail markup: araştırma verisi %600-700 hal → market; ulaşım+depo+marj ort. %400

CREATE TABLE IF NOT EXISTS hks_hal_prices (
  id              SERIAL PRIMARY KEY,
  -- HKS ürün adı (Türkçe, çeşit dahil olabilir)
  hks_name        TEXT NOT NULL,
  -- Normalize edilmiş anahtar (tuik_reference_prices.canonical_key ile uyumlu format)
  canonical_key   TEXT NOT NULL,
  -- Ürün çeşidi (Ayaş, Golden, Deveci vb.) — NULL = genel
  variety         TEXT,
  -- Birim: kg, adet, bağ
  unit            TEXT NOT NULL DEFAULT 'kg',
  -- Gün: "2026-02-19" formatı (günlük güncellenen sistem)
  trade_date      DATE NOT NULL,
  -- O gün için en düşük hal fiyatı (TL)
  price_min_tl    NUMERIC CHECK (price_min_tl >= 0),
  -- En yüksek hal fiyatı (TL)
  price_max_tl    NUMERIC CHECK (price_max_tl >= 0),
  -- Ortalama hal fiyatı (TL) — referans fiyat hesabında kullanılan
  price_avg_tl    NUMERIC NOT NULL CHECK (price_avg_tl >= 0),
  -- Hal pazarı şehri (ör. "İstanbul", "Ankara")
  market_city     TEXT,
  -- Uygulanan perakende dağıtım çarpanı (hal → market)
  -- Araştırma: 7-8x hal fiyatı; konservatif %400 (4x) varsayımı
  retail_markup   NUMERIC DEFAULT 4.0,
  -- Veri kaynağı
  source          TEXT DEFAULT 'HKS_MANUAL',
  created_at      TIMESTAMPTZ DEFAULT now(),

  UNIQUE (canonical_key, variety, trade_date, market_city)
);

COMMENT ON TABLE hks_hal_prices IS
  'HKS Hal Kayıt Sistemi — Türkiye tarım ürünleri günlük hal piyasa fiyatları. '
  'ReferencePrice = price_avg_tl × retail_markup. '
  'Kaynak: hal.gov.tr (günlük, ücretsiz, 81 il hal pazarları)';

COMMENT ON COLUMN hks_hal_prices.retail_markup IS
  'Hal fiyatından market rafına dönüştürme çarpanı. '
  'Araştırma verisi: 7-8x (9 Köy 2025). '
  'Konservatif baz: 4x (nakliye + soğuk zincir + depo + market marjı). '
  'Ürün ve sezona göre değişir; Manus/TÜİK verileriyle kalibre edilmeli.';

CREATE INDEX IF NOT EXISTS idx_hks_canonical_date
  ON hks_hal_prices(canonical_key, trade_date DESC);

CREATE INDEX IF NOT EXISTS idx_hks_date
  ON hks_hal_prices(trade_date DESC);

-- ──────────────────────────────────────────────────────────────────────────────
-- Seed: Şubat 2026 örnek hal fiyatları
-- Kaynak: Manus Task 4 — HKS Şubat 2026 verileri + hal.gov.tr
-- NOT: ETL için scripts/import-hks-prices.ts hazırlanmalı
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO hks_hal_prices
  (hks_name, canonical_key, variety, unit, trade_date, price_min_tl, price_max_tl, price_avg_tl, market_city, retail_markup, source)
VALUES
  -- Manus Task 4 kaynaklı (Şubat 2026)
  ('Domates',    'domates_kg',    'Ayaş',    'kg', '2026-02-19',  5.50,  7.00,   6.29, 'Ankara',   5.0, 'MANUS_TASK4_HKS'),
  ('Armut',      'armut_kg',      'Deveci',  'kg', '2026-02-19', 55.00, 65.00,  59.92, 'Ankara',   3.5, 'MANUS_TASK4_HKS'),
  ('Çilek',      'cilek_kg',      NULL,      'kg', '2026-02-19',110.00,145.00, 127.82, 'Ankara',   3.0, 'MANUS_TASK4_HKS'),
  -- Ek tahminler (ort. hal fiyatları — kalibre edilmeli)
  ('Elma',       'elma_kg',       'Golden',  'kg', '2026-02-19', 18.00, 24.00,  21.00, 'İstanbul', 4.0, 'HKS_ESTIMATE'),
  ('Portakal',   'portakal_kg',   NULL,      'kg', '2026-02-19', 14.00, 20.00,  17.00, 'İstanbul', 4.0, 'HKS_ESTIMATE'),
  ('Muz',        'muz_kg',        NULL,      'kg', '2026-02-19', 22.00, 30.00,  26.00, 'İstanbul', 3.5, 'HKS_ESTIMATE'),
  ('Salatalık',  'salatalik_kg',  NULL,      'kg', '2026-02-19',  8.00, 12.00,  10.00, 'İstanbul', 4.5, 'HKS_ESTIMATE'),
  ('Patates',    'patates_kg',    NULL,      'kg', '2026-02-19',  8.00, 12.00,  10.00, 'İstanbul', 3.5, 'HKS_ESTIMATE'),
  ('Soğan',      'sogan_kg',      NULL,      'kg', '2026-02-19',  6.00,  9.00,   7.50, 'İstanbul', 4.0, 'HKS_ESTIMATE'),
  ('Biber',      'biber_kg',      NULL,      'kg', '2026-02-19', 12.00, 20.00,  16.00, 'İstanbul', 4.5, 'HKS_ESTIMATE'),
  ('Patlıcan',   'patlican_kg',   NULL,      'kg', '2026-02-19', 10.00, 16.00,  13.00, 'İstanbul', 4.0, 'HKS_ESTIMATE'),
  ('Mandalina',  'mandalina_kg',  NULL,      'kg', '2026-02-19', 15.00, 22.00,  18.50, 'İstanbul', 3.5, 'HKS_ESTIMATE')

ON CONFLICT (canonical_key, variety, trade_date, market_city) DO UPDATE SET
  price_avg_tl  = EXCLUDED.price_avg_tl,
  price_min_tl  = EXCLUDED.price_min_tl,
  price_max_tl  = EXCLUDED.price_max_tl,
  retail_markup = EXCLUDED.retail_markup,
  source        = EXCLUDED.source;

-- ──────────────────────────────────────────────────────────────────────────────
-- referans_fiyat VIEW: Fiş analizi için doğrudan kullanılabilir
-- HKS fiyatı × retail_markup = tahmini market referans fiyatı
-- ──────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW hks_reference_prices AS
SELECT
  canonical_key,
  hks_name,
  variety,
  unit,
  trade_date,
  price_avg_tl                             AS hal_price_tl,
  (price_avg_tl * retail_markup)::NUMERIC  AS estimated_retail_ref_tl,
  retail_markup,
  market_city,
  source
FROM hks_hal_prices;

COMMENT ON VIEW hks_reference_prices IS
  'HKS hal fiyatından türetilmiş tahmini market referans fiyatı. '
  'estimated_retail_ref_tl = hal_price × retail_markup. '
  'HiddenCost = market_paid_price - estimated_retail_ref_tl (negatif → 0)';
