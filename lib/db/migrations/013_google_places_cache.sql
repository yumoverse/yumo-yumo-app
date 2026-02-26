-- Migration: Google Places API sonuçları için cache tablosu
-- Run: Neon Console'da bu SQL'i çalıştır veya: npx tsx scripts/run-migration.ts 013_google_places_cache.sql
-- Kullanım: lib/db/merchantPlacesCache.ts, places-service.ts

-- ============================================
-- MERCHANT PLACES CACHE (Google Places API)
-- ============================================
CREATE TABLE IF NOT EXISTS merchant_places_cache (
  id SERIAL PRIMARY KEY,
  merchant_name_normalized VARCHAR(255) NOT NULL,
  merchant_name_original VARCHAR(255),
  place_id VARCHAR(255),
  price_level INTEGER CHECK (price_level >= 0 AND price_level <= 4),
  country VARCHAR(2),
  place_name VARCHAR(255),
  place_types TEXT[],
  domain VARCHAR(255),
  confidence DECIMAL(3, 2) DEFAULT 0.8 CHECK (confidence >= 0 AND confidence <= 1),
  cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  UNIQUE(merchant_name_normalized, country)
);

CREATE INDEX IF NOT EXISTS idx_merchant_places_cache_lookup 
  ON merchant_places_cache(merchant_name_normalized, country) 
  WHERE expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_merchant_places_cache_expires 
  ON merchant_places_cache(expires_at) 
  WHERE expires_at IS NOT NULL;

COMMENT ON TABLE merchant_places_cache IS 
  'Google Places API sonuçlarını önbellekler; merchant tier ve doğrulama için tekrarlı API çağrılarını azaltır.';

-- Eğer tablo zaten varsa (schema.sql ile oluşturulduysa) domain sütununu ekle
ALTER TABLE merchant_places_cache ADD COLUMN IF NOT EXISTS domain VARCHAR(255);
