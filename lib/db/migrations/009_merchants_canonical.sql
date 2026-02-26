-- Migration: Canonical merchants, patterns, locations; receipts.merchant_id
-- VKN is NOT stored in DB (use optional file/env map for Layer 1).
-- Run with: npx tsx scripts/run-migration.ts 009_merchants_canonical.sql (if available)
-- Or execute in Neon Console.

-- ============================================
-- MERCHANTS (canonical businesses)
-- ============================================
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('verified', 'candidate', 'unverified')),
  country_code VARCHAR(2),
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_merchants_country ON merchants(country_code);
CREATE INDEX IF NOT EXISTS idx_merchants_tier ON merchants(tier);
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_canonical_country
  ON merchants(LOWER(TRIM(canonical_name)), COALESCE(country_code, ''));

-- ============================================
-- MERCHANT PATTERNS (name variants for matching)
-- ============================================
CREATE TABLE IF NOT EXISTS merchant_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  pattern TEXT NOT NULL,
  normalized_pattern TEXT,
  pattern_type TEXT CHECK (pattern_type IN ('exact', 'fuzzy', 'abbreviation', 'ocr')),
  confidence_score DECIMAL(3,2) DEFAULT 0.85 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_merchant_patterns_merchant ON merchant_patterns(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_patterns_normalized ON merchant_patterns(LOWER(COALESCE(normalized_pattern, pattern)));

-- ============================================
-- MERCHANT LOCATIONS (city/district for Layer 3)
-- ============================================
CREATE TABLE IF NOT EXISTS merchant_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  city TEXT,
  district TEXT,
  address_keywords TEXT[],
  country_code VARCHAR(2),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_merchant_locations_merchant ON merchant_locations(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_locations_city ON merchant_locations(country_code, LOWER(COALESCE(city, '')));

-- ============================================
-- RECEIPTS: add merchant_id (optional FK to canonical merchant)
-- ============================================
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES merchants(id);
CREATE INDEX IF NOT EXISTS idx_receipts_merchant_id ON receipts(merchant_id);
