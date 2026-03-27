/**
 * Admin: Satırı olmayan fişlerde Faz2 post-process (LLM yok; DB’deki vision/receipt_data kullanılır).
 * POST JSON { "limit"?: number } — varsayılan 15, üst sınır 40 (timeout riski).
 */

import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { getSql } from "@/lib/db/client";
import { isAdminUser } from "@/lib/auth/admin-users";
import { runPostProcess } from "@/lib/receipt/post-process/run-post-process";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const username = await getSessionUsername();
    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(username)) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    let body: { limit?: number } = {};
    try {
      const j = await req.json();
      if (j && typeof j === "object") body = j as { limit?: number };
    } catch {
      /* empty body ok */
    }

    const n = Number(body.limit);
    const limit = Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 40) : 15;

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    const rows = await sql`
      SELECT r.receipt_id
      FROM receipts r
      WHERE NOT EXISTS (
        SELECT 1 FROM receipt_line_items l WHERE l.receipt_id = r.receipt_id
      )
      ORDER BY r.created_at DESC
      LIMIT ${limit}
    `;

    const ids = (rows as { receipt_id: string }[]).map((r) => r.receipt_id);
    const results: {
      receiptId: string;
      ok: boolean;
      state: string;
      lineItemsWritten?: number;
      error?: string;
    }[] = [];
    let totalLineItemsWritten = 0;

    for (const receiptId of ids) {
      await sql`
        UPDATE receipts
        SET
          post_process_state = 'pending',
          post_process_started_at = NULL
        WHERE receipt_id = ${receiptId}
      `;
      const result = await runPostProcess(receiptId);
      const written = result.lineItemsWritten ?? 0;
      totalLineItemsWritten += written;
      results.push({
        receiptId,
        ok: result.ok,
        state: result.state,
        lineItemsWritten: written,
        ...(result.error ? { error: result.error } : {}),
      });
    }

    return NextResponse.json({
      requestedLimit: limit,
      found: ids.length,
      totalLineItemsWritten,
      results,
    });
  } catch (e) {
    console.error("[api/admin/receipt-line-items/backfill] POST error:", e);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}
