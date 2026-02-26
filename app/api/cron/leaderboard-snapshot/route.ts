/**
 * Cron: Leaderboard snapshot before season start.
 * GET/POST /api/cron/leaderboard-snapshot
 * Target run: 17.02.2026 22:00 UTC (2h before Trial Season start 18.02.2026 00:00 UTC)
 * Captures pre-season leaderboard (hidden_cost, receipts_verified, streak) into season_leaderboard.
 */

import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { getPrimaryAdmin } from "@/lib/auth/admin-users";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const DEFAULT_SEASON_ID = 1; // Trial Season

export async function GET(req: Request) {
  return runSnapshot(req);
}

export async function POST(req: Request) {
  return runSnapshot(req);
}

async function runSnapshot(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const seasonId = Number(process.env.LEADERBOARD_SNAPSHOT_SEASON_ID) || DEFAULT_SEASON_ID;

  try {
    // Pre-season leaderboard: hidden_cost DESC, receipts_verified DESC, streak DESC
    const honorFilter = sql`AND (up.honor IS NULL OR up.honor > 0)`;
    const rows = await sql`
      SELECT 
        up.username,
        COALESCE(up.season_xp, 0)::int as season_xp,
        COALESCE(up.streak, 0)::int as streak,
        COALESCE(SUM(r.hidden_cost_core) FILTER (WHERE r.status = 'analyzed' OR r.status = 'verified'), 0) as hidden_cost_uncovered,
        COUNT(*) FILTER (WHERE r.status = 'analyzed' OR r.status = 'verified') as receipts_verified
      FROM user_profiles up
      LEFT JOIN receipts r ON r.username = up.username
      WHERE up.username IS NOT NULL
        AND up.username != ${getPrimaryAdmin()}
        ${honorFilter}
      GROUP BY up.username, up.season_xp, up.streak
      HAVING COALESCE(SUM(r.hidden_cost_core) FILTER (WHERE r.status = 'analyzed' OR r.status = 'verified'), 0) > 0
         OR COUNT(*) FILTER (WHERE r.status = 'analyzed' OR r.status = 'verified') > 0
      ORDER BY hidden_cost_uncovered DESC, receipts_verified DESC, streak DESC
      LIMIT 1000
    `;

    const entries = (rows as any[]).map((row, idx) => ({
      season_id: seasonId,
      username: row.username,
      hidden_cost_score: parseFloat(row.hidden_cost_uncovered) || 0,
      trust_score: parseInt(row.receipts_verified, 10) || 0,
      badge_points: parseInt(row.streak, 10) || 0,
      quest_xp: parseInt(row.season_xp, 10) || 0,
      total_score: parseFloat(row.hidden_cost_uncovered) || 0,
      rank: idx + 1,
    }));

    if (entries.length === 0) {
      return NextResponse.json({ ok: true, inserted: 0, message: "No users to snapshot" });
    }

    // Upsert: ON CONFLICT (season_id, username) DO UPDATE
    let inserted = 0;
    for (const e of entries) {
      await sql`
        INSERT INTO season_leaderboard (season_id, username, hidden_cost_score, trust_score, badge_points, quest_xp, total_score, rank)
        VALUES (${e.season_id}, ${e.username}, ${e.hidden_cost_score}, ${e.trust_score}, ${e.badge_points}, ${e.quest_xp}, ${e.total_score}, ${e.rank})
        ON CONFLICT (season_id, username) DO UPDATE SET
          hidden_cost_score = EXCLUDED.hidden_cost_score,
          trust_score = EXCLUDED.trust_score,
          badge_points = EXCLUDED.badge_points,
          quest_xp = EXCLUDED.quest_xp,
          total_score = EXCLUDED.total_score,
          rank = EXCLUDED.rank
      `;
      inserted++;
    }

    return NextResponse.json({ ok: true, inserted, seasonId });
  } catch (e) {
    console.error("[api/cron/leaderboard-snapshot]", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
