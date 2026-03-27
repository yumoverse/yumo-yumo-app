/**
 * Admin: list scraped_product_prices (Migros / Starbucks vb.) with search and pagination.
 * GET ?q=...&merchant=...&limit=100&offset=0
 */

import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { isAdminUser } from "@/lib/auth/admin-users";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  merchant_canonical_name: string;
  raw_name: string;
  canonical_name: string | null;
  price_tl: string;
  unit: string | null;
  scraped_at: string;
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
    const q = searchParams.get("q")?.trim() || null;
    const merchant = searchParams.get("merchant")?.trim() || null;
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const conditions: string[] = ["1=1"];
    const params: (string | number)[] = [];
    let idx = 1;

    if (q) {
      conditions.push(`(raw_name ILIKE $${idx} OR canonical_name::text ILIKE $${idx})`);
      params.push(`%${q}%`);
      idx++;
    }
    if (merchant) {
      conditions.push(`merchant_canonical_name = $${idx}`);
      params.push(merchant);
      idx++;
    }

    const where = conditions.join(" AND ");
    const countResult = await db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM scraped_product_prices WHERE ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total ?? "0", 10);

    params.push(limit, offset);
    const result = await db.query<Row>(
      `SELECT id, merchant_canonical_name, raw_name, canonical_name, price_tl, unit, scraped_at
       FROM scraped_product_prices
       WHERE ${where}
       ORDER BY scraped_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const items = result.rows.map((r) => ({
      id: r.id,
      merchantCanonicalName: r.merchant_canonical_name,
      rawName: r.raw_name,
      canonicalName: r.canonical_name,
      priceTl: r.price_tl == null ? null : parseFloat(r.price_tl),
      unit: r.unit,
      scrapedAt: r.scraped_at,
    }));

    return NextResponse.json({ items, total });
  } catch (e) {
    console.error("[api/admin/scraped-products] GET error:", e);
    return NextResponse.json(
      { error: "Failed to fetch scraped products" },
      { status: 500 }
    );
  }
}
