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

  // Intentionally no "analyzed" notification here.
  // User should only receive the final verified notification from post-process.
}
