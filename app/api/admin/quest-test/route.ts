import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { getSql, warmUpConnection } from "@/lib/db/client";

const TEST_QUEST_TYPE = "TEST_180";
const TEST_REWARD_SEASON_XP = 180;
const TEST_REWARD_RYUMO = 0;
import { isAdminUser } from "@/lib/auth/admin-users";

function toRows(r: unknown): any[] {
  if (Array.isArray(r)) return r;
  if (r && typeof r === "object" && "rows" in r && Array.isArray((r as { rows: unknown }).rows))
    return (r as { rows: any[] }).rows;
  return [];
}


/**
 * GET: Mevcut kullanıcının bugünkü test görevini döner (varsa).
 * POST: 180 XP, tamamlanmış test görevini oluşturur (veya zaten varsa onu döner).
 */
export async function GET() {
  try {
    const username = await getSessionUsername();
    if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminUser(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const sql = getSql();
    if (!sql) return NextResponse.json({ error: "Database not available" }, { status: 503 });
    await warmUpConnection();

    const todayStr = new Date().toISOString().slice(0, 10);
    const endOfDay = new Date(todayStr + "T23:59:59.999Z").toISOString();

    const row = await sql`
      SELECT uq.id, uq.status, uq.progress, uq.target, qt.reward_ryumo, qt.reward_season_xp
      FROM user_quests uq
      JOIN quest_templates qt ON uq.quest_template_id = qt.id
      WHERE uq.username = ${username} AND qt.type = ${TEST_QUEST_TYPE}
        AND (uq.expires_at AT TIME ZONE 'UTC')::date = ${todayStr}::date
      LIMIT 1
    `;
    const rows = toRows(row);
    const q = rows[0] as { id: number; status: string; progress: number; target: number; reward_ryumo: number; reward_season_xp: number } | undefined;
    if (!q) {
      return NextResponse.json({ hasQuest: false });
    }
    return NextResponse.json({
      hasQuest: true,
      questId: q.id,
      status: q.status,
      progress: q.progress,
      target: q.target,
      rewardRyumo: Number(q.reward_ryumo) ?? 0,
      rewardSeasonXp: Number(q.reward_season_xp) ?? TEST_REWARD_SEASON_XP,
    });
  } catch (err: unknown) {
    console.error("[api/admin/quest-test] GET error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST() {
  try {
    const username = await getSessionUsername();
    if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminUser(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const sql = getSql();
    if (!sql) return NextResponse.json({ error: "Database not available" }, { status: 503 });
    await warmUpConnection();

    const todayStr = new Date().toISOString().slice(0, 10);
    const endOfDay = new Date(todayStr + "T23:59:59.999Z").toISOString();

    let templateId: number;
    const existingTemplate = await sql`
      SELECT id FROM quest_templates WHERE type = ${TEST_QUEST_TYPE} LIMIT 1
    `;
    const tRows = toRows(existingTemplate);
    if (tRows.length > 0) {
      templateId = (tRows[0] as { id: number }).id;
    } else {
      const inserted = await sql`
        INSERT INTO quest_templates (type, title, reward_ryumo, reward_season_xp, min_account_level, min_season_level)
        VALUES (${TEST_QUEST_TYPE}, 'Test 180 XP (tamamlanmış)', ${TEST_REWARD_RYUMO}, ${TEST_REWARD_SEASON_XP}, 1, 1)
        RETURNING id
      `;
      const ins = toRows(inserted);
      templateId = (ins[0] as { id: number }).id;
    }

    const seasonRow = await sql`
      SELECT season_number FROM seasons WHERE status = 'active' ORDER BY start_at DESC LIMIT 1
    `;
    const seasonRows = toRows(seasonRow);
    const seasonNumber = (seasonRows[0] as { season_number?: number })?.season_number ?? 1;

    const existingQuest = await sql`
      SELECT uq.id FROM user_quests uq
      JOIN quest_templates qt ON uq.quest_template_id = qt.id
      WHERE uq.username = ${username} AND qt.type = ${TEST_QUEST_TYPE}
        AND (uq.expires_at AT TIME ZONE 'UTC')::date = ${todayStr}::date
      LIMIT 1
    `;
    const eq = toRows(existingQuest);
    if (eq.length > 0) {
      const id = (eq[0] as { id: number }).id;
      await sql`
        UPDATE user_quests SET status = 'active', progress = 1, target = 1, completed_at = NULL, updated_at = now()
        WHERE id = ${id} AND username = ${username}
      `;
      return NextResponse.json({
        created: false,
        reset: true,
        questId: id,
        rewardSeasonXp: TEST_REWARD_SEASON_XP,
        rewardRyumo: TEST_REWARD_RYUMO,
      });
    }

    await sql`
      INSERT INTO user_quests (username, quest_template_id, status, progress, target, season_number, expires_at, updated_at)
      VALUES (${username}, ${templateId}, 'active', 1, 1, ${seasonNumber}, ${endOfDay}::timestamptz, now())
    `;

    const fetchNew = await sql`
      SELECT uq.id FROM user_quests uq
      JOIN quest_templates qt ON uq.quest_template_id = qt.id
      WHERE uq.username = ${username} AND qt.type = ${TEST_QUEST_TYPE}
        AND (uq.expires_at AT TIME ZONE 'UTC')::date = ${todayStr}::date
      LIMIT 1
    `;
    const newRows = toRows(fetchNew);
    const newId = (newRows[0] as { id: number }).id;

    return NextResponse.json({
      created: true,
      questId: newId,
      rewardSeasonXp: TEST_REWARD_SEASON_XP,
      rewardRyumo: TEST_REWARD_RYUMO,
    });
  } catch (err: unknown) {
    console.error("[api/admin/quest-test] POST error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
