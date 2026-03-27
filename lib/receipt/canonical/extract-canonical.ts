/**
 * Canonical extractor: structured LLM line items (Gemini / GPT-4o fallback) → CanonicalPayload.
 * Vision OCR regex fallback removed; lines must come from persisted geminiLineItems.
 */

import type { CanonicalPayload, CanonicalMerchant, CanonicalObservation } from "../canonical-types";

const NOW_ISO = () => new Date().toISOString();

/** Birim — Gemini çıktısı ve `receipt_data.geminiLineItems` ile uyumlu */
export type GeminiStructuredLineUnitType = "adet" | "kg" | "g" | "l" | "ml";

/** One line from Gemini receipt JSON (same shape as gemini-vision-service lineItems). */
export type GeminiStructuredLineItem = {
  name: string;
  brand?: string | null;              // Marka adı — Gemini'nin ayrıştırdığı (ör. "Ülker", "Pınar")
  quantity?: number;
  unitType?: GeminiStructuredLineUnitType;
  unitPrice?: number;
  totalPrice?: number;
  vatRate?: number;
  /** Ana ürün kategorisi (Türkçe). Örn: "Süt & Süt Ürünleri", "Meyve & Sebze" */
  category?: string | null;
  /** Alt kategori. Örn: "Peynir", "Taze Meyve" */
  subcategory?: string | null;
};

export interface ExtractCanonicalContext {
  receiptId?: string;
  merchantName?: string;
  totalPaid?: number;
  paidExTax?: number;
  date?: string;
  currency?: string;
  /** Receipt-level category from analyze (e.g. groceries_fmcg) for fallback */
  category?: string;
  /** From analyze pipeline (Gemini or GPT-4o OCR fallback); persisted in receipt_data for Faz-2 */
  geminiLineItems?: GeminiStructuredLineItem[];
}

/** Vision API response: responses[0] with fullTextAnnotation or textAnnotations */
export interface VisionResponseLike {
  fullTextAnnotation?: {
    text?: string;
    pages?: Array<{
      blocks?: Array<{
        lines?: Array<{ text?: string }>;
      }>;
    }>;
  };
  textAnnotations?: Array<{ description?: string }>;
}

/**
 * Read geminiLineItems saved inside receipts.receipt_data JSON.
 */
export function parseGeminiLineItemsFromReceiptData(receiptData: unknown): GeminiStructuredLineItem[] | undefined {
  if (receiptData == null) return undefined;
  let data: Record<string, unknown>;
  try {
    data = typeof receiptData === "string" ? (JSON.parse(receiptData) as Record<string, unknown>) : (receiptData as Record<string, unknown>);
  } catch {
    return undefined;
  }
  const items = data.geminiLineItems;
  if (!Array.isArray(items) || items.length === 0) return undefined;
  const out: GeminiStructuredLineItem[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    const q = o.quantity;
    const up = o.unitPrice;
    const tp = o.totalPrice;
    const vr = o.vatRate;
    const unitType = parseStoredGeminiUnitType(o.unitType);
    const brand = typeof o.brand === "string" && o.brand.trim() ? o.brand.trim() : null;
    const category = typeof o.category === "string" && o.category.trim() ? o.category.trim() : null;
    const subcategory = typeof o.subcategory === "string" && o.subcategory.trim() ? o.subcategory.trim() : null;
    out.push({
      name,
      brand,
      quantity: typeof q === "number" && q > 0 ? q : undefined,
      unitType,
      unitPrice: typeof up === "number" && Number.isFinite(up) ? up : undefined,
      totalPrice: typeof tp === "number" && Number.isFinite(tp) ? tp : undefined,
      vatRate: typeof vr === "number" && Number.isFinite(vr) ? vr : undefined,
      category,
      subcategory,
    });
  }
  return out.length > 0 ? out : undefined;
}

