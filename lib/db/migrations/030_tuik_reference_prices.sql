-- Migration 030: TÜİK ortalama perakende fiyat referans tablosu
-- TÜİK her ay ~428 ürün için ortalama perakende fiyatı yayınlar.
-- Kaynak: veriportali.tuik.gov.tr — "Tüketici Fiyat Endeksi Seçilmiş Maddelere Ait Ortalama Fiyatlar"
-- Import script: scripts/import-tuik-avg-prices.ts

CREATE TABLE IF NOT EXISTS tuik_reference_prices (
  id              SERIAL PRIMARY KEY,
  -- TÜİK'in orijinal ürün adı (Türkçe)
  tuik_name       TEXT NOT NULL,
  -- Canonical eşleştirme için normalize edilmiş ad (küçük harf, Türkçe karakter normalize)
  canonical_key   TEXT NOT NULL,
  -- Ölçü birimi: kg, adet, litre, paket, vb.
  unit            TEXT NOT NULL DEFAULT 'adet',
  -- Ay: "2026-01" formatı
  year_month      TEXT NOT NULL,
  -- TL cinsinden ortalama perakende fiyat
  avg_price_tl    NUMERIC NOT NULL CHECK (avg_price_tl >= 0),
  -- COICOP alt grup kodu (ör. "0111" = Tahıllar)
  coicop_code     TEXT,
  -- TÜİK kategori ana grubu (ör. "Gıda ve Alkolsüz İçecekler")
  category_tr     TEXT,
  -- Veri kaynağı: "TURKSTAT_AVG_PRICES_CSV" veya "MANUAL_SEED"
  source          TEXT DEFAULT 'TURKSTAT_AVG_PRICES_CSV',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  UNIQUE (canonical_key, year_month)
);

COMMENT ON TABLE tuik_reference_prices IS
  'TÜİK TÜFE ortalama fiyat serisi — aylık ürün bazlı referans fiyatlar. '
  'ReferencePrice = tuik_reference_prices.avg_price_tl × quantity. '
  'Kaynak: veriportali.tuik.gov.tr (Ocak 2026 itibarıyla 428 ürün, aylık Excel)';

COMMENT ON COLUMN tuik_reference_prices.canonical_key IS
  'Normalize edilmiş anahtar: küçük harf, boşluk yerine _, Türkçe karakter ASCII. '
  'Örn: "beyaz_ekmek_400g", "tam_yag_sut_1lt", "tavuk_but_kg"';
COMMENT ON COLUMN tuik_reference_prices.avg_price_tl IS
  'TÜİK tarafından yayınlanan o ay için Türkiye geneli ortalama perakende fiyatı (TL)';

CREATE INDEX IF NOT EXISTS idx_tuik_ref_canonical_month
  ON tuik_reference_prices(canonical_key, year_month);

CREATE INDEX IF NOT EXISTS idx_tuik_ref_month
  ON tuik_reference_prices(year_month DESC);

-- ──────────────────────────────────────────────────────────────────────────────
-- Seed: Ocak 2026 temel ürünler (TÜİK kaynaklı başlangıç verisi)
-- Kaynak: TÜİK CPI Ortalama Fiyatlar Tablosu, Ocak 2026 (Şubat 3, 2026)
-- URL: https://veriportali.tuik.gov.tr/en/press/58293
-- NOT: Gerçek değerler için scripts/import-tuik-avg-prices.ts çalıştırılmalıdır.
-- Aşağıdakiler ETL test ve referans değerleri içindir.
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO tuik_reference_prices
  (tuik_name, canonical_key, unit, year_month, avg_price_tl, coicop_code, category_tr, source)
