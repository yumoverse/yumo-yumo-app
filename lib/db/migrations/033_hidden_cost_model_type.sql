-- Migration 033: Dual HiddenCost Mimarisi — production_cost_weights model_type eklenmesi
--
-- Amaç:
--   Her InternalHiddenCategory için iki farklı HiddenCost hesaplama modeli tanımlar:
--
--   producer_gap     — Tedarik Zinciri Marjı
--     "Bu ürünü üreticiden/fabrikadan alsaydın ne kadar daha az öderdin?"
--     Kategoriler: groceries_fmcg, apparel_fashion, electronics, beauty_personal_care, home_living
--     Formül: ReferencePrice = line_total / (PPI_weighted_cost_index × profit_margin_factor)
--     Veri kaynağı: HKS hal fiyatları, TÜİK ÜFE (sanayi/tarım), production_cost_weights
--
--   market_benchmark — Sektör Ortalaması Karşılaştırması
--     "Bu hizmet için sektör ortalaması X TL, sen Y TL ödedin."
--     Kategoriler: food_delivery (CPI-11), hospitality_lodging (CPI-11),
--                  travel_ticket (CPI-07), services_digital (CPI-08)
--     Formül: ReferencePrice = line_total / CPI_benchmark_index
--     Veri kaynağı: TÜİK TÜFE alt endeksleri (lokanta, ulaşım, bilgi-iletişim)
--
--   fallback         — Genel Ortalama (diğer kategoriler için)
--     Formül: ReferencePrice = line_total / avg(TÜFE_GENEL, ÜFE_C)
--     Kategori: other
--
-- Kaynak: Dual HiddenCost Mimarisi Tasarım Belgesi (19 Şubat 2026)

-- ── Kolon ekle ─────────────────────────────────────────────────────────────

ALTER TABLE production_cost_weights
  ADD COLUMN IF NOT EXISTS model_type VARCHAR(20) NOT NULL DEFAULT 'producer_gap'
    CHECK (model_type IN ('producer_gap', 'market_benchmark', 'fallback'));

COMMENT ON COLUMN production_cost_weights.model_type IS
  'HiddenCost hesaplama modeli. '
  '"producer_gap": Tedarik zinciri marjı (PPI bazlı). '
  '"market_benchmark": Sektör ortalaması karşılaştırması (CPI alt serisi bazlı). '
  '"fallback": Genel avg(TÜFE+ÜFE). Sadece "other" kategorisi kullanır.';

ALTER TABLE production_cost_weights
  ADD COLUMN IF NOT EXISTS benchmark_series VARCHAR(20);

COMMENT ON COLUMN production_cost_weights.benchmark_series IS
  'market_benchmark modeli için kullanılacak TÜİK TÜFE alt serisi kodu. '
  'Örnekler: "11" (lokanta/hazır yemek), "07" (ulaştırma), "08" (bilgi-iletişim). '
  'producer_gap ve fallback modelleri için NULL.';

-- ── producer_gap: fiziksel ürün kategorileri (PPI/maliyet bazlı) ───────────

UPDATE production_cost_weights
  SET model_type = 'producer_gap',
      benchmark_series = NULL
  WHERE category IN (
    'groceries_fmcg',
    'apparel_fashion',
    'electronics',
    'beauty_personal_care',
    'home_living'
  );

-- ── market_benchmark: hizmet kategorileri (TÜİK TÜFE alt serisi bazlı) ────

-- food_delivery + hospitality_lodging → CPI-11 (Lokanta ve Otel Hizmetleri)
-- Kaynak: TÜİK TÜFE "01.1 Dışarıda yenen yemek hizmetleri"
UPDATE production_cost_weights
  SET model_type = 'market_benchmark',
      benchmark_series = '11'
  WHERE category IN ('food_delivery', 'hospitality_lodging');

-- travel_ticket → CPI-07 (Ulaştırma)
-- Kaynak: TÜİK TÜFE "07 Ulaştırma" ana grubu
UPDATE production_cost_weights
  SET model_type = 'market_benchmark',
      benchmark_series = '07'
  WHERE category = 'travel_ticket';

-- services_digital → CPI-08 (Haberleşme / Bilgi-İletişim)
-- Kaynak: TÜİK TÜFE "08 Haberleşme"
UPDATE production_cost_weights
  SET model_type = 'market_benchmark',
      benchmark_series = '08'
  WHERE category = 'services_digital';

-- ── fallback: bilinmeyen kategoriler → avg(TÜFE GENEL + ÜFE C) ─────────────

UPDATE production_cost_weights
  SET model_type = 'fallback',
      benchmark_series = NULL
  WHERE category = 'other';

-- ── Doğrulama sorgusu (opsiyonel çalıştırma) ──────────────────────────────
-- SELECT country, category, model_type, benchmark_series
-- FROM production_cost_weights
-- ORDER BY country, model_type, category;
