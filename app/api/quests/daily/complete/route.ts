import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { getSql, warmUpConnection } from "@/lib/db/client";
import { dispatchQuestReward } from "@/lib/quests/reward-dispatcher";

function toRows(r: unknown): any[] {
  if (Array.isArray(r)) return r;
  if (r && typeof r === "object" && "rows" in r && Array.isArray((r as { rows: unknown }).rows))
    return (r as { rows: any[] }).rows;
  return [];
}


/**
 * POST /api/quests/daily/complete
 * Body: { questId: number }
 * Şartlar karşılanıyorsa (progress >= target) görevi tamamlar, ödül dağıtır.
 * levelUp: 'account' | 'season' | 'both' | null döner (konfeti için).
 */
export async function POST(req: Request) {
  try {
    const username = await getSessionUsername();
    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    await warmUpConnection();

    const body = await req.json().catch(() => ({}));
    const questId = typeof body.questId === "number" ? body.questId : Number(body.questId);
    if (!Number.isInteger(questId) || questId <= 0) {
      return NextResponse.json(
        { error: "Invalid questId", ok: false },
        { status: 400 }
      );
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    const questResult = await sql`
      SELECT uq.id, uq.progress, uq.target, uq.status, uq.season_number,
             qt.type, qt.reward_ryumo, qt.reward_season_xp
      FROM user_quests uq
      JOIN quest_templates qt ON uq.quest_template_id = qt.id
      WHERE uq.id = ${questId} AND uq.username = ${username}
        AND (uq.expires_at AT TIME ZONE 'UTC')::date = ${todayStr}::date
    `;
    const questRows = toRows(questResult);
    const quest = questRows[0] as { id: number; progress: number; target: number; status: string; season_number: number; type: string; reward_ryumo: number; reward_season_xp: number } | undefined;

    if (!quest) {
      return NextResponse.json(
        { error: "Quest not found or not today's quest", ok: false },
        { status: 404 }
      );
    }

    if (quest.status === "completed") {
      return NextResponse.json(
        { error: "Quest already completed", ok: false },
        { status: 400 }
      );
    }

    const progress = Number(quest.progress) ?? 0;
    const target = Number(quest.target) ?? 1;
    if (progress < target) {
      return NextResponse.json(
        { error: "Conditions not met", ok: false, progress, target },
        { status: 400 }
      );
    }

    const profileBeforeResult = await sql`
      SELECT COALESCE(account_level, 1)::int as account_level, COALESCE(season_level, 1)::int as season_level
      FROM user_profiles WHERE username = ${username} LIMIT 1
    `;
    const profileBefore = toRows(profileBeforeResult)[0] as { account_level?: number; season_level?: number } | undefined;
    const beforeAccount = profileBefore?.account_level ?? 1;
    const beforeSeason = profileBefore?.season_level ?? 1;

    const seasonNumber = Number(quest.season_number) || 1;
    const rewardRyumo = Number(quest.reward_ryumo) ?? 12;
    const rewardSeasonXp = Number(quest.reward_season_xp) ?? 60;

    const result = await dispatchQuestReward(
      username,
      quest.id,
      quest.type,
      rewardRyumo,
      rewardSeasonXp,
      seasonNumber
    );

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Reward failed", ok: false },
        { status: 500 }
      );
    }

    const profileAfterResult = await sql`
      SELECT COALESCE(account_level, 1)::int as account_level, COALESCE(season_level, 1)::int as season_level
      FROM user_profiles WHERE username = ${username} LIMIT 1
    `;
    const profileAfter = toRows(profileAfterResult)[0] as { account_level?: number; season_level?: number } | undefined;
    const afterAccount = profileAfter?.account_level ?? 1;
    const afterSeason = profileAfter?.season_level ?? 1;

    let levelUp: "account" | "season" | "both" | null = null;
    if (afterAccount > beforeAccount && afterSeason > beforeSeason) levelUp = "both";
    else if (afterAccount > beforeAccount) levelUp = "account";
    else if (afterSeason > beforeSeason) levelUp = "season";

    return NextResponse.json({
      ok: true,
      levelUp,
      accountLevel: afterAccount,
      seasonLevel: afterSeason,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/quests/daily/complete] error:", err);
    return NextResponse.json(
      { error: "Failed to complete quest", details: msg, ok: false },
      { status: 500 }
    );
  }
}
