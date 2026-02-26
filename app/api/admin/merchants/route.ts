/**
 * Admin: list canonical merchants with optional tier filter.
 * GET ?tier=unverified|candidate|verified (omit = all)
 */

import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { db } from "@/lib/db/client";

import { isAdminUser } from "@/lib/auth/admin-users";

export const dynamic = "force-dynamic";

type MerchantRow = {
  id: string;
  canonical_name: string;
  display_name: string;
  category: string;
  tier: string;
  country_code: string | null;
  created_at: string;
  pattern_count: string;
};

export async function GET(req: Request) {
  try {
    const username = await getSessionUsername();
    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(username)) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const tier = searchParams.get("tier")?.toLowerCase();
    const validTiers = ["unverified", "candidate", "verified"];
    const tierFilter =
      tier && validTiers.includes(tier) ? tier : null;

    let rows: MerchantRow[];
    if (tierFilter) {
      const result = await db.query<MerchantRow>(
        `SELECT m.id, m.canonical_name, m.display_name, m.category, m.tier, m.country_code, m.created_at,
                (SELECT COUNT(*)::text FROM merchant_patterns mp WHERE mp.merchant_id = m.id) AS pattern_count
         FROM merchants m
         WHERE m.tier = $1
         ORDER BY m.created_at DESC`,
        [tierFilter]
      );
      rows = result.rows;
    } else {
      const result = await db.query<MerchantRow>(
        `SELECT m.id, m.canonical_name, m.display_name, m.category, m.tier, m.country_code, m.created_at,
                (SELECT COUNT(*)::text FROM merchant_patterns mp WHERE mp.merchant_id = m.id) AS pattern_count
         FROM merchants m
         ORDER BY m.created_at DESC`
      );
      rows = result.rows;
    }

    const merchants = rows.map((r) => ({
      id: r.id,
      canonicalName: r.canonical_name,
      displayName: r.display_name,
      category: r.category,
      tier: r.tier,
      countryCode: r.country_code,
      createdAt: r.created_at,
      patternCount: parseInt(r.pattern_count, 10) || 0,
    }));

    return NextResponse.json({ merchants });
  } catch (e) {
    console.error("[api/admin/merchants] GET error:", e);
    return NextResponse.json(
      { error: "Failed to fetch merchants" },
      { status: 500 }
    );
  }
}
