/**
 * Internal: Trust worker (Oracle plan).
 * POST /api/internal/trust-update?receiptId=...
 * Updates user_trust_scores + user_trust_score_history from receipt_quality.tier,
 * gelir aşımı, geç yükleme, archetype. Called fire-and-forget after Faz2.
 *
 * Requires Authorization: Bearer <INTERNAL_SECRET> header.
 */

import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { grantReceiptXpAndUpdateLevels } from "@/lib/oracle/account-season-level";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIER_DELTA: Record<string, number> = { S: 20, A: 15, B: 10, C: 5 };

function checkInternalAuth(req: Request): boolean {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!checkInternalAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const receiptId = searchParams.get("receiptId");
  if (!receiptId || receiptId.trim() === "") {
    return NextResponse.json({ error: "receiptId required" }, { status: 400 });
  }

  if (!sql) {
    return NextResponse.json({ ok: false, error: "Database not available" }, { status: 503 });
  }

  try {
    const rows = await sql`
      SELECT r.username, rq.tier
      FROM receipts r
      LEFT JOIN receipt_quality rq ON rq.receipt_id = r.receipt_id
      WHERE r.receipt_id = ${receiptId.trim()}
      LIMIT 1
    `;
    const row = rows[0] as { username: string | null; tier: string | null } | undefined;
    if (!row?.username) {
      return NextResponse.json({ ok: true, skipped: "no_username" });
    }

    const delta = row.tier ? TIER_DELTA[row.tier] ?? 0 : 0;
    let newScore: number | null = null;

    if (delta > 0) {
      const current = await sql`
        SELECT trust_score, tier FROM user_trust_scores WHERE username = ${row.username}
        LIMIT 1
      `;
      let prevScore = 0;
      let prevTier = "G";
      if (current.length > 0) {
        prevScore = Number((current[0] as any).trust_score) || 0;
        prevTier = (current[0] as any).tier ?? "G";
      }
      newScore = Math.max(0, prevScore + delta);
      const newTier = scoreToTier(newScore);

      await sql`
        INSERT INTO user_trust_scores (username, trust_score, tier, updated_at)
        VALUES (${row.username}, ${newScore}, ${newTier}, now())
        ON CONFLICT (username) DO UPDATE SET
          trust_score = EXCLUDED.trust_score,
          tier = EXCLUDED.tier,
          updated_at = now()
      `;
      await sql`
        INSERT INTO user_trust_score_history (username, previous_score, new_score, previous_tier, new_tier, reason_type, reference_id)
        VALUES (${row.username}, ${prevScore}, ${newScore}, ${prevTier}, ${newTier}, 'receipt_quality', ${receiptId})
      `;
    }

    // Her onaylanan fişten XP ver (trust-update çağrıldığında level güncellemesi her zaman)
    let levelResult: { accountLevel: number; seasonLevel: number } | null = null;
    const res = await grantReceiptXpAndUpdateLevels(
      row.username,
      receiptId.trim(),
      row.tier
    );
    if (res) levelResult = { accountLevel: res.accountLevel, seasonLevel: res.seasonLevel };

    return NextResponse.json({
      ok: true,
      username: row.username,
      delta,
      ...(newScore != null && { newScore }),
      ...(levelResult && { accountLevel: levelResult.accountLevel, seasonLevel: levelResult.seasonLevel }),
    });
  } catch (err: any) {
    console.warn("[trust-update] Error:", err?.message);
    return NextResponse.json({ ok: false, error: err?.message }, { status: 500 });
  }
}

function scoreToTier(score: number): string {
  if (score >= 800) return "S";
  if (score >= 600) return "A";
  if (score >= 450) return "B";
  if (score >= 300) return "C";
  if (score >= 200) return "D";
  if (score >= 100) return "E";
  if (score >= 50) return "F";
  return "G";
}
