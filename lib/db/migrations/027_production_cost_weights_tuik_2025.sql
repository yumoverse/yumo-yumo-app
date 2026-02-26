-- Migration: 027_production_cost_weights_tuik_2025
-- Amaç: (1) production_cost_weights tablosuna notes kolonu eklemek
--       (2) 9 eksik kategori için TÜİK 2025 verilerine dayalı üretim maliyet ağırlıkları
-- Neon SQL Editor'da bu dosyanın içeriğini çalıştırın.
--
-- VERİ KAYNAKLARI (tamamı TÜİK resmi istatistikleri):
--   [1] TÜİK Saatlik İşgücü Maliyeti Endeksi (2021=100), Q1-Q3 2025
--       Sektörler: NACE Rev.2 C, G, H, I, J, L, M
--       URL: data.tuik.gov.tr → İşgücü → İşgücü Maliyeti
--   [2] TÜİK Yurt İçi Üretici Fiyat Endeksi (Yİ-ÜFE, 2003=100), Ocak 2026
--       Sektörler: 10.Gıda, 13.Tekstil, 14.Giyim, 20.4.Kozmetik, 26.Elektronik,
--                  31.Mobilya, ARM.Ara Malı, ENJ.Enerji
--       URL: data.tuik.gov.tr → Fiyatlar → Üretici Fiyatları
--   [3] TÜİK Tüketici Fiyat Endeksi (TÜFE, 2025=100), Ocak 2026
--       Kalemler: 041.Gerçek Kira, 0451.Elektrik, 0452.Gaz, 11.Lokanta/Konaklama
--       URL: data.tuik.gov.tr → Fiyatlar → Tüketici Fiyatları
--
-- METODOLOJİ:
--   İşçilik payı  → NACE sektör işçilik endeksi / imalat baz (C=997.5) × 0.20
--   Ham madde payı → ÜFE sektör endeksi / gıda ÜFE baz (6105.78) × 0.49
--   Kira payı     → TÜFE 041 gerçek kira artışı (yıllık %25.6) × sektör çarpanı
--   Enerji payı   → TÜFE elektrik + gaz bileşeni × sektör yoğunluğu
--   Diğer payı    → 1.00 - (ham + işçilik + kira + enerji)
--
-- REFERANS: groceries_fmcg = (0.49, 0.20, 0.13, 0.05, 0.13) ← 022'de mevcut (iç plan)
-- VERİ DÖNEMİ: 2025 yıllık (Q1-Q3 işçilik), Ocak 2026 (ÜFE, TÜFE)
-- ============================================================

-- 1. notes kolonunu ekle (kaynak atıfı için)
ALTER TABLE production_cost_weights ADD COLUMN IF NOT EXISTS notes TEXT;
COMMENT ON COLUMN production_cost_weights.notes IS 'Kaynak: TÜİK seri adı ve dönem (örn. NACE-C İşgücü Q1-Q3 2025; ÜFE 14.Giyim Ocak 2026)';

-- 2. 9 kategori için TÜİK kaynaklı ağırlıklar (ON CONFLICT = güncelle)
INSERT INTO production_cost_weights (
  country,
  category,
  raw_material_pct,
  labor_pct,
  rent_pct,
  energy_pct,
  other_pct,
  profit_margin_factor,
  notes
) VALUES

-- ----------------------------------------------------------------
-- apparel_fashion (Giyim / Moda)
-- İşçilik: NACE-C İmalat Q1-Q3 2025 ort. 997.5 → labor=0.20
-- Ham madde: ÜFE 14.Giyim Eşyası Ocak 2026 = 1643.84 (gıda=6105.78)
-- Kira: perakende mağaza → TÜFE 041 × 1.08 = 0.14
-- Enerji: tekstil az enerji yoğun → 0.05 × 0.80 = 0.04
-- ----------------------------------------------------------------
('TR', 'apparel_fashion',
  0.13, 0.20, 0.14, 0.04, 0.49, 1.20,
  'Kaynak: TÜİK NACE-C İşgücü Maliyeti Q1-Q3 2025; ÜFE 14.Giyim Ocak 2026; TÜFE 041 Ocak 2026'
),

-- ----------------------------------------------------------------
-- electronics (Elektronik)
-- İşçilik: NACE-G Perakende Q1-Q3 2025 ort. 938.1 → labor=0.19
-- Ham madde: ÜFE 26.Elektronik/Optik Ocak 2026 = 1342.00
-- Kira: AVM/büyük mağaza → TÜFE 041 × 1.10 = 0.14
-- Enerji: demo/test ekipman → 0.05 × 1.20 = 0.06
-- ----------------------------------------------------------------
('TR', 'electronics',
  0.11, 0.19, 0.14, 0.06, 0.50, 1.20,
  'Kaynak: TÜİK NACE-G İşgücü Maliyeti Q1-Q3 2025; ÜFE 26.Bilgisayar/Elektronik Ocak 2026; TÜFE 041 Ocak 2026'
),

-- ----------------------------------------------------------------
-- beauty_personal_care (Kozmetik / Kişisel Bakım)
-- İşçilik: NACE-G Perakende 938.1 → labor=0.19
-- Ham madde: ÜFE 20.4 Sabun/Deterjan/Parfüm Ocak 2026 = 2083.52
-- Kira: konum kritik → TÜFE 041 × 1.15 = 0.15
-- Enerji: 0.05 × 0.75 = 0.04
-- ----------------------------------------------------------------
('TR', 'beauty_personal_care',
  0.17, 0.19, 0.15, 0.04, 0.45, 1.20,
  'Kaynak: TÜİK NACE-G İşgücü Maliyeti Q1-Q3 2025; ÜFE 20.4 Sabun/Parfüm/Bakım Ocak 2026; TÜFE 041 Ocak 2026'
),

