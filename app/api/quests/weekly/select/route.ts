import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { sql, warmUpConnection } from "@/lib/db/client";

const WEEKLY_TYPES = ["W1A", "W1B", "W1C", "W2", "W3", "W4", "W5", "W6"];
const ACCOUNT_XP_TYPES = ["W2", "W5"];


function getWeekBounds(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + "Z");
  const day = d.getUTCDay();
  const start = new Date(d);
  start.setUTCDate(start.getUTCDate() - day);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 19).replace("T", " ") + ".999Z",
  };
}

export async function POST(req: Request) {
  try {
    const username = await getSessionUsername();
    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.DATABASE_URL || !sql) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const questType = body?.questType ?? body?.type;
    if (!questType || !WEEKLY_TYPES.includes(questType)) {
      return NextResponse.json({ error: "Invalid questType", valid: WEEKLY_TYPES }, { status: 400 });
    }

    await warmUpConnection();

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const { start, end } = getWeekBounds(todayStr);

    const existing = await sql`
      SELECT 1 FROM user_quests uq
      JOIN quest_templates qt ON uq.quest_template_id = qt.id
      WHERE uq.username = ${username}
        AND qt.type IN ('W1A','W1B','W1C','W2','W3','W4','W5','W6')
        AND uq.expires_at >= ${start}::date
      LIMIT 1
    `;

    if (Array.isArray(existing) && existing.length > 0) {
      return NextResponse.json({ error: "Already selected weekly quest for this week" }, { status: 400 });
    }

    const templateRow = await sql`
      SELECT id, reward_ryumo, reward_season_xp
      FROM quest_templates
      WHERE type = ${questType}
      LIMIT 1
    `;
    const template = Array.isArray(templateRow) ? templateRow[0] : null;
    if (!template) {
      return NextResponse.json({ error: "Quest template not found" }, { status: 404 });
    }

    const rewardRyumo = Number((template as any).reward_ryumo) ?? 220;
    const rewardSeasonXp = Number((template as any).reward_season_xp) ?? 500;
    const rewardAccountXp = ACCOUNT_XP_TYPES.includes(questType) ? 80 : 0;

    const seasonRow = await sql`
      SELECT season_number FROM seasons WHERE status = 'active' ORDER BY start_at DESC LIMIT 1
    `;
    const seasonNumber = Array.isArray(seasonRow) && seasonRow.length > 0 ? (seasonRow[0] as any).season_number ?? 1 : 1;

    await sql`
      INSERT INTO user_quests (username, quest_template_id, status, progress, target, season_number, expires_at)
      VALUES (${username}, ${(template as any).id}, 'active', 0, 1, ${seasonNumber}, ${end}::timestamptz)
    `;

    return NextResponse.json({
      ok: true,
      questType,
      rewardRyumo,
      rewardSeasonXp,
      rewardAccountXp,
      expiresAt: end,
    });
  } catch (error: any) {
    console.error("[api/quests/weekly/select] error:", error);
    return NextResponse.json(
      { error: "Failed to select weekly quest", details: error?.message ?? String(error) },
      { status: 500 }
    );
  }
}
