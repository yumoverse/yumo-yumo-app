/**
 * Daily quest generator: 4 görev/kullanıcı/gün.
 * Slot yapısı:
 *   Slot 1 — D1  (her zaman günlük giriş)
 *   Slot 2 — D3 | D4  (kategori görevi)
 *   Slot 3 — D5 | D6  (gizli maliyet görevi)
 *   Slot 4 — D7 | D8 | D9  (mağaza/fiş görevi)
 *
 * Anti-repeat: dünkü type'lar seçim havuzundan çıkarılır.
 * Aynı gün için deterministik hash (username+tarih) — farklı gün = farklı seçim.
 */

import { getSql } from "@/lib/db/client";
import { getUserState, type UserStateResult } from "./user-state";

function toRows(r: unknown): any[] {
  if (Array.isArray(r)) return r;
  if (r && typeof r === "object" && "rows" in r && Array.isArray((r as { rows: unknown }).rows))
    return (r as { rows: any[] }).rows;
  return [];
}

const FACTORS = [0.8, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5]; // Paz–Cmt
const STATIC_FLOOR = 10;

/** Deterministik gün hash'i — aynı username+tarih = aynı sayı */
function dayHash(username: string, dateStr: string): number {
  const str = `${username}:${dateStr}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(h, 33) ^ str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Seed + slot offset ile diziden deterministik seçim */
function seededPick<T>(items: T[], seed: number, slotOffset: number): T {
  return items[(seed + slotOffset * 1337) % items.length];
}

/** Dünkü tarihi YYYY-MM-DD olarak döner */
function yesterdayOf(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export interface DailyQuestSlot {
  type: string;
  title: string;
  target: number;
  progress: number;
  rewardRyumo: number;
  rewardSeasonXp: number;
  status: "active" | "completed";
}

/** Açık Türkçe yedek başlıklar (DB güncellenmemişse) */
const FALLBACK_TITLES: Record<string, string> = {
  D1: "Günlük giriş yap",
  D3: "1 farklı kategoriden fiş tara",
  D4: "2 farklı kategoriden fiş tara",
  D5: "Gizli maliyetli ürün bul",
  D6: "Gizli maliyetli fiş tara",
  D7: "Yeni bir mağazadan fiş tara",
  D8: "2 farklı mağazadan fiş tara",
  D9: "Bugün en az 1 fiş yükle",
};

function titleOf(type: string, dbTitle: string | undefined): string {
  // DB'deki eski teknik başlıklar hâlâ geçerliyse yedek kullan
  const stale = ["Hidden cost", "hidden cost", "Bugunun", "Zaman pencere", "merchant", "kategori tamamla", "farkli", "fis yukle", "Check-in"];
  if (!dbTitle || stale.some(s => dbTitle.includes(s))) {
    return FALLBACK_TITLES[type] ?? dbTitle ?? type;
  }
  return dbTitle;
}

export async function generateDailyQuests(
  username: string,
  dateStr: string,
  seasonNumber: number,
  userState?: UserStateResult
): Promise<DailyQuestSlot[]> {
  const state = userState ?? (await getUserState(username));
  const dayOfWeek = new Date(dateStr + "Z").getUTCDay();
  const factor = FACTORS[dayOfWeek] ?? 1.0;
  const threshold = Math.max(STATIC_FLOOR, Math.round(state.user7dAvgHiddenCost * factor));

  const sql = getSql();
  if (!sql) throw new Error("Database not available");

  // Şablon verileri
  const rawTemplates = await sql`
    SELECT id, type, title, reward_ryumo, reward_season_xp
    FROM quest_templates
    WHERE type IN ('D1','D3','D4','D5','D6','D7','D8','D9')
    ORDER BY type
  `;
  const templates = toRows(rawTemplates) as {
    id: number; type: string; title: string;
    reward_ryumo: number; reward_season_xp: number;
  }[];
  const byType = Object.fromEntries(templates.map(t => [t.type, t]));

  // Dünkü görev type'ları — tekrar olmaması için
  const yesterdayStr = yesterdayOf(dateStr);
  const yesterdayRaw = await sql`
    SELECT qt.type
    FROM user_quests uq
    JOIN quest_templates qt ON uq.quest_template_id = qt.id
    WHERE uq.username = ${username}
      AND qt.type IN ('D3','D4','D5','D6','D7','D8','D9')
      AND (uq.expires_at AT TIME ZONE 'UTC')::date = ${yesterdayStr}::date
  `;
  const yesterdayTypes = new Set(toRows(yesterdayRaw).map((r: any) => r.type as string));

  const hash = dayHash(username, dateStr);

  /** Havuzdan dünkü type'ları çıkar; kalmazsa tümünü kullan */
  function freshPool<T extends { type: string }>(pool: T[]): T[] {
    const fresh = pool.filter(t => !yesterdayTypes.has(t.type));
    return fresh.length > 0 ? fresh : pool;
  }

  // Slot 2: kategori görevi (D3 veya D4)
  const slot2Pool = [byType.D3, byType.D4].filter(Boolean);
  const slot2 = seededPick(freshPool(slot2Pool), hash, 0);

  // Slot 3: gizli maliyet görevi (D5 veya D6)
  const slot3Pool = [byType.D5, byType.D6].filter(Boolean);
  const slot3 = seededPick(freshPool(slot3Pool), hash, 1);

  // Slot 4: mağaza/fiş görevi (D7, D8 veya D9)
  const slot4Pool = [byType.D7, byType.D8, byType.D9].filter(Boolean);
  const slot4 = seededPick(freshPool(slot4Pool), hash, 2);

  const d1 = byType.D1;

  const slots = [
    {
      type: "D1",
      title: titleOf("D1", d1?.title),
      target: 1,
      rewardRyumo: d1?.reward_ryumo ?? 12,
      rewardSeasonXp: d1?.reward_season_xp ?? 32,
    },
    {
      type: slot2?.type ?? "D3",
      title: titleOf(slot2?.type ?? "D3", slot2?.title),
      target: slot2?.type === "D4" ? 2 : 1,
      rewardRyumo: slot2?.reward_ryumo ?? 12,
      rewardSeasonXp: slot2?.reward_season_xp ?? 60,
    },
    {
      type: slot3?.type ?? "D5",
      title: titleOf(slot3?.type ?? "D5", slot3?.title),
      // D5: hedef ₺ gizli maliyet tutarı | D6: 1 adet yeterli
      target: slot3?.type === "D6" ? 1 : threshold,
      rewardRyumo: slot3?.reward_ryumo ?? 17,
      rewardSeasonXp: slot3?.reward_season_xp ?? 85,
    },
    {
      type: slot4?.type ?? "D7",
      title: titleOf(slot4?.type ?? "D7", slot4?.title),
      target: slot4?.type === "D8" ? 2 : 1,
      rewardRyumo: slot4?.reward_ryumo ?? 12,
      rewardSeasonXp: slot4?.reward_season_xp ?? 65,
    },
  ];

  return slots.map(s => ({ ...s, progress: 0, status: "active" as const }));
}

export async function ensureDailyQuestsForUser(
  username: string,
  dateStr: string,
  seasonNumber: number
): Promise<{ created: boolean; quests: DailyQuestSlot[] }> {
  const sql = getSql();
  if (!sql) return { created: false, quests: [] };

  const existingRaw = await sql`
    SELECT uq.id, uq.progress, uq.target, qt.type, qt.title, qt.reward_ryumo, qt.reward_season_xp
    FROM user_quests uq
    JOIN quest_templates qt ON uq.quest_template_id = qt.id
    WHERE uq.username = ${username}
      AND qt.type IN ('D1','D3','D4','D5','D6','D7','D8','D9')
      AND (uq.expires_at AT TIME ZONE 'UTC')::date = ${dateStr}::date
  `;
  const existing = toRows(existingRaw);

  if (existing.length >= 4) {
    return {
      created: false,
      quests: existing.map((r: any) => ({
        type: r.type,
        title: titleOf(r.type, r.title),
        target: Number(r.target) ?? 1,
        progress: Number(r.progress) ?? 0,
        rewardRyumo: Number(r.reward_ryumo) ?? 12,
        rewardSeasonXp: Number(r.reward_season_xp) ?? 32,
        status: r.progress >= r.target ? "completed" : "active",
      })),
    };
  }

  const slots = await generateDailyQuests(username, dateStr, seasonNumber);

  const templatesRaw = await sql`
    SELECT id, type FROM quest_templates
    WHERE type IN ('D1','D3','D4','D5','D6','D7','D8','D9')
  `;
  const tplByType = Object.fromEntries(
    toRows(templatesRaw).map((t: any) => [t.type, t.id])
  );

  const endOfDay = new Date(dateStr + "T23:59:59.999Z");

  for (const s of slots) {
    const templateId = tplByType[s.type];
    if (!templateId) continue;

    const existsRaw = await sql`
      SELECT 1 FROM user_quests uq2
      JOIN quest_templates qt2 ON uq2.quest_template_id = qt2.id
      WHERE uq2.username = ${username} AND qt2.type = ${s.type}
        AND (uq2.expires_at AT TIME ZONE 'UTC')::date = ${dateStr}::date
      LIMIT 1
    `;
    if (toRows(existsRaw).length > 0) continue;

    await sql`
      INSERT INTO user_quests
        (username, quest_template_id, status, progress, target, season_number, expires_at)
      VALUES
        (${username}, ${templateId}, 'active', 0, ${s.target}, ${seasonNumber}, ${endOfDay.toISOString()})
    `.catch(() => {});
  }

  return { created: true, quests: slots };
}