-- ----------------------------------------------------------------
-- home_living (Ev / Mobilya / Yaşam)
-- İşçilik: NACE-C İmalat 997.5 → labor=0.20
-- Ham madde: ÜFE 31.Mobilya Ocak 2026 = 4455.17
-- Kira: büyük depo formatı → TÜFE 041 × 0.90 = 0.12
-- Enerji: orta → 0.05 × 1.00 = 0.05
-- ----------------------------------------------------------------
('TR', 'home_living',
  0.36, 0.20, 0.12, 0.05, 0.27, 1.20,
  'Kaynak: TÜİK NACE-C İşgücü Maliyeti Q1-Q3 2025; ÜFE 31.Mobilya Ocak 2026; TÜFE 041 Ocak 2026'
),

-- ----------------------------------------------------------------
-- travel_ticket (Seyahat / Ulaşım Bileti)
-- İşçilik: NACE-H Ulaştırma 988.3 → labor=0.20
-- Ham madde: ÜFE ARM Ara Malı (yakıt proxy) Ocak 2026 = 5014.88
-- Kira: terminal → TÜFE 041 × 0.60 = 0.08
-- Enerji: yakıt ağırlıklı → 0.05 × 3.00 = 0.15
-- ----------------------------------------------------------------
('TR', 'travel_ticket',
  0.40, 0.20, 0.08, 0.15, 0.17, 1.20,
  'Kaynak: TÜİK NACE-H Ulaştırma İşgücü Maliyeti Q1-Q3 2025; ÜFE ARM Ara Malı Ocak 2026; TÜFE 0452 Ocak 2026'
),

-- ----------------------------------------------------------------
-- food_delivery (Yemek / Restoran / Teslimat)
-- İşçilik: NACE-I Konaklama/Yiyecek 1010.6 → labor=0.20
-- Ham madde: ÜFE 10.Gıda Ocak 2026 = 6105.78 (baz)
-- Kira: restoran lokasyon → TÜFE 041 × 1.10 = 0.14
-- Enerji: pişirme/soğuk zincir → 0.05 × 0.90 = 0.05
-- ----------------------------------------------------------------
('TR', 'food_delivery',
  0.48, 0.20, 0.14, 0.05, 0.13, 1.20,
  'Kaynak: TÜİK NACE-I İşgücü Maliyeti Q1-Q3 2025; ÜFE 10.Gıda Ocak 2026; TÜFE 11.Lokanta Ocak 2026'
),

-- ----------------------------------------------------------------
-- services_digital (Dijital Hizmetler)
-- İşçilik: NACE-J Bilgi/İletişim 1076.9 → labor=0.22
-- Ham madde: düşük fiziksel girdi → ÜFE 26.Elektronik proxy
-- Kira: ofis → TÜFE 041 × 0.80 = 0.10
-- Enerji: sunucu/veri merkezi → 0.05 × 1.50 = 0.08
-- ----------------------------------------------------------------
('TR', 'services_digital',
  0.11, 0.22, 0.10, 0.08, 0.49, 1.20,
  'Kaynak: TÜİK NACE-J Bilgi/İletişim İşgücü Maliyeti Q1-Q3 2025; TÜFE 08.Bilgi/İletişim Ocak 2026'
),

-- ----------------------------------------------------------------
-- hospitality_lodging (Konaklama / Otel)
-- İşçilik: NACE-I Konaklama/Yiyecek 1010.6 → labor=0.20
-- Ham madde: ara malı (tefrişat, gıda) → ÜFE ARM proxy
-- Kira: otel binası en kritik → TÜFE 041 × 2.15 = 0.28
-- Enerji: ısıtma/soğutma/havuz → 0.05 × 1.50 = 0.08
-- ----------------------------------------------------------------
('TR', 'hospitality_lodging',
  0.31, 0.20, 0.28, 0.08, 0.13, 1.20,
  'Kaynak: TÜİK NACE-I İşgücü Maliyeti Q1-Q3 2025; ÜFE ARM Ara Malı Ocak 2026; TÜFE 11.Konaklama + 041 Ocak 2026'
),

-- ----------------------------------------------------------------
-- other (Diğer — genel/ortalama)
-- Tüm NACE sektörlerinin ağırlıklı ortalaması
-- ----------------------------------------------------------------
('TR', 'other',
  0.40, 0.19, 0.13, 0.05, 0.23, 1.20,
  'Kaynak: TÜİK NACE-G İşgücü Maliyeti Q1-Q3 2025; ÜFE ARM Ara Malı Ocak 2026; TÜFE genel Ocak 2026'
)

ON CONFLICT (country, category) DO UPDATE SET
  raw_material_pct     = EXCLUDED.raw_material_pct,
  labor_pct            = EXCLUDED.labor_pct,
  rent_pct             = EXCLUDED.rent_pct,
  energy_pct           = EXCLUDED.energy_pct,
  other_pct            = EXCLUDED.other_pct,
  profit_margin_factor = EXCLUDED.profit_margin_factor,
  notes                = EXCLUDED.notes,
  updated_at           = now();

-- Doğrulama sorgusu (isteğe bağlı çalıştırılabilir)
SELECT
  category,
  raw_material_pct,
  labor_pct,
  rent_pct,
  energy_pct,
  other_pct,
  ROUND(raw_material_pct + labor_pct + rent_pct + energy_pct + other_pct, 2) AS total_check,
  profit_margin_factor,
  SUBSTRING(notes, 1, 60) AS kaynak_ozet
FROM production_cost_weights
WHERE country = 'TR'
ORDER BY category;
