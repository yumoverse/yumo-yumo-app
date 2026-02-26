-- Migration 025: production_cost_weights TR güncelleme
-- Kaynak: Manus AI İkinci Çalışma — Task 1 Türkiye Revizyonu + Task 5 Perakende Marj Analizi
-- Tarih: 19 Şubat 2026
--
-- Değişiklik notları:
--   - Tüm TR kategorileri Türkiye'ye özgü kaynaklarla güncellendi
--   - profit_margin_factor: BİM/Migros KAP verileri ve sektör raporlarından türetildi
--   - Metodoloji: perakende marjı hariç maliyet payları → üretim maliyeti normalize
--
-- Kaynaklar:
--   [1] TOBB Türkiye Gıda Sektörü Derleme Raporu 2024
--   [2] Perakende Mühendisi - Türkiye Gıda Perakende 2024-2025 Karlılık Analizi
--   [3] Rekabet Kurumu Gıda Perakende Nihai Raporu 2023
--   [4] T.C. Sanayi Bakanlığı Tekstil, Hazırgiyim ve Deri Sektörleri Raporu 2020
--   [5] Sakarya TSO Elektrik-Elektronik Sektör Raporu 2023
--   [6] İSO Küresel Beyaz Eşya ve Ev Aletleri Raporu
--   [7] T.C. Sanayi Bakanlığı Mobilya Sektör Raporu 2022
--   [8] TCMB Ekonomi Notları - Yiyecek Hizmetleri Fiyatlama (Atabek Demirhan & Bahça, Aralık 2024)
--   [9] Capital Magazine - Kârı Eriten Gider Oranı, Eylül 2025
--   [10] BİM KAP Finansal Sonuçları 2024 (Brüt marj %19.4, Net marj %4.24)
--   [11] Migros KAP Finansal Sonuçları 2024 (Net marj %2.3, FAVÖK %9.2)
--
-- profit_margin_factor hesaplama:
--   Brüt marj = (PaidPrice - COGS) / PaidPrice
--   profit_margin_factor = 1 / (1 - brüt_marj_oran)
--   Örn: Gıda brüt marj %19.4 → factor = 1/(1-0.194) = 1.24
--   Not: Bu faktör "üretim maliyetini perakende fiyatına çeviren" çarpandır.

-- ─────────────────────────────────────────────────────────────────────────────
-- Gıda/FMCG: BİM %19.4 brüt marj, Migros %22 (ort. ~%20-22)
-- Raw %50 (45-55), Labor %10 (8-12), Enerji %9 (8-10), Lojistik %6.5 (5-8), Ambalaj %4 (3-5)
-- Kira/overhead dahil → rent_pct = lojistik+genel giderler proxy
-- profit_margin_factor: 1/(1-0.20) = 1.25
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO production_cost_weights
  (country, category, raw_material_pct, labor_pct, rent_pct, energy_pct, other_pct, profit_margin_factor)
VALUES
  ('TR', 'groceries_fmcg', 0.50, 0.10, 0.065, 0.09, 0.04, 1.25)
ON CONFLICT (country, category) DO UPDATE SET
  raw_material_pct     = EXCLUDED.raw_material_pct,
  labor_pct            = EXCLUDED.labor_pct,
  rent_pct             = EXCLUDED.rent_pct,
  energy_pct           = EXCLUDED.energy_pct,
  other_pct            = EXCLUDED.other_pct,
  profit_margin_factor = EXCLUDED.profit_margin_factor,
  updated_at           = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- Giyim/Moda: T.C. Sanayi Bakanlığı + BİSEKTÖR 2022
-- Raw %40 (35-45), Labor %32.5 (30-35), Enerji %6.5 (5-8), Lojistik %7.5 (5-10), Ambalaj %3 (2-4)
-- Perakende marj %6.5 (3-10) ort. → kapsam dışı
-- profit_margin_factor: endüstri ort. ~%30-40 perakende marj → 1.40
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO production_cost_weights
  (country, category, raw_material_pct, labor_pct, rent_pct, energy_pct, other_pct, profit_margin_factor)
VALUES
  ('TR', 'apparel_fashion', 0.40, 0.33, 0.075, 0.065, 0.03, 1.40)
