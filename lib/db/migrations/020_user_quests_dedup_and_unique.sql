-- Migration: user_quests tekilleştirme — aynı gün aynı kullanıcı aynı görev türü tek kayıt.
-- Neon SQL Editor'da bu dosyanın içeriğini çalıştırın.

-- 1) Çift kayıtları sil: (username, quest_template_id, expires_at günü) başına bir tane bırak.
--    Tamamlanmış (completed) olan tercih edilir, yoksa en son id.
DELETE FROM user_quests
WHERE id NOT IN (
  SELECT id FROM (
    SELECT DISTINCT ON (uq.username, uq.quest_template_id, (uq.expires_at AT TIME ZONE 'UTC')::date)
      uq.id
    FROM user_quests uq
    ORDER BY uq.username, uq.quest_template_id, (uq.expires_at AT TIME ZONE 'UTC')::date,
      (CASE WHEN uq.status = 'completed' THEN 0 ELSE 1 END), uq.id DESC
  ) keep
);

-- 2) Aynı (kullanıcı, şablon, gün) tekrar eklenmesin diye unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_quests_user_template_day
  ON user_quests (username, quest_template_id, ((expires_at AT TIME ZONE 'UTC')::date));
