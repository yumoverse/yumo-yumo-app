-- 039_economic_indices_new_types.sql
--
-- Yeni endeks tipleri ekle:
--   TARIM     → Tarım Ürünleri Üretici Fiyat Endeksi (2020=100)
--   PRODUCTION → Sanayi Üretim Endeksi (2021=100)
--   YIUFE     → Yurt İçi Üretici Fiyat Endeksi (2003=100)
--
-- LABOR tipi zaten mevcut; çeyreklik işgücü verileri (Saatlik Maliyet,
-- Brüt Ücret, İstihdam) artık bu tipe yazılacak.
--
-- Seriler (labor.series örnekleri):
--   MC_G   = Saatlik İşgücü Maliyeti, Perakende (G)
--   W_G    = Brüt Ücret-Maaş Endeksi, Perakende (G)
--   E_G    = İstihdam Endeksi, Perakende (G)
--   MC_B_N = Saatlik Maliyet, İş Ekonomisi Geneli (B-N)
--   W_B_N  = Brüt Ücret, İş Ekonomisi Geneli
--   E_B_N  = İstihdam, İş Ekonomisi Geneli

ALTER TABLE economic_indices DROP CONSTRAINT IF EXISTS economic_indices_index_type_check;
ALTER TABLE economic_indices ADD CONSTRAINT economic_indices_index_type_check
  CHECK (index_type IN (
    'CPI', 'PPI', 'FUEL', 'LABOR', 'RENT', 'DIGITAL',
    'TARIM',      -- Tarım Ürünleri ÜFE (TÜİK, 2020=100)
    'PRODUCTION', -- Sanayi Üretim Endeksi (TÜİK, 2021=100)
    'YIUFE'       -- Yurt İçi ÜFE / YİÜFE (TÜİK, 2003=100)
  ));

-- Yeni index tiplerine ait arama indeksleri
CREATE INDEX IF NOT EXISTS idx_economic_indices_tarim
  ON economic_indices (country, series, year_month DESC)
  WHERE index_type = 'TARIM';

CREATE INDEX IF NOT EXISTS idx_economic_indices_production
  ON economic_indices (country, series, year_month DESC)
  WHERE index_type = 'PRODUCTION';

CREATE INDEX IF NOT EXISTS idx_economic_indices_yiufe
  ON economic_indices (country, series, year_month DESC)
  WHERE index_type = 'YIUFE';

-- LABOR için mevcut index genellikle seriyle birlikte aranır
CREATE INDEX IF NOT EXISTS idx_economic_indices_labor
  ON economic_indices (country, series, year_month DESC)
  WHERE index_type = 'LABOR';

COMMENT ON CONSTRAINT economic_indices_index_type_check ON economic_indices IS
  'CPI=TÜFE, PPI=ÜFE(imalat), TARIM=Tarım ÜFE, PRODUCTION=Sanayi Üretim, YIUFE=Yurt İçi ÜFE(2003=100), LABOR=İşgücü Maliyet/Ücret/İstihdam';
