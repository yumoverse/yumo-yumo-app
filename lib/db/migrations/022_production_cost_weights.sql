-- Migration: production_cost_weights table for reference price (ÜretimMaliyeti × profit_margin)
-- Neon SQL Editor'da bu dosyanın içeriğini çalıştırın.
-- Used by canonical post-process for line-level reference + hidden cost.

CREATE TABLE IF NOT EXISTS production_cost_weights (
  id SERIAL PRIMARY KEY,
  country CHAR(2) NOT NULL,
  category VARCHAR(64) NOT NULL,
  raw_material_pct NUMERIC NOT NULL CHECK (raw_material_pct >= 0 AND raw_material_pct <= 1),
  labor_pct NUMERIC NOT NULL CHECK (labor_pct >= 0 AND labor_pct <= 1),
  rent_pct NUMERIC NOT NULL CHECK (rent_pct >= 0 AND rent_pct <= 1),
  energy_pct NUMERIC NOT NULL CHECK (energy_pct >= 0 AND energy_pct <= 1),
  other_pct NUMERIC NOT NULL CHECK (other_pct >= 0 AND other_pct <= 1),
  profit_margin_factor NUMERIC NOT NULL DEFAULT 1.20 CHECK (profit_margin_factor >= 1),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(country, category)
);

COMMENT ON TABLE production_cost_weights IS 'Category x country cost weights for ReferencePrice = ÜretimMaliyeti × profit_margin_factor';
COMMENT ON COLUMN production_cost_weights.category IS 'Internal category: groceries_fmcg, apparel_fashion, etc.';
COMMENT ON COLUMN production_cost_weights.profit_margin_factor IS 'TÜİK verilerinden hesaplanan referans kar marjı çarpanı (örn. 1.20 = %20). Kaynak: TÜİK.';

CREATE INDEX IF NOT EXISTS idx_production_cost_weights_country_category ON production_cost_weights(country, category);

-- Seed TR groceries (gıda). Kaynak: İç plan (dış rapor atanmamıştır). Ham %49, İşçilik %20, Kira %13, Enerji %5, Diğer %13.
-- Not: TCMB Enflasyon Raporu sektör bazlı maliyet payı içermez; bu değerler rapordan alınmamıştır.
INSERT INTO production_cost_weights (country, category, raw_material_pct, labor_pct, rent_pct, energy_pct, other_pct, profit_margin_factor)
VALUES
  ('TR', 'groceries_fmcg', 0.49, 0.20, 0.13, 0.05, 0.13, 1.20)
ON CONFLICT (country, category) DO UPDATE SET
  raw_material_pct = EXCLUDED.raw_material_pct,
  labor_pct = EXCLUDED.labor_pct,
  rent_pct = EXCLUDED.rent_pct,
  energy_pct = EXCLUDED.energy_pct,
  other_pct = EXCLUDED.other_pct,
  profit_margin_factor = EXCLUDED.profit_margin_factor,
  updated_at = now();

-- Aşağıdaki TR kategorileri KAYNAK BELİRTİLMEDEN placeholder olarak eklenmiştir.
-- Kaynak: Yok (TÜİK girdi-çıktı veya sektör çalışması atanana kadar kullanım dikkatle değerlendirilmeli).
-- TCMB Enflasyon Raporu bu tür sektör maliyet payları içermez.
INSERT INTO production_cost_weights (country, category, raw_material_pct, labor_pct, rent_pct, energy_pct, other_pct, profit_margin_factor)
VALUES
  ('TR', 'apparel_fashion', 0.35, 0.30, 0.15, 0.05, 0.15, 1.20),
  ('TR', 'electronics', 0.40, 0.15, 0.10, 0.05, 0.30, 1.20),
  ('TR', 'beauty_personal_care', 0.40, 0.25, 0.15, 0.05, 0.15, 1.20),
  ('TR', 'home_living', 0.45, 0.22, 0.13, 0.05, 0.15, 1.20),
  ('TR', 'travel_ticket', 0.20, 0.25, 0.10, 0.20, 0.25, 1.20),
  ('TR', 'food_delivery', 0.40, 0.28, 0.12, 0.05, 0.15, 1.20),
  ('TR', 'services_digital', 0.10, 0.30, 0.10, 0.10, 0.40, 1.20),
  ('TR', 'hospitality_lodging', 0.25, 0.35, 0.25, 0.05, 0.10, 1.20),
  ('TR', 'other', 0.33, 0.25, 0.15, 0.07, 0.20, 1.20)
ON CONFLICT (country, category) DO NOTHING;
