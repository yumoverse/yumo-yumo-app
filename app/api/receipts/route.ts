import { NextResponse } from "next/server";
import { getAllReceipts, getAllReceiptsAll, getReceiptsByDateRange, getReceiptsForInsights, getReceiptsAllForInsights, getReceiptsByDateRangeForInsights, saveReceipt } from "@/lib/receipt/storage-db";
import { getReceiptCount, getReceiptCountAll } from "@/lib/receipt/db/queries/select";
import type { ReceiptAnalysis } from "@/lib/receipt/types";
import { getSql, warmUpConnection } from "@/lib/db/client";
import { getSessionUsername } from "@/lib/auth/session";
import { updateDailyQuestProgressOnReceiptSaved } from "@/lib/quests/update-progress-on-receipt";
import { isAdminUser } from "@/lib/auth/admin-users";

/** Receipt listesindeki her kayda user_profiles.display_name ekler (görünen ad). */
async function enrichReceiptsWithDisplayNames(receipts: (ReceiptAnalysis & { displayName?: string | null })[]): Promise<(ReceiptAnalysis & { displayName?: string | null })[]> {
  const usernames = [...new Set(receipts.map((r) => r.username).filter(Boolean))] as string[];
  if (usernames.length === 0) return receipts;
  const sql = getSql();
  if (!sql) return receipts;
  try {
    await warmUpConnection();
    const rows = await sql`
      SELECT username, display_name
      FROM user_profiles
      WHERE username = ANY(${usernames})
    `;
    const map = new Map<string, string>();
    for (const row of Array.isArray(rows) ? rows : (rows as { rows?: { username: string; display_name: string | null }[] }).rows ?? []) {
      const r = row as { username: string; display_name: string | null };
      if (r.display_name) map.set(r.username, r.display_name);
    }
    return receipts.map((r) => ({ ...r, displayName: r.username ? map.get(r.username) ?? null : null }));
  } catch {
    return receipts;
  }
}

