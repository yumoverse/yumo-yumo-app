import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/admin-users";
import { getUserProfile, saveUserProfile } from "@/lib/storage/user-profile-storage";
import { sql, warmUpConnection } from "@/lib/db/client";
import { reconcileQuestXpForUser } from "@/lib/quests/reconcile-quest-xp";
import { getAccountLevelFromXp } from "@/config/account-level-config";
import { getSeasonLevelFromXp } from "@/config/season-level-config";

function toRows(r: unknown): unknown[] {
  if (Array.isArray(r)) return r;
  if (r && typeof r === "object" && "rows" in r && Array.isArray((r as { rows: unknown }).rows))
    return (r as { rows: unknown[] }).rows;
  return [];
}

export async function GET() {
  try {
    const username = await getSessionUsername();

    if (!username) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const profile = await getUserProfile(username);

    const base = {
      username,
      displayName: profile?.displayName || null,
      gender: profile?.gender || null,
      birthDate: profile?.birthDate || null,
      honor: profile?.honor ?? 50,
      occupation: profile?.occupation || null,
    };

    if (!process.env.DATABASE_URL || !sql) {
      return NextResponse.json({
        ...base,
        accountLevel: 1,
        accountXp: 0,
        seasonLevel: 1,
        seasonXp: 0,
        ayumo: 0,
        ryumo: 0,
        streak: 0,
        checkedInToday: false,
        declaredMonthlyIncomeBand: null,
        currentSeason: null,
      });
    }

    await warmUpConnection();
    await reconcileQuestXpForUser(username);

    const todayStr = new Date().toISOString().slice(0, 10);
    const [profileRow, ayumoRow, ryumoFromReceiptsRow, seasonRow, checkInResult] = await Promise.all([
      sql`
        SELECT account_level, account_xp, season_level, season_xp, ryumo_balance, streak, current_season_number,
               declared_monthly_income_band
        FROM user_profiles
        WHERE username = ${username}
      `.then((r) => toRows(r)[0] ?? null),
      sql`
        SELECT COALESCE(SUM(r.hidden_cost_core), 0)::float as ayumo
        FROM receipts r
        WHERE r.username = ${username}
          AND (r.status = 'analyzed' OR r.status = 'verified')
      `.then((r) => toRows(r)[0] ?? null).catch(() => ({ ayumo: 0 })),
      sql`
        SELECT COALESCE(SUM(rr.ryumo_bonus_amount), 0)::float as ryumo_receipts
        FROM receipts r
        LEFT JOIN receipt_rewards rr ON r.receipt_id = rr.receipt_id
        WHERE r.username = ${username}
          AND (r.status = 'analyzed' OR r.status = 'verified')
      `.then((r) => toRows(r)[0] ?? null).catch(() => ({ ryumo_receipts: 0 })),
      sql`
        SELECT id, season_number, name, start_at, end_at
        FROM seasons
        WHERE status = 'active'
        ORDER BY start_at DESC
        LIMIT 1
      `.then((r) => toRows(r)[0] ?? null),
      sql`
        SELECT 1 FROM check_ins WHERE username = ${username} AND check_in_date = ${todayStr}::date LIMIT 1
      `.then((r) => toRows(r).length > 0).catch(() => false),
    ]);

    const p = profileRow as { account_level?: number; account_xp?: number; season_level?: number; season_xp?: number; ryumo_balance?: number | string; streak?: number; declared_monthly_income_band?: string | null } | null;
    const checkedInToday = checkInResult === true;
    const ayumoRaw = (ayumoRow as { ayumo?: number | string } | null)?.ayumo ?? 0;
    const ayumo = Number(ayumoRaw) || 0;
    const ryumoQuest = Number(p?.ryumo_balance ?? 0) || 0;
    const ryumoReceipts = Number((ryumoFromReceiptsRow as { ryumo_receipts?: number | string } | null)?.ryumo_receipts ?? 0) || 0;
    const ryumo = ryumoQuest + ryumoReceipts;
    const season = seasonRow as { id?: number; season_number?: number; name?: string; start_at?: string; end_at?: string } | null;

    // Her zaman XP'den level'ı türet — DB'deki stale değere güvenme
    const accountXp = p?.account_xp ?? 0;
    const seasonXp = p?.season_xp ?? 0;
    const accountLevel = getAccountLevelFromXp(accountXp);
    const seasonLevel = getSeasonLevelFromXp(seasonXp);

    // DB'de level stale kalmışsa sessizce güncelle (self-healing)
    const storedAccountLevel = p?.account_level ?? 1;
    const storedSeasonLevel = p?.season_level ?? 1;
    if (storedAccountLevel !== accountLevel || storedSeasonLevel !== seasonLevel) {
      sql`
        UPDATE user_profiles
        SET account_level = ${accountLevel}, season_level = ${seasonLevel}, updated_at = now()
        WHERE username = ${username}
      `.catch((e) => console.warn("[api/user/profile] level heal failed:", e));
    }

    return NextResponse.json(
      {
        ...base,
        isAdmin: isAdminUser(username),
        accountLevel,
        accountXp,
        seasonLevel,
        seasonXp,
        ayumo,
        ryumo,
        streak: p?.streak ?? 0,
        checkedInToday: checkedInToday ?? false,
        declaredMonthlyIncomeBand: p?.declared_monthly_income_band ?? null,
        currentSeason: season
          ? {
              id: season.id,
              seasonNumber: season.season_number,
              name: season.name,
              startAt: season.start_at,
              endAt: season.end_at,
            }
          : null,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      }
    );
  } catch (error: any) {
    console.error("[api/user/profile] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to get user profile",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    // Get username from cookie
    const username = await getSessionUsername();

    if (!username) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { displayName, gender, birthDate, occupation, declaredMonthlyIncomeBand } = body;

    // Validate displayName
    if (!displayName || !displayName.trim()) {
      return NextResponse.json(
        { error: "Display name is required" },
        { status: 400 }
      );
    }

    // Save profile (storage + optional DB income band)
    await saveUserProfile({
      username,
      displayName: displayName.trim(),
      gender: gender || undefined,
      birthDate: birthDate || undefined,
      occupation: occupation != null && occupation !== "" ? String(occupation).trim() : undefined,
    });

    if (process.env.DATABASE_URL && sql) {
      await warmUpConnection();
      const incomeBand = declaredMonthlyIncomeBand != null && declaredMonthlyIncomeBand !== "" ? String(declaredMonthlyIncomeBand) : null;
      await sql`
        UPDATE user_profiles
        SET declared_monthly_income_band = ${incomeBand}, updated_at = CURRENT_TIMESTAMP
        WHERE username = ${username}
      `;
    }

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error: any) {
    console.error("[api/user/profile] POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to update user profile",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}