ON CONFLICT (country, category) DO UPDATE SET
  raw_material_pct     = EXCLUDED.raw_material_pct,
  labor_pct            = EXCLUDED.labor_pct,
  rent_pct             = EXCLUDED.rent_pct,
  energy_pct           = EXCLUDED.energy_pct,
  other_pct            = EXCLUDED.other_pct,
  profit_margin_factor = EXCLUDED.profit_margin_factor,
  updated_at           = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- Elektronik: SATSO 2023, İSO Beyaz Eşya Raporu
-- Raw %57.5 (50-65), Labor %5.5 (3-8), Enerji %6.5 (5-8), Lojistik %10 (8-12), Ambalaj %2.5 (2-3)
-- Perakende marj %12.5 (10-15) ort. → kapsam dışı
-- profit_margin_factor: 1/(1-0.125) = 1.14
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO production_cost_weights
  (country, category, raw_material_pct, labor_pct, rent_pct, energy_pct, other_pct, profit_margin_factor)
VALUES
  ('TR', 'electronics', 0.575, 0.055, 0.10, 0.065, 0.025, 1.14)
ON CONFLICT (country, category) DO UPDATE SET
  raw_material_pct     = EXCLUDED.raw_material_pct,
  labor_pct            = EXCLUDED.labor_pct,
  rent_pct             = EXCLUDED.rent_pct,
  energy_pct           = EXCLUDED.energy_pct,
  other_pct            = EXCLUDED.other_pct,
  profit_margin_factor = EXCLUDED.profit_margin_factor,
  updated_at           = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- Kozmetik/Kişisel Bakım: T.C. Ticaret Bakanlığı 2018 (güncel revizyon beklenmedik)
-- Raw %25 (20-30), Labor %7.5 (5-10), Ambalaj %7.5 (5-10), Enerji %6.5 (5-8), Lojistik %7.5 (5-10)
-- Yüksek perakende marj %35 (30-40) → kapsam dışı
-- profit_margin_factor: 1/(1-0.35) = 1.54
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO production_cost_weights
  (country, category, raw_material_pct, labor_pct, rent_pct, energy_pct, other_pct, profit_margin_factor)
VALUES
  ('TR', 'beauty_personal_care', 0.25, 0.075, 0.075, 0.065, 0.075, 1.54)
ON CONFLICT (country, category) DO UPDATE SET
  raw_material_pct     = EXCLUDED.raw_material_pct,
  labor_pct            = EXCLUDED.labor_pct,
  rent_pct             = EXCLUDED.rent_pct,
  energy_pct           = EXCLUDED.energy_pct,
  other_pct            = EXCLUDED.other_pct,
  profit_margin_factor = EXCLUDED.profit_margin_factor,
  updated_at           = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- Ev/Mobilya: T.C. Sanayi Bakanlığı Mobilya Raporu 2022
-- Raw %35 (30-40), Labor %20 (15-25), Enerji %10 (8-12), Lojistik %12.5 (10-15), Ambalaj %4 (3-5)
-- Perakende marj %17.5 (15-20) ort. → kapsam dışı
-- profit_margin_factor: 1/(1-0.175) = 1.21
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO production_cost_weights
  (country, category, raw_material_pct, labor_pct, rent_pct, energy_pct, other_pct, profit_margin_factor)
VALUES
  ('TR', 'home_living', 0.35, 0.20, 0.125, 0.10, 0.04, 1.21)
ON CONFLICT (country, category) DO UPDATE SET
  raw_material_pct     = EXCLUDED.raw_material_pct,
  labor_pct            = EXCLUDED.labor_pct,
  rent_pct             = EXCLUDED.rent_pct,
  energy_pct           = EXCLUDED.energy_pct,
  other_pct            = EXCLUDED.other_pct,
  profit_margin_factor = EXCLUDED.profit_margin_factor,
  updated_at           = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- Yemek Teslimatı/Restoran: TCMB Ekonomi Notları (Aralık 2024), Capital Magazine (Eylül 2025)
