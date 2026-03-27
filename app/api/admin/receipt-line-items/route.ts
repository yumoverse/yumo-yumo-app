/**
 * Admin: receipt_line_items listesi — arama, sayfalama, özet istatistikler.
 * GET ?q=&limit=100&offset=0
 */

import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { isAdminUser } from "@/lib/auth/admin-users";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  receipt_id: string;
  merchant_name: string | null;
  merchant_address: string | null;
  branch_info: string | null;
  merchant_country: string | null;
  merchant_city: string | null;
  merchant_district: string | null;
  merchant_neighborhood: string | null;
  extraction_date_value: string | null;
  created_at: string | null;
  raw_name: string | null;
  brand: string | null;
  canonical_name: string | null;
  category_lvl1: string | null;
  category_lvl2: string | null;
  quantity: string;
  unit_type: string | null;
  unit_price_gross: string | null;
  line_total_gross: string | null;
  confidence_score: string | null;
  reference_price: string | null;
};

type StatsRow = {
  total_items: string;
  receipts_with_items: string;
  items_with_brand: string;
  items_with_canonical: string;
  receipts_with_address: string;
  items_with_category: string;
};

export async function GET(req: Request) {
  try {
    const username = await getSessionUsername();
    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(username)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() || null;
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
    const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

    const conditions: string[] = ["1=1"];
    const params: (string | number)[] = [];
    let idx = 1;

    if (q) {
      conditions.push(
        `(rli.raw_name ILIKE $${idx} OR rli.brand ILIKE $${idx} OR rli.canonical_name::text ILIKE $${idx} OR rli.receipt_id::text ILIKE $${idx} OR r.merchant_name ILIKE $${idx})`
      );
      params.push(`%${q}%`);
      idx++;
    }

    const where = conditions.join(" AND ");

    // Toplam kayıt sayısı (filtered)
    const countResult = await db.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
       FROM receipt_line_items rli
       LEFT JOIN receipts r ON r.receipt_id = rli.receipt_id
       WHERE ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0]?.total ?? "0", 10);

    // Özet istatistikler (unfiltered — global tablo durumu)
    const statsResult = await db.query<StatsRow>(
      `SELECT
         COUNT(rli.*)::text                                             AS total_items,
         COUNT(DISTINCT rli.receipt_id)::text                          AS receipts_with_items,
         COUNT(rli.*) FILTER (WHERE rli.brand IS NOT NULL)::text       AS items_with_brand,
         COUNT(rli.*) FILTER (WHERE rli.canonical_name IS NOT NULL)::text AS items_with_canonical,
         COUNT(rli.*) FILTER (WHERE rli.category_lvl1 IS NOT NULL)::text AS items_with_category,
         COUNT(DISTINCT rli.receipt_id) FILTER (
           WHERE COALESCE(
             r.receipt_data->>'merchantAddress',
             r.receipt_data->'merchant'->>'address'
           ) IS NOT NULL
         )::text AS receipts_with_address
       FROM receipt_line_items rli
       LEFT JOIN receipts r ON r.receipt_id = rli.receipt_id`,
      []
    );
    const stats = statsResult.rows[0] ?? {
      total_items: "0",
      receipts_with_items: "0",
      items_with_brand: "0",
      items_with_canonical: "0",
      receipts_with_address: "0",
      items_with_category: "0",
    };

    // Sayfa verisi
    // merchant_address + branch_info: önce dedicated kolon (migration 037), yoksa receipt_data JSONB fallback
    // Böylece migration çalıştırılmamış olsa bile çalışır.
    params.push(limit, offset);
    const result = await db.query<Row>(
      `SELECT
         rli.id,
         rli.receipt_id,
         r.merchant_name,
         r.merchant_country,
         COALESCE(
           r.receipt_data->>'merchantAddress',
           r.receipt_data->'gptFullReceiptResult'->>'merchantAddress',
           r.receipt_data->'merchant'->>'address'
         ) AS merchant_address,
         COALESCE(
           r.receipt_data->>'branchInfo',
           r.receipt_data->'gptFullReceiptResult'->>'branchInfo'
         ) AS branch_info,
         COALESCE(r.merchant_city, r.receipt_data->>'addressCity', r.receipt_data->'gptFullReceiptResult'->>'addressCity') AS merchant_city,
         COALESCE(r.merchant_district, r.receipt_data->>'addressDistrict', r.receipt_data->'gptFullReceiptResult'->>'addressDistrict') AS merchant_district,
         COALESCE(r.merchant_neighborhood, r.receipt_data->>'addressNeighborhood', r.receipt_data->'gptFullReceiptResult'->>'addressNeighborhood') AS merchant_neighborhood,
         r.extraction_date_value,
         r.created_at::text AS created_at,
         rli.raw_name,
         rli.brand,
         rli.canonical_name,
         rli.category_lvl1,
         rli.category_lvl2,
         rli.quantity::text,
         rli.unit_type,
         rli.unit_price_gross::text,
         rli.line_total_gross::text,
         rli.confidence_score::text,
         rli.reference_price::text
       FROM receipt_line_items rli
       LEFT JOIN receipts r ON r.receipt_id = rli.receipt_id
       WHERE ${where}
       ORDER BY rli.receipt_id DESC, rli.id ASC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const items = result.rows.map((r) => ({
      id: r.id,
      receiptId: r.receipt_id,
      merchantName: r.merchant_name,
      merchantCountry: r.merchant_country,
      merchantAddress: r.merchant_address,
      branchInfo: r.branch_info,
      merchantCity: r.merchant_city,
      merchantDistrict: r.merchant_district,
      merchantNeighborhood: r.merchant_neighborhood,
      extractionDate: r.extraction_date_value,
      systemAddedAt: r.created_at,
      rawName: r.raw_name,
      brand: r.brand,
      canonicalName: r.canonical_name,
      categoryLvl1: r.category_lvl1,
      categoryLvl2: r.category_lvl2,
      quantity: parseFloat(r.quantity) || 0,
      unitType: r.unit_type,
      unitPriceGross: r.unit_price_gross == null ? null : parseFloat(r.unit_price_gross),
      lineTotalGross: r.line_total_gross == null ? null : parseFloat(r.line_total_gross),
      confidenceScore: r.confidence_score == null ? null : parseFloat(r.confidence_score),
      referencePrice: r.reference_price == null ? null : parseFloat(r.reference_price),
    }));

    return NextResponse.json({
      items,
      total,
      stats: {
        totalItems: parseInt(stats.total_items, 10),
        receiptsWithItems: parseInt(stats.receipts_with_items, 10),
        itemsWithBrand: parseInt(stats.items_with_brand, 10),
        itemsWithCanonical: parseInt(stats.items_with_canonical, 10),
        receiptsWithAddress: parseInt(stats.receipts_with_address, 10),
        itemsWithCategory: parseInt(stats.items_with_category, 10),
      },
    });
  } catch (e) {
    console.error("[api/admin/receipt-line-items] GET error:", e);
    return NextResponse.json({ error: "Failed to fetch receipt line items" }, { status: 500 });
  }
}
