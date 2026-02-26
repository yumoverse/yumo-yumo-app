-- Migration: user_profiles occupation (for settings)
-- Neon SQL Editor'da bu dosyanın içeriğini çalıştırın.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS occupation VARCHAR(255);
