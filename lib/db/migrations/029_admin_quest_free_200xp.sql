-- Migration: Admin-only daily quest "free 300xp" (günde bir kez tamamlanabilir).
-- Neon SQL Editor'da bu dosyanın içeriğini çalıştırın.

INSERT INTO quest_templates (type, title, reward_ryumo, reward_season_xp, min_account_level, min_season_level)
SELECT 'D_ADMIN_FREE_300XP', 'free 300xp', 0, 300, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM quest_templates WHERE type = 'D_ADMIN_FREE_300XP');
