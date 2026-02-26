-- Migration 032: canonical_product_taxonomy — ürün bazlı maliyet taksonomi tablosu
--
-- Amaç: Her canonical ürün adı için ürüne özgü maliyet bileşen ağırlıklarını saklar.
-- Bu tablo production_cost_weights (kategori bazlı) tablosunun ürün düzeyinde karşılığıdır.
-- Yüksek öncelikli: line-hidden-cost.ts bu tabloyu önce sorgular, bulamazsa kategori ağırlıklarına döner.
--
-- Kaynak: Manus AI İkinci Çalışma (19 Şubat 2026)
--   task1_turkey_cost_composition.pdf — Türkiye'ye özgü kategori ağırlıkları
--   task5_turkey_retail_data.pdf — TCMB Ekonomi Notları, TÜİK Girdi-Çıktı
--
-- tuik_series_code: TÜİK MEDAS sistemi seri kodu (D1000005xxx formatı).
--   Mevcut economic_indices serileri ("10", "ARM" vb.) ile mapping için
--   bkz. lib/mining/costCompositionConfig.ts
--
-- labor_type:
--   'manufacturing' — Fabrika/üretim işgücü (gıda, içecek, tekstil vb.)
--   'service'       — Hizmet işgücü (kafe, restoran, konaklama)
--   Bu ayrım service kategorilerde PPI C (imalat) yerine CPI 11 (lokanta) endeksi kullanımını mümkün kılar.

CREATE TABLE IF NOT EXISTS canonical_product_taxonomy (
  id               SERIAL PRIMARY KEY,
  -- Normalize edilmiş canonical ürün adı (küçük harf, Türkçe karakter ASCII)
  canonical_name   TEXT NOT NULL,
  -- Internal hidden category kodu (costCompositionConfig ile uyumlu)
  category_lvl1    TEXT NOT NULL,
  -- Alt kategori (dairy, meat, vegetables, bakery, beverages, hot_drinks, fast_food, vb.)
  category_lvl2    TEXT,
  -- TÜİK MEDAS sistemindeki seri kodu (D1000005xxx)
  -- 'NOT_FOUND' = hizmet ürünleri için PPI serisi bulunmuyor
  tuik_series_code TEXT,
  -- Maliyet bileşen ağırlıkları (%0–100, toplam = 100)
  raw_material_pct NUMERIC NOT NULL CHECK (raw_material_pct >= 0 AND raw_material_pct <= 100),
  labor_pct        NUMERIC NOT NULL CHECK (labor_pct >= 0 AND labor_pct <= 100),
  rent_pct         NUMERIC NOT NULL CHECK (rent_pct >= 0 AND rent_pct <= 100),
  energy_pct       NUMERIC NOT NULL CHECK (energy_pct >= 0 AND energy_pct <= 100),
  other_pct        NUMERIC NOT NULL CHECK (other_pct >= 0 AND other_pct <= 100),
  -- Temel kontrol: toplam ≈ 100
  CONSTRAINT pct_sum_check CHECK (
    ABS(raw_material_pct + labor_pct + rent_pct + energy_pct + other_pct - 100) < 1
  ),
  -- İşgücü türü: endeks seçiminde kullanılır
  labor_type       TEXT NOT NULL DEFAULT 'manufacturing'
    CHECK (labor_type IN ('manufacturing', 'service')),
  -- Perakende kar marjı (%): profit_margin_factor = 1 + profit_margin/100
  profit_margin    NUMERIC NOT NULL DEFAULT 20.0 CHECK (profit_margin >= 0),
  -- Veri kaynağı
  source           TEXT DEFAULT 'MANUS_TASK1_TR_2026_02',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now(),

  UNIQUE (canonical_name)
);

COMMENT ON TABLE canonical_product_taxonomy IS
  'Ürün bazlı maliyet bileşen ağırlıkları. '
  'line-hidden-cost.ts içinde production_cost_weights (kategori bazlı) tablosundan önce sorgulanır. '
  'Kaynak: Manus AI Türkiye Cost Composition Araştırması, 19 Şubat 2026.';

