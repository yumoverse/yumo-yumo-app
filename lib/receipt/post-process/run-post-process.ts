/**
 * Faz2 post-process worker (Oracle plan).
 * Input: receiptId. Reads receipt_vision_raw.vision_json + receipts row.
 * Steps: Vision -> canonical extract -> receipt_canonical + receipt_line_items ->
 * line-level hidden cost -> compare with category hidden ->
 * receipt_rewards (aYUMO, rYUMO) -> notifications -> verified -> trust-update.
 *
 * Ödül formülü:
 *   aYUMO = HiddenCost / USD_rate  (hidden cost in local currency → USD-equivalent reward)
 *   rYUMO = aYUMO × CPI × Level_Catalyzer × Category_Catalyzer
 */

import { getSql } from "@/lib/db/client";
import { isTrustWorkerEnabled } from "@/config/oracle-phases";
import {
  extractCanonicalFromVision,
  parseStructuredLineItemsFromReceiptData,
  allocateLinePricesWhenMissing,
  computeLineHiddenCosts,
  fetchProductionCostWeights,
  fetchEconomicIndexMultipliers,
  fetchTaxonomyBulk,
  resolveCanonicalObservations,
} from "@/lib/receipt/canonical";
import type { VisionResponseLike } from "@/lib/receipt/canonical";
import { getUsdRate, getUsdRateAsync, getCpiSeriesForCategory } from "@/config/reward-formula";
import { getSeasonLevelMultiplier } from "@/config/season-level-config";
import { getEconomicIndexFromDB } from "@/lib/db/economicIndex";
import { getTuikReferencePriceBulk } from "@/lib/mining/tuikReferencePrice";
import {
  validateReceiptExtraction,
  buildReceiptExtractionPayloadFromStoredReceipt,
  extractionValidationToStoredShape,
  mergeExtractionValidationIntoReceiptData,
} from "@/lib/receipt/validation";

function merchantCategoryToInternal(category: string | null | undefined): string {
  const raw = (category ?? "").toLowerCase().trim();
  const map: Record<string, string> = {
    gıda: "groceries_fmcg", gida: "groceries_fmcg", grocery: "groceries_fmcg", groceries: "groceries_fmcg",
    supermarket: "groceries_fmcg", fmcg: "groceries_fmcg",
    giyim: "apparel_fashion", apparel: "apparel_fashion", fashion: "apparel_fashion",
    elektronik: "electronics", electronics: "electronics",
    kozmetik: "beauty_personal_care", beauty: "beauty_personal_care",
    ev: "home_living", home: "home_living", mobilya: "home_living",
    seyahat: "travel_ticket", travel: "travel_ticket",
    yemek: "food_delivery", food: "food_delivery", restoran: "food_delivery",
    dijital: "services_digital", digital: "services_digital",
    konaklama: "hospitality_lodging", hotel: "hospitality_lodging",
  };
  return map[raw] ?? "other";
}

export interface PostProcessResult {
  ok: boolean;
  receiptId: string;
  state: string;
  error?: string;
  /** receipt_line_items INSERT sayısı (canonical çalıştıysa) */
  lineItemsWritten?: number;
}

interface ReceiptRow {
  receipt_id: string;
  post_process_state: string | null;
  username: string | null;
  hidden_cost_core: number;
  merchant_name: string | null;
  extraction_date_value: string | null;
  extraction_time_value: string | null;
  pricing_paid_ex_tax: number | null;
  pricing_total_paid: number | null;
  pricing_vat_amount: number | null;
  pricing_currency: string | null;
  merchant_country: string | null;
  merchant_category: string | null;
  vision_json: unknown;
  vision_from_raw: unknown;
  receipt_data: unknown;
}

