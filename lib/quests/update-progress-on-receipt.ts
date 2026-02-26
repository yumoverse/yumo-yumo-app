/**
 * Fiş kaydedildiğinde günlük görev ilerlemesini günceller.
 *
 * D3 / D4  → bugün taranan farklı kategori sayısı
 * D7 / D8  → bugün taranan farklı mağaza sayısı
 * D5       → bugünkü toplam gizli maliyet (₺ tutar, hidden_cost_core toplamı)
 * D6       → bugün hidden_cost_core > 0 olan en az 1 fiş var mı? (0 veya 1)
 * D9       → bugün taranan toplam fiş sayısı
 *
 * Ödül sadece kullanıcı "Görevi Tamamla" butonuna basınca verilir.
 */

import { getSql } from "@/lib/db/client";
import { ensureDailyQuestsForUser } from "./daily-generator";

function toRows(r: unknown): any[] {
  if (Array.isArray(r)) return r;
  if (r && typeof r === "object" && "rows" in r && Array.isArray((r as { rows: unknown }).rows))
    return (r as { rows: any[] }).rows;
  return [];
}

export async function updateDailyQuestProgressOnReceiptSaved(username: string): Promise<void> {
  const sql = getSql();
  if (!sql) return;

  try {
    const todayStr = new Date().toISOString().slice(0, 10);

    // Sezonu bul ve görevlerin oluşturulduğundan emin ol (check-in şart değil)
    const seasonRow = await sql`
      SELECT season_number FROM seasons WHERE status = 'active' ORDER BY start_at DESC LIMIT 1
    `;
    const seasonNumber = (seasonRow[0] as any)?.season_number ?? 1;
    await ensureDailyQuestsForUser(username, todayStr, seasonNumber);

    const [categoryRow, merchantRow, hiddenSumRow, hiddenAnyRow, receiptCountRow] = await Promise.all([
      // D3/D4: farklı kategori sayısı
      sql`
        SELECT COUNT(DISTINCT COALESCE(TRIM(merchant_category), ''))::int AS cnt
        FROM receipts
        WHERE username = ${username}
          AND (created_at AT TIME ZONE 'UTC')::date = ${todayStr}::date
          AND TRIM(COALESCE(merchant_category, '')) != ''
      `.then(r => (Array.isArray(r) ? r[0] : null)),

      // D7/D8: farklı mağaza sayısı
      sql`
        SELECT COUNT(DISTINCT COALESCE(TRIM(merchant_name), ''))::int AS cnt
        FROM receipts
        WHERE username = ${username}
          AND (created_at AT TIME ZONE 'UTC')::date = ${todayStr}::date
          AND TRIM(COALESCE(merchant_name, '')) != ''
      `.then(r => (Array.isArray(r) ? r[0] : null)),

      // D5: bugünkü toplam gizli maliyet ₺
      sql`
        SELECT COALESCE(SUM(hidden_cost_core), 0)::float AS total
        FROM receipts
        WHERE username = ${username}
          AND (created_at AT TIME ZONE 'UTC')::date = ${todayStr}::date
      `.then(r => (Array.isArray(r) ? r[0] : null)),

      // D6: gizli maliyetli en az 1 fiş var mı? (0 veya 1)
      sql`
        SELECT COUNT(*)::int AS cnt
        FROM receipts
        WHERE username = ${username}
          AND (created_at AT TIME ZONE 'UTC')::date = ${todayStr}::date
          AND COALESCE(hidden_cost_core, 0) > 0
      `.then(r => (Array.isArray(r) ? r[0] : null)),

      // D9: bugün taranan toplam fiş sayısı
      sql`
        SELECT COUNT(*)::int AS cnt
        FROM receipts
        WHERE username = ${username}
          AND (created_at AT TIME ZONE 'UTC')::date = ${todayStr}::date
      `.then(r => (Array.isArray(r) ? r[0] : null)),
    ]);

    const categoryCount  = Math.min(Number((categoryRow   as any)?.cnt   ?? 0), 999);
    const merchantCount  = Math.min(Number((merchantRow   as any)?.cnt   ?? 0), 999);
    const hiddenSum      = Math.min(Math.round(Number((hiddenSumRow  as any)?.total ?? 0)), 99999);
    const hiddenAny      = Math.min(Number((hiddenAnyRow  as any)?.cnt   ?? 0), 1); // max 1 (0 veya 1)
    const receiptCount   = Math.min(Number((receiptCountRow as any)?.cnt ?? 0), 999);

    // Aktif günlük görevleri çek
    const questRows = await sql`
      SELECT uq.id, uq.target, uq.season_number, qt.type,
             qt.reward_ryumo, qt.reward_season_xp
      FROM user_quests uq
      JOIN quest_templates qt ON uq.quest_template_id = qt.id
      WHERE uq.username = ${username}
        AND qt.type IN ('D3','D4','D5','D6','D7','D8','D9')
        AND (uq.expires_at AT TIME ZONE 'UTC')::date = ${todayStr}::date
        AND uq.status != 'completed'
    `;
    const quests = toRows(questRows) as {
      id: number;
      target: number;
      season_number: number;
      type: string;
      reward_ryumo: number;
      reward_season_xp: number;
    }[];

    for (const q of quests) {
      const target = Number(q.target) || 1;

      let progress: number;
      switch (q.type) {
        case "D3":
        case "D4":
          progress = Math.min(categoryCount, target);
          break;
        case "D7":
        case "D8":
          progress = Math.min(merchantCount, target);
          break;
        case "D5":
          progress = Math.min(hiddenSum, target);
          break;
        case "D6":
          progress = Math.min(hiddenAny, target);
          break;
        case "D9":
          progress = Math.min(receiptCount, target);
          break;
        default:
          continue;
      }

      await sql`
        UPDATE user_quests
        SET progress = ${progress}, updated_at = now()
        WHERE id = ${q.id}
      `;
    }

    if (quests.length > 0) {
      console.log("[quests] Updated daily progress:", {
        username,
        today: todayStr,
        categoryCount,
        merchantCount,
        hiddenSum,
        hiddenAny,
        receiptCount,
        updatedQuests: quests.length,
      });
    }
  } catch (err) {
    console.warn("[quests] updateDailyQuestProgressOnReceiptSaved failed:", err);
  }
}
