import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { sql, warmUpConnection } from "@/lib/db/client";


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
    end: end.toISOString().slice(0, 10),
  };
}

export async function GET() {
  try {
    const username = await getSessionUsername();
    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.DATABASE_URL || !sql) {
      return NextResponse.json({ weekly: null, options: [] });
    }

    await warmUpConnection();

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const { start, end } = getWeekBounds(todayStr);

    const weeklyRow = await sql`
      SELECT uq.id, uq.progress, uq.target, uq.status, uq.completed_at, uq.created_at,
             qt.type, qt.title, qt.reward_ryumo, qt.reward_season_xp
      FROM user_quests uq
      JOIN quest_templates qt ON uq.quest_template_id = qt.id
      WHERE uq.username = ${username}
        AND qt.type IN ('W1A','W1B','W1C','W2','W3','W4','W5','W6')
        AND uq.expires_at >= ${start}::date
      ORDER BY uq.created_at DESC
      LIMIT 1
    `;

    const weekly = Array.isArray(weeklyRow) && weeklyRow.length > 0 ? weeklyRow[0] : null;

    if (weekly) {
      return NextResponse.json({
        weekly: {
          id: (weekly as any).id,
          type: (weekly as any).type,
          title: (weekly as any).title,
          progress: Number((weekly as any).progress) ?? 0,
          target: Number((weekly as any).target) ?? 1,
          status: (weekly as any).status,
          completedAt: (weekly as any).completed_at,
          rewardRyumo: Number((weekly as any).reward_ryumo) ?? 220,
          rewardSeasonXp: Number((weekly as any).reward_season_xp) ?? 500,
        },
        options: [],
      });
    }

    const optionsRows = await sql`
      SELECT id, type, title, reward_ryumo, reward_season_xp
      FROM quest_templates
      WHERE type IN ('W1A','W1B','W1C','W2','W3','W4','W5','W6')
    `;

    const options = (Array.isArray(optionsRows) ? optionsRows : []).map((r: any) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      rewardRyumo: Number(r.reward_ryumo) ?? 220,
      rewardSeasonXp: Number(r.reward_season_xp) ?? 500,
    }));

    return NextResponse.json({
      weekly: null,
      options,
      weekStart: start,
      weekEnd: end,
    });
  } catch (error: any) {
    console.error("[api/quests/weekly] error:", error);
    return NextResponse.json(
      { error: "Failed to load weekly quest", details: error?.message ?? String(error) },
      { status: 500 }
    );
  }
}