COMMENT ON COLUMN canonical_product_taxonomy.labor_type IS
  '"manufacturing": Gıda/tekstil üretim işgücü → PPI C (imalat ÜFE) endeksi. '
  '"service": Kafe/restoran servis işgücü → CPI 11 (lokanta/konaklama TÜFE) endeksi.';

COMMENT ON COLUMN canonical_product_taxonomy.profit_margin IS
  'Perakende satış fiyatındaki kar marjı yüzdesi. '
  'profit_margin_factor = 1 + profit_margin / 100 '
  '(ör. %20 → factor 1.20, ReferencePrice = PaidPrice / 1.20)';

CREATE INDEX IF NOT EXISTS idx_canonical_taxonomy_name
  ON canonical_product_taxonomy(canonical_name);

CREATE INDEX IF NOT EXISTS idx_canonical_taxonomy_cat
  ON canonical_product_taxonomy(category_lvl1, category_lvl2);

-- ──────────────────────────────────────────────────────────────────────────────
-- Veri: taxonomy_insert.sql içeriği (Manus Task 1 TR, 19 Şubat 2026)
-- Düzeltmeler:
--   - Meyve/sebze karışıklığı düzeltildi: elma, muz, portakal, limon, üzüm → 'fruits'
--   - Tüm canonical_name değerleri küçük harf normalize edildi
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO canonical_product_taxonomy
  (canonical_name, category_lvl1, category_lvl2, tuik_series_code,
   raw_material_pct, labor_pct, rent_pct, energy_pct, other_pct,
   labor_type, profit_margin)
VALUES

-- ── Süt Ürünleri ────────────────────────────────────────────────────────────
-- Kaynak: TÜİK Tarımsal ÜFE Ocak 2026, TCMB Ekonomi Notları 2024-17
('süt',          'groceries_fmcg', 'dairy',     'D1000005631', 48, 20, 12, 6, 14, 'manufacturing', 20),
('yoğurt',       'groceries_fmcg', 'dairy',     'D1000005633', 50, 22, 10, 6, 12, 'manufacturing', 20),
('peynir',       'groceries_fmcg', 'dairy',     'D1000005634', 52, 20, 10, 6, 12, 'manufacturing', 20),
('ayran',        'groceries_fmcg', 'dairy',     'D1000005635', 48, 22, 10, 6, 14, 'manufacturing', 20),
('tereyağ',      'groceries_fmcg', 'dairy',     'D1000005636', 55, 18, 10, 7, 10, 'manufacturing', 20),
('kaymak',       'groceries_fmcg', 'dairy',     'D1000005637', 52, 20, 10, 6, 12, 'manufacturing', 20),
('kefir',        'groceries_fmcg', 'dairy',     'D1000005638', 48, 23, 10, 6, 13, 'manufacturing', 20),
('beyaz peynir', 'groceries_fmcg', 'dairy',     'D1000005639', 54, 19, 10, 6, 11, 'manufacturing', 20),

-- ── Et ve Protein ────────────────────────────────────────────────────────────
-- Kaynak: TÜİK Tarımsal ÜFE Ocak 2026, TCMB Fiyat Gelişmeleri Ocak 2026
-- Not: Hammadde payı çok yüksek — işlenmemiş et için tipik (TCMB doğruladı)
('tavuk göğsü',  'groceries_fmcg', 'meat',      'D1000005701', 75, 8,  3, 3, 11, 'manufacturing', 20),
('kıyma',        'groceries_fmcg', 'meat',      'D1000005702', 78, 7,  2, 2, 11, 'manufacturing', 20),
('balık',        'groceries_fmcg', 'meat',      'D1000005703', 80, 6,  2, 2, 10, 'manufacturing', 20),
('sosis',        'groceries_fmcg', 'meat',      'D1000005704', 65, 15, 5, 4, 11, 'manufacturing', 20),
('pastırma',     'groceries_fmcg', 'meat',      'D1000005705', 70, 12, 5, 4,  9, 'manufacturing', 20),
('sucuk',        'groceries_fmcg', 'meat',      'D1000005706', 68, 13, 5, 4, 10, 'manufacturing', 20),
('tavuk eti',    'groceries_fmcg', 'meat',      'D1000005707', 76, 8,  3, 3, 10, 'manufacturing', 20),
('kırmızı et',   'groceries_fmcg', 'meat',      'D1000005708', 77, 7,  3, 2, 11, 'manufacturing', 20),

