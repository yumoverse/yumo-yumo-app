/**
 * Admin: Satırı olmayan ESKİ fişlerde GPT-4o'yu yeniden çalıştırır.
 *
 * 1. receipt_line_items'ta satırı olmayan + ocr_raw_text'i olan fişleri bulur
 * 2. Her biri için parseFullReceiptWithGPT(ocrText) çağırır (paralel, max 3)
 * 3. receipt_data.geminiLineItems + receipt_data.gptFullReceiptResult olarak kaydeder
 * 4. post_process_state = 'pending' yapıp enqueuePostProcess ile Faz2'yi tetikler
 *
 * POST JSON { "limit"?: number }   — varsayılan 5, max 20
 */

import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { getSql } from "@/lib/db/client";
import { isAdminUser } from "@/lib/auth/admin-users";
import {
  parseFullReceiptWithGPT,
  gptFullReceiptToGeminiLineItems,
} from "@/app/api/receipt/analyze/services/gpt-full-receipt-service";
import { isFaz2Enabled } from "@/config/oracle-phases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

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
  }).catch((err) => console.warn("[regpt] enqueuePostProcess failed:", err?.message));
}

export async function POST(req: Request) {
  try {
    const username = await getSessionUsername();
    if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminUser(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let body: { limit?: number } = {};
    try {
      const j = await req.json();
      if (j && typeof j === "object") body = j as { limit?: number };
    } catch { /* empty body ok */ }

    const n = Number(body.limit);
    const limit = Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 20) : 5;

    const sql = getSql();
    if (!sql) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    // receipt_line_items'ta satırı olmayan VE ocr_raw_text'i olan fişleri bul
    const rows = await sql`
      SELECT r.receipt_id, r.ocr_raw_text, r.receipt_data
      FROM receipts r
      WHERE r.ocr_raw_text IS NOT NULL
        AND r.ocr_raw_text != ''
        AND NOT EXISTS (
          SELECT 1 FROM receipt_line_items l WHERE l.receipt_id = r.receipt_id
        )
      ORDER BY r.created_at DESC
      LIMIT ${limit}
    `;

    const receipts = rows as { receipt_id: string; ocr_raw_text: string; receipt_data: unknown }[];
    if (receipts.length === 0) {
      return NextResponse.json({ message: "No receipts needing re-GPT", found: 0, results: [] });
    }

    // GPT calls paralel çalıştır (max 3 eş zamanlı)
    const CONCURRENCY = 3;
    const results: { receiptId: string; gptOk: boolean; gptItemCount: number; enqueued: boolean; error?: string }[] = [];

    for (let i = 0; i < receipts.length; i += CONCURRENCY) {
      const batch = receipts.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (r) => {
          const receiptId = r.receipt_id;
          try {
            const gptResult = await parseFullReceiptWithGPT(r.ocr_raw_text);
            if (!gptResult?.lineItems?.length) {
              return { receiptId, gptOk: false, gptItemCount: 0, enqueued: false };
            }

            // Mevcut receipt_data'yı parse et
            let existingData: Record<string, unknown> = {};
            try {
              existingData = typeof r.receipt_data === "string"
                ? (JSON.parse(r.receipt_data) as Record<string, unknown>)
                : ((r.receipt_data as Record<string, unknown>) ?? {});
            } catch { /* ignore */ }

            const geminiLineItems = gptFullReceiptToGeminiLineItems(gptResult);
            const updatedData = { ...existingData, geminiLineItems, gptFullReceiptResult: gptResult };

            // receipt_data'yı güncelle, post_process_state sıfırla
            await sql`
              UPDATE receipts
              SET
                receipt_data = ${JSON.stringify(updatedData)}::jsonb,
                post_process_state = 'pending',
                post_process_started_at = NULL,
                post_process_retry_count = 0
              WHERE receipt_id = ${receiptId}
            `;

            // Faz2'yi fire-and-forget olarak tetikle (bloklamaz)
            enqueuePostProcess(receiptId);

            return { receiptId, gptOk: true, gptItemCount: gptResult.lineItems.length, enqueued: true };
          } catch (err) {
            const msg = (err as Error)?.message ?? String(err);
            console.error(`[regpt] ${receiptId} failed:`, msg);
            return { receiptId, gptOk: false, gptItemCount: 0, enqueued: false, error: msg };
          }
        })
      );
      results.push(...batchResults);
    }

    const succeeded = results.filter((r) => r.gptOk).length;
    return NextResponse.json({
      found: receipts.length,
      succeeded,
      enqueued: results.filter((r) => r.enqueued).length,
      results,
    });
  } catch (e) {
    console.error("[api/admin/receipt-line-items/regpt] POST error:", e);
    return NextResponse.json({ error: "Re-GPT failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const username = await getSessionUsername();
    if (!username) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!isAdminUser(username)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const sql = getSql();
    if (!sql) return NextResponse.json({ error: "Database not configured" }, { status: 500 });

    const [needCount, lineCount] = await Promise.all([
      sql`
        SELECT COUNT(*)::int AS cnt FROM receipts r
        WHERE r.ocr_raw_text IS NOT NULL AND r.ocr_raw_text != ''
          AND NOT EXISTS (SELECT 1 FROM receipt_line_items l WHERE l.receipt_id = r.receipt_id)
      `,
      sql`SELECT COUNT(*)::int AS cnt FROM receipt_line_items`,
    ]);

    return NextResponse.json({
      receiptsNeedingRegpt: (needCount[0] as { cnt: number }).cnt,
      totalLineItemsInTable: (lineCount[0] as { cnt: number }).cnt,
    });
  } catch (e) {
    console.error("[api/admin/receipt-line-items/regpt] GET error:", e);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
