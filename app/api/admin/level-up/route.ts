import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { getSql, warmUpConnection } from "@/lib/db/client";
import { getAccountLevelFromXp } from "@/config/account-level-config";
import { getSeasonLevelFromXp } from "@/config/season-level-config";
import { ACCOUNT_LEVEL_XP_THRESHOLDS } from "@/config/account-level-config";
import { SEASON_LEVEL_XP_THRESHOLDS } from "@/config/season-level-config";

import { isAdminUser } from "@/lib/auth/admin-users";

function toRows(r: unknown): unknown[] {
  if (Array.isArray(r)) return r;
  if (r && typeof r === "object" && "rows" in r && Array.isArray((r as { rows: unknown }).rows))
    return (r as { rows: unknown[] }).rows;
  return [];
}


/**
 * POST /api/admin/level-up
 * Sadece admin: account ve season XP'i bir sonraki level eşiğine çeker (level atlatır).
 * Test için (örn. konfeti görmek).
 */
export async function POST() {
  try {
    const username = await getSessionUsername();
    if (!username || !isAdminUser(username)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }
    await warmUpConnection();

    const profileResult = await sql`
      SELECT COALESCE(account_xp, 0)::int AS account_xp, COALESCE(season_xp, 0)::int AS season_xp
      FROM user_profiles WHERE username = ${username} LIMIT 1
    `;
    const row = toRows(profileResult)[0] as { account_xp?: number; season_xp?: number } | undefined;
    if (!row) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const currentAccountXp = Number(row.account_xp) ?? 0;
    const currentSeasonXp = Number(row.season_xp) ?? 0;
    const currentAccountLevel = getAccountLevelFromXp(currentAccountXp);
    const currentSeasonLevel = getSeasonLevelFromXp(currentSeasonXp);

    // Bir sonraki level eşiği: currentLevel (1-based) = threshold index for next level; max'da kal
    const nextAccountIdx = Math.min(currentAccountLevel, ACCOUNT_LEVEL_XP_THRESHOLDS.length - 1);
    const nextSeasonIdx = Math.min(currentSeasonLevel, SEASON_LEVEL_XP_THRESHOLDS.length - 1);
    const newAccountXp = ACCOUNT_LEVEL_XP_THRESHOLDS[nextAccountIdx];
    const newSeasonXp = SEASON_LEVEL_XP_THRESHOLDS[nextSeasonIdx];
    const newAccountLevel = getAccountLevelFromXp(newAccountXp);
    const newSeasonLevel = getSeasonLevelFromXp(newSeasonXp);

    await sql`
      UPDATE user_profiles
      SET account_xp = ${newAccountXp}, account_level = ${newAccountLevel},
          season_xp = ${newSeasonXp}, season_level = ${newSeasonLevel},
          updated_at = now()
      WHERE username = ${username}
    `;

    return NextResponse.json({
      ok: true,
      accountLevel: newAccountLevel,
      seasonLevel: newSeasonLevel,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[api/admin/level-up] error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