-- ── Sebzeler ─────────────────────────────────────────────────────────────────
-- Kaynak: TÜİK Tarımsal ÜFE Ocak 2026 (Sebze %43.58 yıllık artış)
-- Taze ürün: hammadde payı >%75, işgücü minimal
('domates',      'groceries_fmcg', 'vegetables','D1000005481', 80, 5,  3, 2, 10, 'manufacturing', 20),
('patates',      'groceries_fmcg', 'vegetables','D1000005482', 78, 6,  3, 2, 11, 'manufacturing', 20),
('soğan',        'groceries_fmcg', 'vegetables','D1000005483', 80, 5,  2, 2, 11, 'manufacturing', 20),
('salatalık',    'groceries_fmcg', 'vegetables','D1000005484', 82, 4,  2, 2, 10, 'manufacturing', 20),
('biber',        'groceries_fmcg', 'vegetables','D1000005485', 80, 5,  3, 2, 10, 'manufacturing', 20),

-- ── Meyveler (düzeltildi: category_lvl2 = 'fruits') ─────────────────────────
('elma',         'groceries_fmcg', 'fruits',    'D1000005486', 78, 6,  3, 3, 10, 'manufacturing', 20),
('muz',          'groceries_fmcg', 'fruits',    'D1000005487', 75, 7,  4, 4, 10, 'manufacturing', 20),
('portakal',     'groceries_fmcg', 'fruits',    'D1000005488', 76, 6,  4, 4, 10, 'manufacturing', 20),
('limon',        'groceries_fmcg', 'fruits',    'D1000005489', 76, 6,  4, 4, 10, 'manufacturing', 20),
('üzüm',         'groceries_fmcg', 'fruits',    'D1000005490', 74, 7,  4, 4, 11, 'manufacturing', 20),

-- ── Fırın ve Tahıl ───────────────────────────────────────────────────────────
-- Kaynak: TÜİK Tarımsal ÜFE Ocak 2026, TÜİK Yıllık Sanayi İstatistikleri 2024
-- Ekmek: İşgücü payı yüksek (fırıncılık emek yoğun)
('ekmek',        'groceries_fmcg', 'bakery',    'D1000005801', 50, 25, 12, 7,  6, 'manufacturing', 20),
('simit',        'groceries_fmcg', 'bakery',    'D1000005802', 48, 26, 12, 8,  6, 'manufacturing', 20),
('poğaça',       'groceries_fmcg', 'bakery',    'D1000005803', 52, 24, 10, 6,  8, 'manufacturing', 20),
('pasta',        'groceries_fmcg', 'bakery',    'D1000005804', 55, 15,  8, 6, 16, 'manufacturing', 20),
('pirinç',       'groceries_fmcg', 'bakery',    'D1000005805', 70,  8,  5, 4, 13, 'manufacturing', 20),
('un',           'groceries_fmcg', 'bakery',    'D1000005806', 65, 12,  8, 5, 10, 'manufacturing', 20),
('makarna',      'groceries_fmcg', 'bakery',    'D1000005807', 58, 18,  8, 6, 10, 'manufacturing', 20),
('mısır unu',    'groceries_fmcg', 'bakery',    'D1000005808', 68, 10,  6, 5, 11, 'manufacturing', 20),

