/**
 * Reward dispatcher: when quest completes, add rYUMO + season XP + account XP.
 * Every quest type grants both season XP and account XP (account XP = rewardAccountXp ?? rewardSeasonXp).
 */

import { getSql } from "@/lib/db/client";
import { getAccountLevelFromXp } from "@/config/account-level-config";
import { getSeasonLevelFromXp } from "@/config/season-level-config";

function toRows(r: unknown): any[] {
  if (Array.isArray(r)) return r;
  if (r && typeof r === "object" && "rows" in r && Array.isArray((r as { rows: unknown }).rows))
    return (r as { rows: any[] }).rows;
  return [];
}

export async function dispatchQuestReward(
  username: string,
  userQuestId: number,
  questType: string,
  rewardRyumo: number,
  rewardSeasonXp: number,
  seasonNumber: number,
  rewardAccountXp?: number
): Promise<{ ok: boolean; error?: string }> {
  const sql = getSql();
  if (!sql) return { ok: false, error: "Database not available" };

  try {
    // Her görevden hem season hem account XP: açıkça verilmişse onu kullan, yoksa season XP kadar account XP ver.
    const accountXpToAdd = rewardAccountXp ?? rewardSeasonXp;

    // 1) rYUMO + XP atomik olarak artır — read-modify-write yerine atomik increment kullan
    //    Bu sayede eş zamanlı iki quest tamamlama XP kaybına veya level tutarsızlığına yol açmaz.
    const upsertResult = await sql`
      INSERT INTO user_profiles (username, ryumo_balance, season_xp, account_xp, account_level, season_level, updated_at)
      VALUES (${username}, ${rewardRyumo}, ${rewardSeasonXp}, ${accountXpToAdd}, 1, 1, now())
      ON CONFLICT (username) DO UPDATE SET
        ryumo_balance = COALESCE(user_profiles.ryumo_balance, 0) + EXCLUDED.ryumo_balance,
        season_xp     = COALESCE(user_profiles.season_xp, 0)     + ${rewardSeasonXp},
        account_xp    = COALESCE(user_profiles.account_xp, 0)    + ${accountXpToAdd},
        updated_at    = EXCLUDED.updated_at
      RETURNING account_xp, season_xp
    `;
    const updatedRow = toRows(upsertResult)[0] as { account_xp?: number; season_xp?: number } | undefined;
    const newAccountXp = Number(updatedRow?.account_xp ?? accountXpToAdd);
    const newSeasonXp = Number(updatedRow?.season_xp ?? rewardSeasonXp);
    const newAccountLevel = getAccountLevelFromXp(newAccountXp);
    const newSeasonLevel = getSeasonLevelFromXp(newSeasonXp);

    // Level'ı XP'den türeterek güncelle (ayrı sorgu; atomik increment'ten sonra gelir)
    await sql`
      UPDATE user_profiles
      SET account_level = ${newAccountLevel}, season_level = ${newSeasonLevel}, updated_at = now()
      WHERE username = ${username}
    `;

    await sql`
      UPDATE user_quests
      SET status = 'completed', progress = target, completed_at = now(), updated_at = now()
      WHERE id = ${userQuestId} AND username = ${username}
    `;

    // 2) Event tabloları (yoksa veya hata verirse ödül yine verilmiş olur)
    try {
      await sql`
        INSERT INTO season_xp_events (username, xp_delta, source_type, reference_id, season_number)
        VALUES (${username}, ${rewardSeasonXp}, ${"quest_" + questType.toLowerCase()}, ${String(userQuestId)}, ${seasonNumber})
      `;
    } catch (e) {
      console.warn("[reward-dispatcher] season_xp_events insert failed (reward still applied):", e);
    }
    try {
      await sql`
        INSERT INTO account_xp_events (username, xp_delta, source_type, reference_id, ayumo_linked)
        VALUES (${username}, ${accountXpToAdd}, ${"quest_" + questType.toLowerCase()}, ${String(userQuestId)}, false)
      `;
    } catch (e) {
      console.warn("[reward-dispatcher] account_xp_events insert failed (reward still applied):", e);
    }

    return { ok: true };
  } catch (err: any) {
    console.error("[reward-dispatcher] dispatchQuestReward error:", err);
    return { ok: false, error: err?.message ?? String(err) };
  }
}
