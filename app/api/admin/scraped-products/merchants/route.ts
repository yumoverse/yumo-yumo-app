/**
 * Admin: distinct merchant_canonical_name from scraped_product_prices (for filter dropdown).
 */

import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { isAdminUser } from "@/lib/auth/admin-users";

export const dynamic = "force-dynamic";

export async function GET() {
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

    const result = await db.query<{ merchant_canonical_name: string }>(
      `SELECT DISTINCT merchant_canonical_name FROM scraped_product_prices ORDER BY merchant_canonical_name`
    );
    const merchants = result.rows.map((r) => r.merchant_canonical_name);

    return NextResponse.json({ merchants });
  } catch (e) {
    console.error("[api/admin/scraped-products/merchants] GET error:", e);
    return NextResponse.json(
      { error: "Failed to fetch merchants" },
      { status: 500 }
    );
  }
}