/** GPT-4o full-receipt fallback: context'te kalıyordu ama API yanıtına eklenmediği için DB'de eksik kalan kayıtlar. */
function parseGptFullLineItemsFromReceiptData(receiptData: unknown): GeminiStructuredLineItem[] | undefined {
  let data: Record<string, unknown>;
  try {
    data =
      typeof receiptData === "string"
        ? (JSON.parse(receiptData) as Record<string, unknown>)
        : ((receiptData as Record<string, unknown>) ?? {});
  } catch {
    return undefined;
  }
  const gpt = data.gptFullReceiptResult;
  if (!gpt || typeof gpt !== "object") return undefined;
  const lineItems = (gpt as Record<string, unknown>).lineItems;
  if (!Array.isArray(lineItems) || lineItems.length === 0) return undefined;
  const out: GeminiStructuredLineItem[] = [];
  for (const li of lineItems) {
    if (!li || typeof li !== "object") continue;
    const o = li as Record<string, unknown>;
    const name = typeof o.name === "string" ? o.name.trim() : "";
    if (!name) continue;
    const ut = o.unitType;
    const unitType =
      ut === "adet" || ut === "kg" || ut === "g" || ut === "l" || ut === "ml" ? ut : undefined;
    const q = o.quantity;
    const up = o.unitPrice;
    const tp = o.totalPrice;
    let vr = o.vatRate;
    if (typeof vr === "number" && Number.isFinite(vr) && vr > 1 && vr <= 100) vr = vr / 100;
    const cat = typeof o.category === "string" && o.category.trim() ? o.category.trim() : null;
    const subcat = typeof o.subcategory === "string" && o.subcategory.trim() ? o.subcategory.trim() : null;
    out.push({
      name,
      quantity: typeof q === "number" && q > 0 ? q : undefined,
      unitType,
      unitPrice: typeof up === "number" && Number.isFinite(up) ? up : undefined,
      totalPrice: typeof tp === "number" && Number.isFinite(tp) ? tp : undefined,
      vatRate: typeof vr === "number" && Number.isFinite(vr) && vr >= 0 && vr <= 1 ? vr : undefined,
      category: cat,
      subcategory: subcat,
    });
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Faz-2 girişi: önce receipt_data.geminiLineItems, yoksa gptFullReceiptResult.lineItems.
 */
export function parseStructuredLineItemsFromReceiptData(
  receiptData: unknown
): GeminiStructuredLineItem[] | undefined {
  const fromGemini = parseGeminiLineItemsFromReceiptData(receiptData);
  if (fromGemini && fromGemini.length > 0) return fromGemini;
  return parseGptFullLineItemsFromReceiptData(receiptData);
}

/**
 * Bazı LLM çıktılarında sadece ürün adı var; geminiLineToObservation fiyat ister.
 * paidExTax > 0 ise kalan tutarı miktar ağırlığıyla satırlara böler (gösterim + gizli maliyet için).
 */
export function allocateLinePricesWhenMissing(
  items: GeminiStructuredLineItem[],
  paidExTax: number
): GeminiStructuredLineItem[] {
  if (!items.length || paidExTax <= 0) return items;
  const anyMissing = items.some(
    (i) =>
      !(
        (i.unitPrice != null && i.unitPrice > 0) ||
        (i.totalPrice != null && i.totalPrice > 0)
      )
  );
  if (!anyMissing) return items;
  const weights = items.map((i) =>
    Math.max(1e-6, i.quantity != null && i.quantity > 0 ? i.quantity : 1)
  );
  const totalW = weights.reduce((a, b) => a + b, 0);
  return items.map((item, idx) => {
    const hasU = item.unitPrice != null && item.unitPrice > 0;
    const hasT = item.totalPrice != null && item.totalPrice > 0;
    if (hasU || hasT) return item;
    const share = (weights[idx] / totalW) * paidExTax;
    const q = item.quantity != null && item.quantity > 0 ? item.quantity : 1;
    return { ...item, totalPrice: share, unitPrice: share / q };
  });
}

/** receipt_data / API'den gelen serbest değeri izinli birime çevir; geçersiz → undefined (observation'da adet). */
function parseStoredGeminiUnitType(raw: unknown): GeminiStructuredLineUnitType | undefined {
  if (raw == null || raw === "") return undefined;
  const s = String(raw).trim().toLowerCase();
  if (s === "adet" || s === "kg" || s === "g" || s === "l" || s === "ml") return s;
  if (s === "lt") return "l";
  return undefined;
}

function geminiLineToObservation(
  item: GeminiStructuredLineItem,
  context: ExtractCanonicalContext
): CanonicalObservation | null {
  const name = item.name.trim();
  if (!name) return null;

  const qty =
    item.quantity != null && Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;

  let unitP = item.unitPrice;
  let totalP = item.totalPrice;
  const uOk = unitP != null && Number.isFinite(unitP) && unitP > 0;
  const tOk = totalP != null && Number.isFinite(totalP) && totalP > 0;

  if (uOk && tOk) {
    /* keep both */
  } else if (uOk && !tOk) {
    totalP = unitP! * qty;
  } else if (!uOk && tOk) {
    unitP = totalP! / qty;
  } else {
    return null;
  }

  return {
    raw_name: name,
    canonical_name: name,
    brand: item.brand ?? null,
    pack_size: null,
    // GPT'den gelen ürün kategorisi önce kullanılır; yoksa merchant kategorisi fallback
    category_lvl1: (item.category?.trim() || null) ?? context.category ?? null,
    category_lvl2: item.subcategory?.trim() || null,
    unit_type: item.unitType ?? "adet",
    quantity: qty,
    unit_price_gross: unitP!,
    line_total_gross: totalP!,
    discount_amount: 0,
    vat_rate: item.vatRate != null && Number.isFinite(item.vatRate) ? item.vatRate : null,
    last_price_update: NOW_ISO(),
    confidence_score: 0.9,
  };
}

/**
 * Build CanonicalPayload from structured LLM line items only (no OCR line regex).
 */
export function extractCanonicalFromVision(
  visionJson: VisionResponseLike | null | undefined,
  context: ExtractCanonicalContext
): CanonicalPayload {
  const vision = visionJson ?? {};

  let observations: CanonicalObservation[] = [];
  if (context.geminiLineItems && context.geminiLineItems.length > 0) {
    for (const item of context.geminiLineItems) {
      const obs = geminiLineToObservation(item, context);
      if (obs) observations.push(obs);
    }
  }

  if (observations.length === 0) {
    const hasVisionText =
      Boolean(vision.fullTextAnnotation?.text?.trim()) ||
      Boolean(vision.textAnnotations && vision.textAnnotations.length > 0);
    if (hasVisionText) {
      console.warn(
        "[extractCanonicalFromVision] No structured line items; OCR regex fallback disabled — observations empty."
      );
    } else {
      console.warn("[extractCanonicalFromVision] No structured line items and no Vision text; observations empty.");
    }
  }

  const dateStr = context.date ?? new Date().toISOString().slice(0, 10);
  const currency = (context.currency ?? "TRY") as "TRY" | string;
  const merchant: CanonicalMerchant = {
    canonical_name: context.merchantName ?? "Unknown",
    raw_name: context.merchantName ?? undefined,
    category_lvl1: context.category ?? undefined,
    last_update: NOW_ISO(),
  };

  const totalGross =
    context.totalPaid ??
    context.paidExTax ??
    (observations.length > 0 ? observations.reduce((s, o) => s + o.line_total_gross, 0) : undefined);

  return {
    receipt_file: context.receiptId ?? "",
    date: dateStr,
    currency,
    total_gross: totalGross,
    merchant,
    observations,
  };
}
