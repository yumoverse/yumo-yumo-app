import { NextResponse } from "next/server";
import { getSql, warmUpConnection } from "@/lib/db/client";
import { ensureDailyQuestsForUser } from "@/lib/quests/daily-generator";
import { getSessionUsername } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/admin-users";

export async function POST() {
  try {
    const username = await getSessionUsername();
    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json(
        { error: "Database not available", ok: false },
        { status: 503 }
      );
    }

    await warmUpConnection();

    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayStr = today.toISOString().slice(0, 10);
    const isAdmin = isAdminUser(username);

    // Admin için bugün check-in zaten varsa sil, tekrar kullanılabilir olsun
    if (isAdmin) {
      await sql`
        DELETE FROM check_ins
        WHERE username = ${username} AND check_in_date = ${todayStr}::date
      `;
    }

    const insertResult = await sql`
      INSERT INTO check_ins (username, check_in_date)
      VALUES (${username}, ${todayStr}::date)
      ON CONFLICT (username, check_in_date) DO NOTHING
      RETURNING id
    `;
    const insertRows = Array.isArray(insertResult) ? insertResult : (insertResult as { rows?: unknown[] })?.rows ?? [];
    const wasNew = insertRows.length > 0;

    const datesResult = await sql`
      SELECT DISTINCT check_in_date::text as d
      FROM check_ins
      WHERE username = ${username}
      ORDER BY d DESC
      LIMIT 100
    `;
    const datesRows = Array.isArray(datesResult) ? datesResult : (datesResult as { rows?: { d: string }[] })?.rows ?? [];
    const dates = new Set(datesRows.map((r) => r.d));
    let streak = 0;
    const todayCheck = todayStr;
    if (dates.has(todayCheck)) {
      let d = new Date(today);
      while (dates.has(d.toISOString().slice(0, 10))) {
        streak++;
        d.setUTCDate(d.getUTCDate() - 1);
      }
    } else {
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      if (dates.has(yesterdayStr)) {
        let d = new Date(yesterday);
        while (dates.has(d.toISOString().slice(0, 10))) {
          streak++;
          d.setUTCDate(d.getUTCDate() - 1);
        }
      }
    }

    try {
      await sql`
        UPDATE user_profiles
        SET streak = ${streak}, updated_at = now()
        WHERE username = ${username}
      `;
    } catch (upErr: unknown) {
      console.warn("[api/check-in] user_profiles streak update failed:", upErr);
    }

    if (wasNew) {
      try {
        const seasonRow = await sql`
          SELECT season_number FROM seasons WHERE status = 'active' ORDER BY start_at DESC LIMIT 1
        `;
        const seasonRows = Array.isArray(seasonRow) ? seasonRow : (seasonRow as { rows?: { season_number: number }[] })?.rows ?? [];
        const seasonNumber = (seasonRows[0] as { season_number?: number } | undefined)?.season_number ?? 1;
        await ensureDailyQuestsForUser(username, todayStr, seasonNumber);

        // Set D1 quest progress to 1 so the "Complete Mission" button becomes active.
        // The reward is intentionally NOT dispatched here — the user must click the button.
        await sql`
          UPDATE user_quests uq
          SET progress = 1, updated_at = now()
          FROM quest_templates qt
          WHERE uq.quest_template_id = qt.id
            AND uq.username = ${username}
            AND qt.type = 'D1'
            AND (uq.expires_at AT TIME ZONE 'UTC')::date = ${todayStr}::date
            AND uq.status = 'active'
        `;
      } catch (d1Err: unknown) {
        console.warn("[api/check-in] D1 progress update failed:", d1Err);
      }
    }

    return NextResponse.json({
      ok: true,
      streak,
      alreadyCheckedIn: !wasNew,
      date: todayStr,
      d1Ready: wasNew,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[api/check-in] error:", error);
    const isMissingTable =
      /relation "check_ins" does not exist|table "check_ins"|relation "user_profiles".*streak|column "streak" does not exist/i.test(msg);
    const hint = isMissingTable
      ? "Run migration 018 (018_quest_and_checkin.sql) in Neon Console or: npx tsx scripts/run-migration.ts 018_quest_and_checkin.sql"
      : undefined;
    return NextResponse.json(
      {
        error: "Check-in failed",
        details: msg,
        hint,
        ok: false,
      },
      { status: isMissingTable ? 503 : 500 }
    );
  }
}