-- ── İçecekler ────────────────────────────────────────────────────────────────
-- Kaynak: TÜİK Tarımsal ÜFE + Yıllık Sanayi İstatistikleri 2024
('çay',          'groceries_fmcg', 'beverages', 'D1000005901', 45, 18, 10, 8, 19, 'manufacturing', 20),
('kahve',        'groceries_fmcg', 'beverages', 'D1000005902', 50, 16, 10, 8, 16, 'manufacturing', 20),
('kola',         'groceries_fmcg', 'beverages', 'D1000005903', 35, 20, 12,10, 23, 'manufacturing', 20),
('su',           'groceries_fmcg', 'beverages', 'D1000005904', 25, 22, 15,12, 26, 'manufacturing', 20),
('portakal suyu','groceries_fmcg', 'beverages', 'D1000005905', 48, 18, 10, 8, 16, 'manufacturing', 20),
('maden suyu',   'groceries_fmcg', 'beverages', 'D1000005906', 28, 20, 14,12, 26, 'manufacturing', 20),
('gazoz',        'groceries_fmcg', 'beverages', 'D1000005907', 32, 21, 13,11, 23, 'manufacturing', 20),
('enerji içeceği','groceries_fmcg','beverages', 'D1000005908', 40, 19, 11, 9, 21, 'manufacturing', 20),

-- ── Temel Gıda ───────────────────────────────────────────────────────────────
('yağ',          'groceries_fmcg', 'oils',      'D1000005601', 72,  8,  5, 5, 10, 'manufacturing', 20),
('tuz',          'groceries_fmcg', 'condiments','D1000005602', 60, 12,  8, 6, 14, 'manufacturing', 20),
('şeker',        'groceries_fmcg', 'condiments','D1000005603', 65, 10,  8, 6, 11, 'manufacturing', 20),
('bal',          'groceries_fmcg', 'condiments','D1000005604', 70,  8,  6, 4, 12, 'manufacturing', 20),
('zeytin',       'groceries_fmcg', 'condiments','D1000005605', 75,  6,  5, 3, 11, 'manufacturing', 20),

-- ── Kafe & Fast Food (labor_type = 'service') ────────────────────────────────
-- Kaynak: TCMB Ekonomi Notları 2024-17 (Yiyecek Hizmetleri Sektörü)
-- Service ürünleri: hammadde düşük, işgücü+kira yüksek
-- tuik_series_code = 'NOT_FOUND': Hizmet sektörü PPI kapsamında değil
('latte',        'food_delivery',  'hot_drinks','NOT_FOUND',   25, 35, 20,10, 10, 'service', 20),
('cappuccino',   'food_delivery',  'hot_drinks','NOT_FOUND',   26, 34, 20,10, 10, 'service', 20),
('americano',    'food_delivery',  'hot_drinks','NOT_FOUND',   22, 36, 20,10, 12, 'service', 20),
('hamburger',    'food_delivery',  'fast_food', 'NOT_FOUND',   30, 32, 18,10, 10, 'service', 20),
('döner',        'food_delivery',  'fast_food', 'NOT_FOUND',   35, 30, 15, 8, 12, 'service', 20)

ON CONFLICT (canonical_name) DO UPDATE SET
  category_lvl1    = EXCLUDED.category_lvl1,
  category_lvl2    = EXCLUDED.category_lvl2,
  tuik_series_code = EXCLUDED.tuik_series_code,
  raw_material_pct = EXCLUDED.raw_material_pct,
  labor_pct        = EXCLUDED.labor_pct,
  rent_pct         = EXCLUDED.rent_pct,
  energy_pct       = EXCLUDED.energy_pct,
  other_pct        = EXCLUDED.other_pct,
  labor_type       = EXCLUDED.labor_type,
  profit_margin    = EXCLUDED.profit_margin,
  source           = EXCLUDED.source,
  updated_at       = now();
