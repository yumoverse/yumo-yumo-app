import { insertReceipt } from "@/lib/receipt/db/queries/insert";
import type { ReceiptAnalysis } from "@/lib/receipt/types";
import { getSql, warmUpConnection } from "@/lib/db/client";

export async function autoSaveScannedReceipt(
  username: string | undefined,
  payload: Record<string, unknown>,
  options?: { isAdmin?: boolean }
) : Promise<void> {
  if (!username) {
    console.warn("[Pipeline] Auto-save skipped: username missing");
    return;
  }

  const data: ReceiptAnalysis = {
    ...(payload as unknown as ReceiptAnalysis),
    username,
    status: "scanned",
    createdAt: new Date().toISOString(),
  };

  // Local/admin test akışında aynı fişi tekrar tekrar işleyebilmek için
  // duplicate hash unique kısıtına takılmayı engelle.
  if (options?.isAdmin) {
    (data as any).receiptHash = null;
    (data as any).imagePhash = null;
    (data as any).contentHash = null;
  }

  let savedReceiptId = data.receiptId;

  try {
    const saved = await insertReceipt(data);
    if (saved?.receiptId) {
      savedReceiptId = saved.receiptId;
    }
    console.log("[Pipeline] Auto-save (scanned) persisted:", savedReceiptId);
  } catch (error: any) {
    console.warn("[Pipeline] Auto-save (scanned) failed, trying fallback insert:", error?.message);
    try {
      const sql = getSql();
      if (sql) {
        await warmUpConnection();
        const merchantName =
          (data as any)?.merchant?.name ||
          (data as any)?.merchantName ||
          "Unknown Merchant";
        const totalPaid = Number((data as any)?.pricing?.totalPaid ?? 0) || 0;
        const currency = String((data as any)?.pricing?.currency ?? "TRY");
        const symbol = String((data as any)?.pricing?.symbol ?? "₺");

        await sql`
          INSERT INTO receipts (
            receipt_id, status, username, merchant_name,
            pricing_total_paid, pricing_currency, pricing_symbol,
            receipt_data, created_at, updated_at,
            receipt_hash, image_phash, content_hash
          ) VALUES (
            ${savedReceiptId}, 'scanned', ${username}, ${merchantName},
            ${totalPaid}, ${currency}, ${symbol},
            ${JSON.stringify(data)}::jsonb, now(), now(),
            NULL, NULL, NULL
          )
          ON CONFLICT (receipt_id) DO UPDATE SET
            status = 'scanned',
            username = EXCLUDED.username,
            merchant_name = EXCLUDED.merchant_name,
            pricing_total_paid = EXCLUDED.pricing_total_paid,
            pricing_currency = EXCLUDED.pricing_currency,
            pricing_symbol = EXCLUDED.pricing_symbol,
            receipt_data = EXCLUDED.receipt_data,
            updated_at = now()
        `;
        console.log("[Pipeline] Auto-save fallback persisted:", savedReceiptId);
      }
    } catch (fallbackErr: any) {
      console.warn("[Pipeline] Auto-save fallback failed:", fallbackErr?.message);
      return;
    }
  }

  // Emit verified-style notification at analyze completion as a reliable fallback
  // for background/PWA flows. Post-process also tries to insert the same type and
  // receipt_id, but both sides are deduped to avoid duplicates.
  try {
    const sql = getSql();
    if (!sql) return;
    await warmUpConnection();
    await sql`
      INSERT INTO user_notifications (username, type, title, body, payload, receipt_id)
      SELECT
        ${username},
        'receipt_verified',
        'Receipt verified',
        'Your receipt analysis is completed. Tap to open claim.',
        ${JSON.stringify({ receiptId: savedReceiptId, target: "claim_done" })}::jsonb,
        ${savedReceiptId}
      WHERE NOT EXISTS (
        SELECT 1
        FROM user_notifications
        WHERE username = ${username}
          AND receipt_id = ${savedReceiptId}
          AND type = 'receipt_verified'
      )
    `;
  } catch (error: any) {
    console.warn("[Pipeline] Auto-save verified notification insert failed:", error?.message);
  }
}
