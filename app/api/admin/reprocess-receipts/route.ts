/**
 * Admin: Bulk reprocess receipts that are stuck in needs_review / validation_rejected.
 * Resets post_process_state to 'pending' and re-enqueues the Faz2 worker.
 *
 * POST ?state=needs_review          → only needs_review
 * POST ?state=validation_rejected   → only validation_rejected
 * POST ?state=all                   → both states
 * Optional: &limit=50               → max receipts to reset (default 100)
 * Optional: &receiptId=xxx          → reset a specific receipt ID regardless of state
 */

import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { getSql } from "@/lib/db/client";
import { isAdminUser } from "@/lib/auth/admin-users";
import { isFaz2Enabled } from "@/config/oracle-phases";

export const dynamic = "force-dynamic";

function enqueuePostProcess(receiptId: string): void {
  if (!isFaz2Enabled()) return;
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = `${base}/api/internal/post-process?receiptId=${encodeURIComponent(receiptId)}`;
  const internalSecret = process.env.INTERNAL_SECRET;
  fetch(url, {
    method: "POST",
    cache: "no-store",
    ...(internalSecret && { headers: { Authorization: `Bearer ${internalSecret}` } }),
  }).catch((err) =>
    console.warn("[reprocess-receipts] enqueuePostProcess failed:", err?.message)
  );
}

export async function POST(req: Request) {
  try {
    const username = await getSessionUsername();
    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(username)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    const { searchParams } = new URL(req.url);
    const stateFilter = searchParams.get("state") || "needs_review";
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);
    const specificId = searchParams.get("receiptId")?.trim() || null;

    let receiptIds: string[] = [];

    if (specificId) {
      // Reset a single specific receipt
      await sql`
        UPDATE receipts
        SET post_process_state = 'pending',
            post_process_retry_count = 0
        WHERE receipt_id = ${specificId}
      `;
      receiptIds = [specificId];
    } else {
      // Bulk reset by state
      const states: string[] = [];
      if (stateFilter === "all") {
        states.push("needs_review", "validation_rejected");
      } else {
        states.push(stateFilter);
      }

      const rows = (await sql`
        UPDATE receipts
        SET post_process_state = 'pending',
            post_process_retry_count = 0
        WHERE receipt_id IN (
          SELECT receipt_id FROM receipts
          WHERE post_process_state = ANY(${states}::text[])
          LIMIT ${limit}
        )
        RETURNING receipt_id
      `) as { receipt_id: string }[];
      receiptIds = rows.map((r) => r.receipt_id);
    }

    // Enqueue post-process for each reset receipt (fire-and-forget)
    for (const id of receiptIds) {
      enqueuePostProcess(id);
    }

    return NextResponse.json({
      ok: true,
      reset: receiptIds.length,
      receiptIds,
      message: `${receiptIds.length} receipt(s) reset to pending and re-enqueued for Faz2 post-process.`,
    });
  } catch (e) {
    console.error("[api/admin/reprocess-receipts] POST error:", e);
    return NextResponse.json({ error: "Failed to reprocess receipts" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const username = await getSessionUsername();
    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(username)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }

    // Show counts of receipts in each stuck state
    const counts = (await sql`
      SELECT post_process_state AS state, COUNT(*)::text AS count
      FROM receipts
      WHERE post_process_state IN ('needs_review', 'validation_rejected', 'pending', 'processing', 'completed', 'error')
      GROUP BY post_process_state
      ORDER BY count DESC
    `) as { state: string; count: string }[];

    return NextResponse.json({
      stateCounts: counts.map((r) => ({
        state: r.state,
        count: parseInt(r.count, 10),
      })),
    });
  } catch (e) {
    console.error("[api/admin/reprocess-receipts] GET error:", e);
    return NextResponse.json({ error: "Failed to fetch state counts" }, { status: 500 });
  }
}