-- Genel gider oranı %80-85 (kafe/restoran) → marj %15-20
-- İşçilik ~%30 satışların, Gıda değişken
-- Hammadde (gıda) %30 (25-35), İşçilik %30 (25-35), Kira+Enerji %20 (15-25), Platform komisyon %7.5 (5-10)
-- Marj %10 (5-15) → factor = 1/(1-0.10) = 1.11
-- Not: Trendyol Yemek komisyon %10-38, sektör %15-32 (Ideasoft 2026) — teslimat maliyetine dahil
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO production_cost_weights
  (country, category, raw_material_pct, labor_pct, rent_pct, energy_pct, other_pct, profit_margin_factor)
VALUES
  ('TR', 'food_delivery', 0.30, 0.30, 0.075, 0.20, 0.035, 1.11)
ON CONFLICT (country, category) DO UPDATE SET
  raw_material_pct     = EXCLUDED.raw_material_pct,
  labor_pct            = EXCLUDED.labor_pct,
  rent_pct             = EXCLUDED.rent_pct,
  energy_pct           = EXCLUDED.energy_pct,
  other_pct            = EXCLUDED.other_pct,
  profit_margin_factor = EXCLUDED.profit_margin_factor,
  updated_at           = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- Konaklama: food_delivery ile yakın, servis+kira baskın
-- TCMB + Capital Magazine. İşçilik ~%30-35, Kira+enerji artış trendinde
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO production_cost_weights
  (country, category, raw_material_pct, labor_pct, rent_pct, energy_pct, other_pct, profit_margin_factor)
VALUES
  ('TR', 'hospitality_lodging', 0.25, 0.35, 0.20, 0.10, 0.05, 1.18)
ON CONFLICT (country, category) DO UPDATE SET
  raw_material_pct     = EXCLUDED.raw_material_pct,
  labor_pct            = EXCLUDED.labor_pct,
  rent_pct             = EXCLUDED.rent_pct,
  energy_pct           = EXCLUDED.energy_pct,
  other_pct            = EXCLUDED.other_pct,
  profit_margin_factor = EXCLUDED.profit_margin_factor,
  updated_at           = now();

-- ─────────────────────────────────────────────────────────────────────────────
-- Seyahat/Bilet: Yakıt baskın (EPDK), proxy veriler
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO production_cost_weights
  (country, category, raw_material_pct, labor_pct, rent_pct, energy_pct, other_pct, profit_margin_factor)
VALUES
  ('TR', 'travel_ticket', 0.40, 0.20, 0.05, 0.25, 0.05, 1.20)
ON CONFLICT (country, category) DO UPDATE SET
  raw_material_pct     = EXCLUDED.raw_material_pct,
  labor_pct            = EXCLUDED.labor_pct,
  rent_pct             = EXCLUDED.rent_pct,
  energy_pct           = EXCLUDED.energy_pct,
  other_pct            = EXCLUDED.other_pct,
  profit_margin_factor = EXCLUDED.profit_margin_factor,
  updated_at           = now();

-- Dijital hizmetler ve diğer: proxy veriler (TR özgü araştırma eksik)
INSERT INTO production_cost_weights
  (country, category, raw_material_pct, labor_pct, rent_pct, energy_pct, other_pct, profit_margin_factor)
VALUES
  ('TR', 'services_digital', 0.10, 0.35, 0.05, 0.15, 0.35, 1.30),
  ('TR', 'other',            0.35, 0.22, 0.10, 0.10, 0.08, 1.22)
ON CONFLICT (country, category) DO UPDATE SET
  raw_material_pct     = EXCLUDED.raw_material_pct,
  labor_pct            = EXCLUDED.labor_pct,
  rent_pct             = EXCLUDED.rent_pct,
  energy_pct           = EXCLUDED.energy_pct,
  other_pct            = EXCLUDED.other_pct,
  profit_margin_factor = EXCLUDED.profit_margin_factor,
  updated_at           = now();

-- Doğrulama sorgusu
SELECT country, category,
       raw_material_pct, labor_pct, rent_pct, energy_pct, other_pct,
       (raw_material_pct + labor_pct + rent_pct + energy_pct + other_pct)::NUMERIC(4,3) AS total_check,
       profit_margin_factor
FROM production_cost_weights
WHERE country = 'TR'
ORDER BY category;
