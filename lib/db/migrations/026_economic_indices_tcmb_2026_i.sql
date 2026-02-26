-- Migration 026: economic_indices seed — TCMB Enflasyon Raporu 2026-I (12 Şubat 2026)
-- Neon SQL Editor'da çalıştırın.
--
-- index_type: CPI, PPI, LABOR, RENT, FUEL
-- series: alt endeks kodu (GENEL, TARIM, TARIM_DISI_NOMINAL, TUIK_GERCEK, ENERJI_TRENDYIL vb.)
-- value: yıllık % değişim (örn. 30.7 = %30,7)
--
-- Kaynak: TCMB Enflasyon Raporu 2026-I, 12 Şubat 2026

-- ─────────────────────────────────────────────
-- 1. TÜFE (CPI)
-- ─────────────────────────────────────────────

INSERT INTO economic_indices (country, index_type, series, year_month, value, source, source_url, is_verified)
VALUES
  ('TR', 'CPI', 'GENEL',        '2026-01', 30.70, 'TCMB Enflasyon Raporu 2026-I', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', TRUE),
  ('TR', 'CPI', 'GIDA',         '2026-01', 31.70, 'TCMB Enflasyon Raporu 2026-I', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', TRUE),
  ('TR', 'CPI', 'ENERJI',       '2026-01',  4.10, 'TCMB Enflasyon Raporu 2026-I s.29', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', TRUE),
  ('TR', 'CPI', 'TEMEL_MAL',    '2026-01', 30.10, 'TCMB Enflasyon Raporu 2026-I s.27', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', TRUE),
  ('TR', 'CPI', 'HIZMET',       '2026-01', 38.40, 'TCMB Enflasyon Raporu 2026-I s.27', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', TRUE)
ON CONFLICT (country, index_type, series, year_month) DO UPDATE SET
  value = EXCLUDED.value, source = EXCLUDED.source, is_verified = EXCLUDED.is_verified, updated_at = now();

-- ─────────────────────────────────────────────
-- 2. PPI (Ham Madde)
-- ─────────────────────────────────────────────

INSERT INTO economic_indices (country, index_type, series, year_month, value, source, source_url, is_verified)
VALUES
  ('TR', 'PPI', 'GENEL',        '2026-01', 27.17, 'TCMB Enflasyon Raporu 2026-I s.33', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', TRUE),
  ('TR', 'PPI', 'IMALAT_TREND', '2026-01', 18.40, 'TCMB Enflasyon Raporu 2026-I s.33', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', TRUE),
  ('TR', 'PPI', 'TARIM',        '2026-01', 28.30, 'TCMB Enflasyon Raporu 2026-I', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', TRUE)
ON CONFLICT (country, index_type, series, year_month) DO UPDATE SET
  value = EXCLUDED.value, source = EXCLUDED.source, is_verified = EXCLUDED.is_verified, updated_at = now();

-- ─────────────────────────────────────────────
-- 3. LABOR (İşçilik)
-- ─────────────────────────────────────────────

INSERT INTO economic_indices (country, index_type, series, year_month, value, source, source_url, is_verified)
VALUES
  ('TR', 'LABOR', 'TARIM_DISI_NOMINAL', '2025-09', 40.30, 'TCMB Enflasyon Raporu 2026-I s.23 Grafik 2.3.19', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', TRUE),
  ('TR', 'LABOR', 'ASGARI_UCRET',      '2026-01', 30.00, 'TCMB Enflasyon Raporu 2026-I s.23', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', FALSE)
ON CONFLICT (country, index_type, series, year_month) DO UPDATE SET
  value = EXCLUDED.value, source = EXCLUDED.source, is_verified = EXCLUDED.is_verified, updated_at = now();

-- ─────────────────────────────────────────────
-- 4. RENT (Kira)
-- ─────────────────────────────────────────────

INSERT INTO economic_indices (country, index_type, series, year_month, value, source, source_url, is_verified)
VALUES
  ('TR', 'RENT', 'TUIK_GERCEK',   '2025-12', 61.60, 'TCMB Enflasyon Raporu 2026-I Kutu 2.2', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', TRUE),
  ('TR', 'RENT', 'YKKE',          '2025-12', 36.00, 'TCMB Enflasyon Raporu 2026-I Kutu 2.2 Grafik 1', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', TRUE),
  ('TR', 'RENT', 'TAHMINI_2026',  '2026-12', 31.60, 'TCMB Enflasyon Raporu 2026-I Kutu 2.2 Senaryo 2', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', FALSE)
ON CONFLICT (country, index_type, series, year_month) DO UPDATE SET
  value = EXCLUDED.value, source = EXCLUDED.source, is_verified = EXCLUDED.is_verified, updated_at = now();

-- ─────────────────────────────────────────────
-- 5. FUEL (Enerji)
-- ─────────────────────────────────────────────

INSERT INTO economic_indices (country, index_type, series, year_month, value, source, source_url, is_verified)
VALUES
  ('TR', 'FUEL', 'BRENT_USD',    '2026-01', 67.00, 'TCMB Enflasyon Raporu 2026-I s.29', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', TRUE),
  ('TR', 'FUEL', 'ENERJI_TRENDYIL', '2026-01',  4.10, 'TCMB Enflasyon Raporu 2026-I s.29', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', TRUE),
  ('TR', 'FUEL', 'ELEKTRIK_PROXY', '2026-01', 15.00, 'TCMB Enflasyon Raporu 2026-I', 'https://www.tcmb.gov.tr/wps/wcm/connect/TR/TCMB+TR/Main+Menu/Yayinlar/Raporlar/Enflasyon+Raporu', FALSE)
ON CONFLICT (country, index_type, series, year_month) DO UPDATE SET
  value = EXCLUDED.value, source = EXCLUDED.source, is_verified = EXCLUDED.is_verified, updated_at = now();