VALUES
  -- Tahıllar ve Ekmek
  ('Beyaz Ekmek (400 g)',          'beyaz_ekmek_400g',     'adet',  '2026-01', 20.50,  '01113', 'Gıda',    'MANUAL_SEED'),
  ('Tam Buğday Ekmeği (400 g)',    'tam_bugday_ekmek_400g','adet',  '2026-01', 24.00,  '01113', 'Gıda',    'MANUAL_SEED'),
  ('Makarna (500 g)',              'makarna_500g',          'adet',  '2026-01', 32.00,  '01115', 'Gıda',    'MANUAL_SEED'),
  ('Pirinç (kg)',                  'pirinc_kg',             'kg',    '2026-01', 75.00,  '01116', 'Gıda',    'MANUAL_SEED'),
  ('Un (kg)',                      'un_kg',                 'kg',    '2026-01', 28.00,  '01112', 'Gıda',    'MANUAL_SEED'),

  -- Et ve Tavuk
  ('Kıyma (kg)',                   'kiyma_kg',              'kg',    '2026-01', 520.00, '01121', 'Gıda',    'MANUAL_SEED'),
  ('Tavuk But (kg)',               'tavuk_but_kg',          'kg',    '2026-01', 185.00, '01122', 'Gıda',    'MANUAL_SEED'),
  ('Tavuk Göğüs (kg)',             'tavuk_gogus_kg',        'kg',    '2026-01', 210.00, '01122', 'Gıda',    'MANUAL_SEED'),
  ('Kuzu Et (kg)',                 'kuzu_et_kg',            'kg',    '2026-01', 680.00, '01123', 'Gıda',    'MANUAL_SEED'),

  -- Süt ve Süt Ürünleri
  ('Tam Yağlı Süt (1 lt)',         'tam_yag_sut_1lt',       'litre', '2026-01', 38.00,  '01141', 'Gıda',    'MANUAL_SEED'),
  ('Beyaz Peynir (kg)',            'beyaz_peynir_kg',       'kg',    '2026-01', 380.00, '01143', 'Gıda',    'MANUAL_SEED'),
  ('Kaşar Peynir (kg)',            'kasar_peynir_kg',       'kg',    '2026-01', 450.00, '01143', 'Gıda',    'MANUAL_SEED'),
  ('Yoğurt (kg)',                  'yogurt_kg',             'kg',    '2026-01', 85.00,  '01144', 'Gıda',    'MANUAL_SEED'),
  ('Tereyağı (250 g)',             'tereyag_250g',          'adet',  '2026-01', 145.00, '01145', 'Gıda',    'MANUAL_SEED'),
  ('Yumurta (10 adet)',            'yumurta_10_adet',       'paket', '2026-01', 90.00,  '01147', 'Gıda',    'MANUAL_SEED'),

  -- Yağlar
  ('Ayçiçek Yağı (1 lt)',          'aycicek_yag_1lt',       'litre', '2026-01', 105.00, '01151', 'Gıda',    'MANUAL_SEED'),
  ('Zeytinyağı (1 lt)',            'zeytinyag_1lt',          'litre', '2026-01', 420.00, '01151', 'Gıda',    'MANUAL_SEED'),

  -- Sebzeler
  ('Domates (kg)',                 'domates_kg',            'kg',    '2026-01', 42.00,  '01163', 'Gıda',    'MANUAL_SEED'),
  ('Salatalık (kg)',               'salatalik_kg',          'kg',    '2026-01', 38.00,  '01163', 'Gıda',    'MANUAL_SEED'),
  ('Patates (kg)',                 'patates_kg',            'kg',    '2026-01', 35.00,  '01162', 'Gıda',    'MANUAL_SEED'),
  ('Soğan (kg)',                   'sogan_kg',              'kg',    '2026-01', 28.00,  '01162', 'Gıda',    'MANUAL_SEED'),
  ('Biber (kg)',                   'biber_kg',              'kg',    '2026-01', 65.00,  '01163', 'Gıda',    'MANUAL_SEED'),
  ('Patlıcan (kg)',                'patlican_kg',           'kg',    '2026-01', 48.00,  '01163', 'Gıda',    'MANUAL_SEED'),

  -- Meyveler
  ('Elma (kg)',                    'elma_kg',               'kg',    '2026-01', 55.00,  '01171', 'Gıda',    'MANUAL_SEED'),
  ('Portakal (kg)',                'portakal_kg',           'kg',    '2026-01', 48.00,  '01172', 'Gıda',    'MANUAL_SEED'),
  ('Muz (kg)',                     'muz_kg',                'kg',    '2026-01', 75.00,  '01172', 'Gıda',    'MANUAL_SEED'),
  ('Mandalina (kg)',               'mandalina_kg',          'kg',    '2026-01', 52.00,  '01172', 'Gıda',    'MANUAL_SEED'),

  -- İçecekler
  ('Çay (500 g)',                  'cay_500g',              'adet',  '2026-01', 185.00, '01211', 'Gıda',    'MANUAL_SEED'),
  ('Nescafe / Filtre Kahve (200 g)','kahve_200g',           'adet',  '2026-01', 320.00, '01211', 'Gıda',    'MANUAL_SEED'),
  ('Su (1.5 lt)',                  'su_15lt',               'litre', '2026-01', 12.00,  '01221', 'Gıda',    'MANUAL_SEED'),
  ('Kola / Gazlı İçecek (1 lt)',   'gazli_icecek_1lt',      'litre', '2026-01', 65.00,  '01221', 'Gıda',    'MANUAL_SEED')

ON CONFLICT (canonical_key, year_month) DO UPDATE SET
  avg_price_tl = EXCLUDED.avg_price_tl,
  tuik_name    = EXCLUDED.tuik_name,
  source       = EXCLUDED.source,
  updated_at   = now();