export async function runPostProcess(receiptId: string): Promise<PostProcessResult> {
  const sql = getSql();
  if (!sql) {
    return { ok: false, receiptId, state: "error", error: "Database not available" };
  }

  try {
    const rows = await sql`
      SELECT
        r.receipt_id,
        r.post_process_state,
        r.username,
        COALESCE(r.hidden_cost_core, 0)::float as hidden_cost_core,
        r.merchant_name,
        r.extraction_date_value,
        r.extraction_time_value,
        r.pricing_paid_ex_tax,
        r.pricing_total_paid,
        r.pricing_vat_amount,
        r.pricing_currency,
        r.merchant_country,
        r.merchant_category,
        r.vision_json,
        v.vision_json as vision_from_raw,
        r.receipt_data
      FROM receipts r
      LEFT JOIN receipt_vision_raw v ON v.receipt_id = r.receipt_id
      WHERE r.receipt_id = ${receiptId}
      LIMIT 1
    `;
    const row = rows[0] as ReceiptRow | undefined;
    if (!row) {
      return { ok: false, receiptId, state: "not_found", error: "Receipt not found" };
    }
    if (row.post_process_state && row.post_process_state !== "pending") {
      return { ok: true, receiptId, state: row.post_process_state, lineItemsWritten: 0 };
    }

    await sql`
      UPDATE receipts
      SET post_process_started_at = now(), post_process_state = 'processing'
      WHERE receipt_id = ${receiptId} AND (post_process_state IS NULL OR post_process_state = 'pending')
    `;

    const vPayload = buildReceiptExtractionPayloadFromStoredReceipt(row.receipt_data, {
      pricing_total_paid: row.pricing_total_paid,
      pricing_vat_amount: row.pricing_vat_amount,
      merchant_name: row.merchant_name,
      extraction_date_value: row.extraction_date_value,
      extraction_time_value: row.extraction_time_value,
    });
    const vr = validateReceiptExtraction(vPayload);
    if (vr.status === "rejected") {
      // Hard abort — Zod schema failure (bad data that cannot be processed at all)
      const stored = extractionValidationToStoredShape(vr);
      const mergedJson = mergeExtractionValidationIntoReceiptData(row.receipt_data, stored);
      await sql`
        UPDATE receipts
        SET receipt_data = ${mergedJson}::jsonb,
            post_process_state = 'validation_rejected'
        WHERE receipt_id = ${receiptId}
      `;
      console.warn(`[run-post-process] Extraction validation rejected (Zod): ${vr.zodErrors.join("; ")}`);
      return { ok: true, receiptId, state: "validation_rejected", lineItemsWritten: 0 };
    }
    if (vr.status === "needs_review") {
      // Soft flag — empty/mismatched line items; record the result but DO NOT abort.
      // Canonical pipeline may still run if geminiLineItems exists; rewards always run.
      const stored = extractionValidationToStoredShape(vr);
      const mergedJson = mergeExtractionValidationIntoReceiptData(row.receipt_data, stored);
      await sql`
        UPDATE receipts
        SET receipt_data = ${mergedJson}::jsonb
        WHERE receipt_id = ${receiptId}
      `;
      console.warn(`[run-post-process] Extraction validation needs_review: ${vr.reason} — continuing pipeline`);
    }

    const categoryHidden = Number(row.hidden_cost_core) ?? 0;
    const paidExTax = Number(row.pricing_paid_ex_tax) ?? 0;
    const country = (row.merchant_country ?? "TR") as string;
    const yearMonth = row.extraction_date_value
      ? String(row.extraction_date_value).slice(0, 7)
      : new Date().toISOString().slice(0, 7);

    let totalHiddenCanonical: number | null = null;
    let lineItemsWritten = 0;
    const visionJson = (row.vision_from_raw ?? row.vision_json) as VisionResponseLike | null | undefined;
    const rawStructured = parseStructuredLineItemsFromReceiptData(row.receipt_data);
    const paidForAlloc =
      paidExTax > 0 ? paidExTax : Math.max(0, Number(row.pricing_total_paid) || 0);
    const geminiLineItems = rawStructured?.length
      ? allocateLinePricesWhenMissing(rawStructured, paidForAlloc)
      : undefined;
    const canRunCanonical = Boolean(geminiLineItems && geminiLineItems.length > 0);

    if (!canRunCanonical) {
      console.warn(
        `[run-post-process] ${receiptId}: receipt_data'da yapılandırılmış satır yok (geminiLineItems / gptFullReceiptResult); receipt_line_items yazılmadı`
      );
    }

    if (canRunCanonical) {
      try {
        const payload = extractCanonicalFromVision(visionJson ?? null, {
          receiptId,
          merchantName: row.merchant_name ?? undefined,
          totalPaid: row.pricing_total_paid ?? undefined,
          paidExTax: paidExTax || undefined,
          date: row.extraction_date_value ?? undefined,
          currency: row.pricing_currency ?? undefined,
          category: row.merchant_category ?? undefined,
          geminiLineItems,
        });

        // Taxonomy fuzzy match (pg_trgm) → LLM fallback → upsert new canonical rows
        await resolveCanonicalObservations(payload.observations);

        const fallbackHiddenRate =
          paidExTax > 0 && categoryHidden >= 0 ? categoryHidden / paidExTax : 0.35;
        const weights = await fetchProductionCostWeights(country);
        const economicMultipliers = await fetchEconomicIndexMultipliers(country, yearMonth);

        // TÜİK ortalama fiyat lookup — tüm satırları tek sorguda al
        const tuikPrices = await getTuikReferencePriceBulk(
          payload.observations.map((o) => ({ name: o.canonical_name || o.raw_name, unit: o.unit_type ?? undefined })),
          yearMonth
        );

        // Ürün bazlı taxonomy lookup — canonical_product_taxonomy
        const taxonomyByName = await fetchTaxonomyBulk(
          payload.observations.map((o) => o.canonical_name || o.raw_name)
        );

        // Scraped market fiyatları (1. öncelik) — aynı market, en güncel fiyat
        const merchantCanonical = payload.merchant?.canonical_name?.trim();
        const { fetchScrapedPricesBulk } = await import("@/lib/receipt/canonical/line-hidden-cost");
        const scrapedPrices = merchantCanonical
          ? await fetchScrapedPricesBulk(
              merchantCanonical,
              payload.observations.map((o) => o.canonical_name || o.raw_name)
            )
          : undefined;

        const { results, totalHiddenCanonical: total } = computeLineHiddenCosts({
          payload,
          country,
          yearMonth,
          fallbackHiddenRate: Math.min(0.7, Math.max(0.1, fallbackHiddenRate)),
          weightsByCategory: weights,
          economicMultipliers: economicMultipliers ?? undefined,
          tuikPrices,
          taxonomyByName,
          scrapedPrices,
        });
        totalHiddenCanonical = total;

        await sql`
          INSERT INTO receipt_canonical (receipt_id, payload, total_hidden_canonical, analyzed_at)
          VALUES (${receiptId}, ${JSON.stringify(payload)}::jsonb, ${total}, now())
          ON CONFLICT (receipt_id) DO UPDATE SET
            payload = EXCLUDED.payload,
            total_hidden_canonical = EXCLUDED.total_hidden_canonical,
            analyzed_at = now()
        `;

        await sql`DELETE FROM receipt_line_items WHERE receipt_id = ${receiptId}`;
        lineItemsWritten = 0;
        for (const r of results) {
          const o = r.observation;
          // Kategori önceliği: 1) taxonomy DB match, 2) GPT/LLM çıktısı, 3) merchant kategorisi
          const productKey = (o.canonical_name || o.raw_name || "").toLowerCase().trim();
          const taxRow = productKey ? taxonomyByName.get(productKey) : undefined;
          const finalCategoryLvl1 = taxRow?.category_lvl1 || o.category_lvl1 || null;
          const finalCategoryLvl2 = taxRow?.category_lvl2 || o.category_lvl2 || null;
          await sql`
            INSERT INTO receipt_line_items (
              receipt_id, raw_name, canonical_name, brand, category_lvl1, category_lvl2,
              pack_size, unit_type, quantity, unit_price, line_total, unit_price_gross, line_total_gross,
              discount_amount, vat_rate, confidence_score, reference_price, hidden_cost_line
            )
            VALUES (
              ${receiptId},
              ${o.raw_name ?? null},
              ${o.canonical_name ?? null},
              ${o.brand ?? null},
              ${finalCategoryLvl1},
              ${finalCategoryLvl2},
              ${o.pack_size ?? null},
              ${o.unit_type ?? null},
              ${o.quantity ?? 1},
              ${o.unit_price_gross ?? o.line_total_gross ?? null},
              ${o.line_total_gross ?? null},
              ${o.unit_price_gross ?? null},
              ${o.line_total_gross ?? null},
              ${o.discount_amount ?? 0},
              ${o.vat_rate ?? null},
              ${o.confidence_score ?? null},
              ${r.reference_price},
              ${r.hidden_cost_line}
            )
          `;
          lineItemsWritten += 1;
        }
      } catch (canonicalErr) {
        const msg = (canonicalErr as Error)?.message ?? String(canonicalErr);
        console.error("[run-post-process] Canonical pipeline failed:", msg);
        throw canonicalErr;
      }
    }

    const usdRate = Math.max(
      0.0001,
      await getUsdRateAsync(row.pricing_currency, country, yearMonth)
    );
    const baseAyumo = categoryHidden / usdRate;
    let extraReward = 0;
    let finalHiddenCost = categoryHidden;
    if (totalHiddenCanonical !== null && totalHiddenCanonical > categoryHidden) {
      const delta = totalHiddenCanonical - categoryHidden;
      extraReward = delta / usdRate;
      finalHiddenCost = totalHiddenCanonical;
    }

    const ayumoTotal = baseAyumo + extraReward;
    const cpiValue = await getEconomicIndexFromDB(country as "TR" | "US" | "TH" | "MY", "CPI", yearMonth, "GENEL");
    const cpiMultiplier = cpiValue != null && Number(cpiValue) > 0 ? Number(cpiValue) : (country === "MY" ? 2 : 1.0);
    const categoryCatalyzer = 1.0;
    let seasonLevelMultiplier = 1.0;
    if (row.username) {
      const profileRows = await sql`
        SELECT COALESCE(season_level, 1)::int AS season_level FROM user_profiles WHERE username = ${row.username} LIMIT 1
      `;
      if (profileRows.length > 0) {
        const level = Number((profileRows[0] as { season_level: number }).season_level) || 1;
        seasonLevelMultiplier = getSeasonLevelMultiplier(level);
      }
    }
    const ryumoBonus = Math.round(ayumoTotal * cpiMultiplier * seasonLevelMultiplier * categoryCatalyzer * 100) / 100;

    await sql`
      INSERT INTO receipt_rewards (
        receipt_id, base_reward_amount, extra_reward_amount, base_hidden_cost, final_hidden_cost,
        ayumo_amount,
        ryumo_bonus_amount, cpi_multiplier_used, exchange_rate_used, season_level_multiplier_used,
        reward_version
      )
      VALUES (
        ${receiptId}, ${baseAyumo}, ${extraReward}, ${categoryHidden}, ${finalHiddenCost},
        ${ayumoTotal},
        ${ryumoBonus}, ${cpiMultiplier}, ${usdRate}, ${seasonLevelMultiplier},
        2
      )
      ON CONFLICT (receipt_id) DO UPDATE SET
        base_reward_amount = EXCLUDED.base_reward_amount,
        extra_reward_amount = EXCLUDED.extra_reward_amount,
        base_hidden_cost = EXCLUDED.base_hidden_cost,
        final_hidden_cost = EXCLUDED.final_hidden_cost,
        ayumo_amount = EXCLUDED.ayumo_amount,
        ryumo_bonus_amount = EXCLUDED.ryumo_bonus_amount,
        cpi_multiplier_used = EXCLUDED.cpi_multiplier_used,
        exchange_rate_used = EXCLUDED.exchange_rate_used,
        season_level_multiplier_used = EXCLUDED.season_level_multiplier_used,
        updated_at = now()
    `;
    // Verified: state güncelle + receipt_data.status senkronu + adres alanlarını doldur
    await sql`
      UPDATE receipts
      SET
        status = 'verified',
        post_process_state = 'verified',
        post_process_completed_at = now(),
        receipt_data = jsonb_set(
          COALESCE(receipt_data, '{}'::jsonb),
          '{status}',
          to_jsonb('verified'::text),
          true
        ),
        merchant_address = COALESCE(
          merchant_address,
          receipt_data->>'merchantAddress',
          receipt_data->'merchant'->>'address'
        ),
        branch_info = COALESCE(
          branch_info,
          receipt_data->>'branchInfo',
          receipt_data->'gptFullReceiptResult'->>'branchInfo'
        ),
        merchant_city = COALESCE(
          merchant_city,
          receipt_data->>'addressCity',
          receipt_data->'gptFullReceiptResult'->>'addressCity'
        ),
        merchant_district = COALESCE(
          merchant_district,
          receipt_data->>'addressDistrict',
          receipt_data->'gptFullReceiptResult'->>'addressDistrict'
        ),
        merchant_neighborhood = COALESCE(
          merchant_neighborhood,
          receipt_data->>'addressNeighborhood',
          receipt_data->'gptFullReceiptResult'->>'addressNeighborhood'
        ),
        merchant_street = COALESCE(
          merchant_street,
          receipt_data->>'addressStreet',
          receipt_data->'gptFullReceiptResult'->>'addressStreet'
        )
      WHERE receipt_id = ${receiptId}
    `;

    if (row.username) {
      await sql`
        INSERT INTO user_notifications (username, type, title, body, payload, receipt_id)
        SELECT
          ${row.username},
          'receipt_verified',
          'Receipt verified',
          'Your receipt analysis is completed. Tap to open claim.',
          ${JSON.stringify({ receiptId, target: 'claim_done' })}::jsonb,
          ${receiptId}
        WHERE NOT EXISTS (
          SELECT 1
          FROM user_notifications
          WHERE username = ${row.username}
            AND receipt_id = ${receiptId}
            AND type = 'receipt_verified'
        )
      `;
    }

    if (isTrustWorkerEnabled()) {
      const base = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const internalSecret = process.env.INTERNAL_SECRET;
      fetch(`${base}/api/internal/trust-update?receiptId=${encodeURIComponent(receiptId)}`, {
        method: "POST",
        cache: "no-store",
        ...(internalSecret && { headers: { Authorization: `Bearer ${internalSecret}` } }),
      }).catch((err) => console.warn("[run-post-process] trust-update fire-and-forget failed:", err?.message));
    }

    return { ok: true, receiptId, state: "verified", lineItemsWritten };
  } catch (err: unknown) {
    const sqlFail = getSql();
    if (sqlFail) {
      sqlFail`
        UPDATE receipts
        SET post_process_state = 'failed', post_process_failed_at = now(),
            post_process_retry_count = COALESCE(post_process_retry_count, 0) + 1
        WHERE receipt_id = ${receiptId}
      `.catch(() => {});
    }
    return {
      ok: false,
      receiptId,
      state: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