export async function GET(req: Request) {
  try {
    const username = await getSessionUsername();

    if (!username) {
      console.warn("[api/receipts] No username found in session");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query parameters for pagination and optional time range (for Insights)
    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get("timeRange") || null; // "7d" | "30d" | "90d" | "all" | null
    const forInsights = searchParams.get("forInsights") === "true"; // Slim ReceiptSummary payload for Insights page
    const page = parseInt(searchParams.get("page") || "1", 10); // Default page 1
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10); // Default 10 per page
    const search = searchParams.get("search") || "";
    const statusFilter = searchParams.get("statusFilter") || ""; // UI status value
    const maxPageSize = 1000; // Safety limit (Insights may request many when timeRange=all)

    // Map UI status values to DB status values
    function mapStatusToDbValues(uiStatus: string): string[] {
      switch (uiStatus) {
        case "VERIFIED": return ["verified", "saved"];
        case "analyzed": return ["analyzed"];
        case "REJECTED": return ["rejected"];
        case "PENDING": return ["pending"];
        case "scanned": return ["scanned"];
        case "verifiedOnly": return ["verified", "saved", "analyzed"];
        default: return [];
      }
    }
    const statusValues = mapStatusToDbValues(statusFilter);
    const safePageSize = Math.min(Math.max(1, pageSize), maxPageSize);
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safePageSize;
    const limit = safePageSize;

    const isAdmin = isAdminUser(username);

    // When timeRange is 7d/30d/90d, fetch by date range (non-admin only)
    if (!isAdmin && timeRange && ["7d", "30d", "90d"].includes(timeRange)) {
      const end = new Date();
      const start = new Date();
      if (timeRange === "7d") start.setDate(start.getDate() - 7);
      else if (timeRange === "30d") start.setDate(start.getDate() - 30);
      else if (timeRange === "90d") start.setDate(start.getDate() - 90);
      start.setHours(0, 0, 0, 0);
      if (forInsights) {
        const summaries = await getReceiptsByDateRangeForInsights(username, start, end);
        return NextResponse.json({ receipts: summaries, insightsFormat: true, pagination: { page: 1, pageSize: summaries.length, total: summaries.length, totalPages: 1 } });
      }
      const userReceipts = await getReceiptsByDateRange(username, start, end);
      const enriched = await enrichReceiptsWithDisplayNames(userReceipts);
      return NextResponse.json({
        receipts: enriched,
        pagination: {
          page: 1,
          pageSize: enriched.length,
          total: enriched.length,
          totalPages: 1,
        },
      });
    }

    // Insights: lightweight path (denormalized columns only, no receipt_data)
    if (forInsights) {
      const summaries = isAdmin
        ? await getReceiptsAllForInsights(limit, offset)
        : await getReceiptsForInsights(username, limit, offset);
      return NextResponse.json({
        receipts: summaries,
        insightsFormat: true,
        pagination: { page: safePage, pageSize: safePageSize, total: summaries.length, totalPages: Math.ceil(Math.max(1, summaries.length) / safePageSize) }
      });
    }

    // Get receipts and total count (all for admin, user's own for normal users)
    if (isAdmin) {
      console.log(`[api/receipts] 🔍 GET - Admin user, fetching ALL receipts (page: ${safePage}, pageSize: ${safePageSize}, search: "${search}", statusFilter: "${statusFilter}")`);
      const [allReceipts, totalCount] = await Promise.all([
        getAllReceiptsAll(limit, offset, search, statusValues),
        getReceiptCountAll(search, statusValues)
      ]);
      const enrichedAll = await enrichReceiptsWithDisplayNames(allReceipts);
      console.log(`[api/receipts] ✅ GET RESPONSE for admin: ${enrichedAll.length} receipts (total: ${totalCount}, page: ${safePage})`);
      return NextResponse.json({ 
        receipts: enrichedAll, 
        pagination: {
          page: safePage,
          pageSize: safePageSize,
          total: totalCount,
          totalPages: Math.ceil(totalCount / safePageSize)
        }
      });
    }
    
    console.log(`[api/receipts] 🔍 GET - Calling getAllReceipts with username: "${username}" (page: ${safePage}, pageSize: ${safePageSize}, search: "${search}", statusFilter: "${statusFilter}")`);
    const [userReceipts, totalCount] = await Promise.all([
      getAllReceipts(username, limit, offset, search, statusValues),
      getReceiptCount(username, search, statusValues)
    ]);
    
    console.log("=".repeat(80));
    console.log(`[api/receipts] ✅ GET RESPONSE for username: "${username}"`);
    console.log(`[api/receipts] 📊 Receipt count: ${userReceipts.length} (total: ${totalCount}, page: ${safePage})`);
    if (userReceipts.length > 0) {
      console.log(`[api/receipts] 📋 First receipt:`, {
        receiptId: userReceipts[0]?.receiptId,
        username: userReceipts[0]?.username,
        merchant: userReceipts[0]?.merchant?.name,
        status: userReceipts[0]?.status
      });
    } else {
      console.warn(`[api/receipts] ⚠️ NO RECEIPTS FOUND for username: "${username}"`);
    }
    console.log("=".repeat(80));

    const enrichedUser = await enrichReceiptsWithDisplayNames(userReceipts);
    return NextResponse.json({ 
      receipts: enrichedUser, 
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total: totalCount,
        totalPages: Math.ceil(totalCount / safePageSize)
      }
    });
  } catch (error: any) {
    console.error("[api/receipts] error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch receipts",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const username = await getSessionUsername();

    if (!username) {
      console.warn("[api/receipts] POST - No username found in session, returning 401");
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const receipt: ReceiptAnalysis = body;

    if (!receipt.receiptId) {
      return NextResponse.json(
        { error: "receiptId is required" },
        { status: 400 }
      );
    }

    // Add username to receipt
    receipt.username = username;
    receipt.createdAt = new Date().toISOString();
    
    console.log("[api/receipts] POST request:", {
      receiptId: receipt.receiptId,
      username: username,
      receiptUsername: receipt.username,
      status: receipt.status
    });
    
    const saved = await saveReceipt(receipt);

    // Günlük görev ilerlemesi: kategori (D3/D4) ve merchant (D7/D8) sayılarını güncelle
    // await ile bekliyoruz — response dönmeden önce DB güncellenmiş olsun
    await updateDailyQuestProgressOnReceiptSaved(username).catch((err) =>
      console.warn("[api/receipts] Quest progress update failed:", err)
    );

    console.log("[api/receipts] POST response:", {
      receiptId: saved.receiptId,
      savedUsername: saved.username,
      status: saved.status
    });

    return NextResponse.json(saved);
  } catch (error: any) {
    console.error("[api/receipts] error:", error);
    return NextResponse.json(
      {
        error: "Failed to save receipt",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}






