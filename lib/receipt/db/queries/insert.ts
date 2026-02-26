/**
 * INSERT queries for receipts
 * SERVER-ONLY: Do not import in client components
 */

import { sql, warmUpConnection } from "@/lib/db/client";
import type { ReceiptAnalysis } from "../../types";
import { saveReceipt as saveReceiptFile } from "../../storage";
import { isDatabaseAvailable, withRetry } from "../connection";
import { receiptToDbColumns } from "../mappers/to-db";
import { saveBreakdownItems } from "../parallel/breakdown-items";
import { saveFlagsReasons } from "../parallel/flags-reasons";
import { saveOcrLines } from "../parallel/ocr-lines";
import { getReceiptById } from "./select";
import { isFaz2Enabled } from "@/config/oracle-phases";

/** Fire-and-forget trigger for Faz2 post-process worker (Oracle plan). Sadece ORACLE_FAZ2_ENABLED=true ise çalışır. */
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
    console.warn("[storage-db] enqueuePostProcess failed:", err?.message)
  );
}

/**
 * Insert receipt into database
 * Handles duplicate hash error by returning existing receipt
 */
export async function insertReceipt(receipt: ReceiptAnalysis): Promise<ReceiptAnalysis> {
  if (!isDatabaseAvailable() || !sql) {
    console.log("[storage-db] Database not available, using file storage");
    return saveReceiptFile(receipt);
  }

  const dbSql = sql;
  await warmUpConnection();

  try {
    console.log("[storage-db] Saving receipt to database:", {
      receiptId: receipt.receiptId,
      username: receipt.username,
      merchant: receipt.merchant?.name,
      status: receipt.status
    });

    // Map receipt to database columns
    const columns = receiptToDbColumns(receipt);

    // Insert or update receipt
    await dbSql`
      INSERT INTO receipts (
        receipt_id, status, username, merchant_name, merchant_id, merchant_place_id, merchant_category, merchant_country,
        extraction_date_value, extraction_time_value, extraction_date_confidence, extraction_total_value, extraction_total_confidence,
        extraction_vat_value, extraction_vat_confidence, extraction_vat_rate,
        pricing_total_paid, pricing_vat_amount, pricing_paid_ex_tax, pricing_vat_rate,
        pricing_import_system_rate, pricing_retail_hidden_rate, pricing_currency, pricing_symbol,
        hidden_cost_reference_price, hidden_cost_core, hidden_cost_breakdown_import_system, hidden_cost_breakdown_retail_hidden,
        reward_conversion_rate, reward_raw, reward_final, reward_token,
        flags_needs_llm, flags_rejected, flags_gate_confidence, flags_doc_type,
        ocr_raw_text, wallet_address, receipt_data, vision_json, created_at, updated_at,
        proof_type, is_rewarded, reward_tier, risk_score, evidence, source, receipt_hash,
        image_phash, content_hash,
        post_process_state, post_process_retry_count, slot_type, rewarded
      ) VALUES (
        ${columns.receiptId}, ${columns.status}, ${columns.username}, ${columns.merchantName}, ${columns.merchantId},
        ${columns.merchantPlaceId}, ${columns.merchantCategory}, ${columns.merchantCountry},
        ${columns.extractionDateValue}, ${columns.extractionTimeValue}, ${columns.extractionDateConfidence}, ${columns.extractionTotalValue}, ${columns.extractionTotalConfidence},
        ${columns.extractionVatValue}, ${columns.extractionVatConfidence}, ${columns.extractionVatRate},
        ${columns.pricingTotalPaid}, ${columns.pricingVatAmount}, ${columns.pricingPaidExTax}, ${columns.pricingVatRate},
        ${columns.pricingImportSystemRate}, ${columns.pricingRetailHiddenRate}, ${columns.pricingCurrency}, ${columns.pricingSymbol},
        ${columns.hiddenCostReferencePrice}, ${columns.hiddenCostCore}, ${columns.hiddenCostBreakdownImportSystem}, ${columns.hiddenCostBreakdownRetailHidden},
        ${columns.rewardConversionRate}, ${columns.rewardRaw}, ${columns.rewardFinal}, ${columns.rewardToken},
        ${columns.flagsNeedsLlm}, ${columns.flagsRejected}, ${columns.flagsGateConfidence}, ${columns.flagsDocType},
        ${columns.ocrRawText}, ${columns.walletAddress}, ${columns.receiptData}::jsonb,
        ${columns.visionJson}::jsonb,
        ${columns.createdAt}, ${columns.updatedAt},
        ${columns.proofType}, ${columns.isRewarded}, ${columns.rewardTier}, ${columns.riskScore}, 
        ${columns.evidence}::jsonb, ${columns.source}::jsonb, ${columns.receiptHash},
        ${columns.imagePhash}, ${columns.contentHash},
        ${columns.postProcessState}, ${columns.postProcessRetryCount}, ${columns.slotType}, ${columns.rewarded}
      )
      ON CONFLICT (receipt_id) 
      DO UPDATE SET
        status = CASE
          WHEN receipts.status IN ('analyzed', 'saved', 'verified', 'rejected', 'pending')
          THEN receipts.status
          ELSE EXCLUDED.status
        END,
        username = EXCLUDED.username,
        merchant_name = EXCLUDED.merchant_name,
        merchant_id = EXCLUDED.merchant_id,
        merchant_place_id = EXCLUDED.merchant_place_id,
        merchant_category = EXCLUDED.merchant_category,
        merchant_country = EXCLUDED.merchant_country,
        extraction_date_value = EXCLUDED.extraction_date_value,
        extraction_time_value = EXCLUDED.extraction_time_value,
        extraction_date_confidence = EXCLUDED.extraction_date_confidence,
        extraction_total_value = EXCLUDED.extraction_total_value,
        extraction_total_confidence = EXCLUDED.extraction_total_confidence,
        extraction_vat_value = EXCLUDED.extraction_vat_value,
        extraction_vat_confidence = EXCLUDED.extraction_vat_confidence,
        extraction_vat_rate = EXCLUDED.extraction_vat_rate,
        pricing_total_paid = EXCLUDED.pricing_total_paid,
        pricing_vat_amount = EXCLUDED.pricing_vat_amount,
        pricing_paid_ex_tax = EXCLUDED.pricing_paid_ex_tax,
        pricing_vat_rate = EXCLUDED.pricing_vat_rate,
        pricing_import_system_rate = EXCLUDED.pricing_import_system_rate,
        pricing_retail_hidden_rate = EXCLUDED.pricing_retail_hidden_rate,
        pricing_currency = EXCLUDED.pricing_currency,
        pricing_symbol = EXCLUDED.pricing_symbol,
        hidden_cost_reference_price = EXCLUDED.hidden_cost_reference_price,
        hidden_cost_core = EXCLUDED.hidden_cost_core,
        hidden_cost_breakdown_import_system = EXCLUDED.hidden_cost_breakdown_import_system,
        hidden_cost_breakdown_retail_hidden = EXCLUDED.hidden_cost_breakdown_retail_hidden,
        reward_conversion_rate = EXCLUDED.reward_conversion_rate,
        reward_raw = EXCLUDED.reward_raw,
        reward_final = EXCLUDED.reward_final,
        reward_token = EXCLUDED.reward_token,
        flags_needs_llm = EXCLUDED.flags_needs_llm,
        flags_rejected = EXCLUDED.flags_rejected,
        flags_gate_confidence = EXCLUDED.flags_gate_confidence,
        flags_doc_type = EXCLUDED.flags_doc_type,
        ocr_raw_text = EXCLUDED.ocr_raw_text,
        wallet_address = EXCLUDED.wallet_address,
        receipt_data = EXCLUDED.receipt_data,
        vision_json = EXCLUDED.vision_json,
        updated_at = EXCLUDED.updated_at,
        proof_type = EXCLUDED.proof_type,
        is_rewarded = EXCLUDED.is_rewarded,
        reward_tier = EXCLUDED.reward_tier,
        risk_score = EXCLUDED.risk_score,
        evidence = EXCLUDED.evidence,
        source = EXCLUDED.source,
        receipt_hash = EXCLUDED.receipt_hash,
        image_phash = EXCLUDED.image_phash,
        content_hash = EXCLUDED.content_hash,
        post_process_state = EXCLUDED.post_process_state,
        post_process_retry_count = EXCLUDED.post_process_retry_count,
        slot_type = EXCLUDED.slot_type,
        rewarded = EXCLUDED.rewarded
    `;

    // Save breakdown items, flags reasons, and OCR lines in parallel
    const parallelOps: Promise<any>[] = [];

    if (columns.breakdownItems.length > 0) {
      parallelOps.push(saveBreakdownItems(receipt.receiptId, columns.breakdownItems));
    }

    if (columns.flagsReasons.length > 0) {
      parallelOps.push(saveFlagsReasons(receipt.receiptId, columns.flagsReasons));
    }

    if (columns.ocrLines.length > 0) {
      parallelOps.push(saveOcrLines(receipt.receiptId, columns.ocrLines));
    }

    // Execute all parallel operations
    if (parallelOps.length > 0) {
      await Promise.all(parallelOps);
    }

    // Oracle: store Vision JSON for Faz2 post-process; then enqueue worker
    let visionJsonToStore: unknown = receipt.visionRawJson;
    if (visionJsonToStore == null) {
      try {
        const pendingRows = await dbSql`
          SELECT vision_json FROM receipt_vision_pending WHERE receipt_id = ${receipt.receiptId} LIMIT 1
        `;
        if (pendingRows.length > 0 && (pendingRows[0] as { vision_json: unknown }).vision_json != null) {
          visionJsonToStore = (pendingRows[0] as { vision_json: unknown }).vision_json;
        }
      } catch {
        /* receipt_vision_pending may not exist */
      }
    }
    if (visionJsonToStore != null) {
      try {
        await dbSql`
          INSERT INTO receipt_vision_raw (receipt_id, vision_json)
          VALUES (${receipt.receiptId}, ${JSON.stringify(visionJsonToStore)}::jsonb)
          ON CONFLICT (receipt_id) DO UPDATE SET vision_json = EXCLUDED.vision_json
        `;
        try {
          await dbSql`DELETE FROM receipt_vision_pending WHERE receipt_id = ${receipt.receiptId}`;
        } catch {
          /* ignore */
        }
      } catch (visionErr: any) {
        console.warn("[storage-db] receipt_vision_raw insert skipped (table may not exist yet):", visionErr?.message);
      }
    }

    // Oracle: enqueue post-process for every analyzed/verified receipt so receipt_rewards is filled
    // (even when vision was not stored: runPostProcess uses receipts.hidden_cost_core and receipts.vision_json)
    if (isFaz2Enabled() && (receipt.status === "analyzed" || receipt.status === "verified")) {
      enqueuePostProcess(receipt.receiptId);
    }

    console.log("[storage-db] ✅ Receipt saved to database successfully:", receipt.receiptId);
    return receipt;
  } catch (error: any) {
    // Check if this is a duplicate hash error
    if (error?.code === '23505' && error?.constraint === 'idx_receipts_hash_unique') {
      console.error("[storage-db] ❌ Duplicate receipt hash detected:", {
        receiptId: receipt.receiptId,
        hash: receipt.receiptHash?.substring(0, 16) + '...',
        message: error.message
      });
      
      // Try to find the existing receipt with this hash
      try {
        const existingReceipt = await dbSql`
          SELECT receipt_id, username, merchant_name, created_at
          FROM receipts 
          WHERE receipt_hash = ${receipt.receiptHash}
          LIMIT 1
        `;
        
        if (existingReceipt.length > 0) {
          const existing = existingReceipt[0];
          console.log("[storage-db] ⚠️ Duplicate receipt found:", {
            existingReceiptId: existing.receipt_id,
            existingUsername: existing.username,
            merchantName: existing.merchant_name,
            createdAt: existing.created_at
          });
          
          // Return the existing receipt instead of throwing error
          const existingReceiptData = await getReceiptById(existing.receipt_id, receipt.username, false);
          if (existingReceiptData) {
            return existingReceiptData;
          }
          throw new Error(`Duplicate receipt detected but could not retrieve existing receipt.`);
        }
      } catch (lookupError) {
        console.error("[storage-db] ❌ Failed to lookup existing receipt:", lookupError);
      }
      
      throw new Error(`Duplicate receipt detected. This receipt has already been uploaded.`);
    }
    
    console.error("[storage-db] ❌ Failed to save receipt to database:", error);
    throw error;
  }
}
