/**
 * Admin: Fiş için Faz-2 post-process'i yeniden çalıştır (receipt_line_items yenilenir).
 * POST JSON { "receiptId": "..." }
 *
 * Önce receipts.post_process_state = 'pending' yapılır; böylece verified olsa bile tekrar işlenir.
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

    let body: { receiptId?: string };
    try {
      body = (await req.json()) as { receiptId?: string };
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const receiptId = body.receiptId?.trim();
    if (!receiptId) {
      return NextResponse.json({ error: "receiptId required" }, { status: 400 });
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 });
    }

    await sql`
      UPDATE receipts
      SET
        post_process_state = 'pending',
        post_process_started_at = NULL
      WHERE receipt_id = ${receiptId}
    `;

    const result = await runPostProcess(receiptId);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[api/admin/receipt-line-items/reprocess] POST error:", e);
    return NextResponse.json({ error: "Reprocess failed" }, { status: 500 });
  }
}
