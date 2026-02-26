/**
 * Canonical extractor: Vision JSON + receipt context -> CanonicalPayload.
 * Used in post-process to produce product-level observations for hidden cost calculation.
 */

import type { CanonicalPayload, CanonicalMerchant, CanonicalObservation } from "../canonical-types";

export interface ExtractCanonicalContext {
  receiptId?: string;
  merchantName?: string;
  totalPaid?: number;
  paidExTax?: number;
  date?: string;
  currency?: string;
  /** Receipt-level category from analyze (e.g. groceries_fmcg) for fallback */
  category?: string;
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
 * Extract plain text from Vision API response.
 */
function getTextFromVision(vision: VisionResponseLike): string {
  const full = vision.fullTextAnnotation;
  if (full?.text && full.text.trim().length > 0) {
    return full.text.trim();
  }
  if (full?.pages?.length) {
    const lines: string[] = [];
    for (const page of full.pages) {
      for (const block of page.blocks || []) {
        for (const line of block.lines || []) {
          if (line.text?.trim()) lines.push(line.text.trim());
        }
      }
    }
    if (lines.length > 0) return lines.join("\n");
  }
  const first = vision.textAnnotations?.[0]?.description;
  if (first && first.trim().length > 0) return first.trim();
  return "";
}

/**
 * Parse a line that may end with a numeric amount (Turkish: 12,99 or 12.99 or 12 99 TL).
 * Returns { rawName, amount } or null if no amount found.
 */
function parseLineWithAmount(line: string): { rawName: string; amount: number } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  // Match trailing number: optional spaces, then number with , or . decimal, optional TL/₺
  const match = trimmed.match(
    /^(.+?)\s+(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d+)?)\s*(?:TL|₺|tl|TRY)?\s*$/i
  );
  if (match) {
    const rawName = match[1].trim();
    const amountStr = match[2].replace(/\s/g, "").replace(",", ".");
    const amount = parseFloat(amountStr);
    if (Number.isFinite(amount) && amount >= 0 && rawName.length > 0) {
      return { rawName, amount };
    }
  }
  // Fallback: last token as number
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].replace(",", ".");
    const amount = parseFloat(last);
    if (Number.isFinite(amount) && amount >= 0 && amount < 1e6) {
      const rawName = parts.slice(0, -1).join(" ").trim();
      if (rawName.length > 0) return { rawName, amount };
    }
  }
  return null;
}

/**
 * Filter out lines that are likely headers, footers, or totals (not product lines).
 */
function isLikelyProductLine(rawName: string, amount: number): boolean {
  const lower = rawName.toLowerCase();
  const totalLike = /\b(toplam|total|tutar|genel|ara\s+toplam|subtotal|kdv|vat|vergi)\b/i;
  if (totalLike.test(lower)) return false;
  if (lower.length < 2) return false;
  if (amount <= 0) return false;
  return true;
}

const NOW_ISO = () => new Date().toISOString();

/**
 * Build CanonicalPayload from Vision JSON and receipt context.
 * Uses rule-based line parsing; can be extended with LLM later.
 */
export function extractCanonicalFromVision(
  visionJson: VisionResponseLike,
  context: ExtractCanonicalContext
): CanonicalPayload {
  const text = getTextFromVision(visionJson);
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const observations: CanonicalObservation[] = [];
  for (const line of lines) {
    const parsed = parseLineWithAmount(line);
    if (!parsed) continue;
    const { rawName, amount } = parsed;
    if (!isLikelyProductLine(rawName, amount)) continue;
    observations.push({
      raw_name: rawName,
      canonical_name: rawName,
      brand: null,
      pack_size: null,
      category_lvl1: context.category || null,
      category_lvl2: null,
      unit_type: "adet",
      quantity: 1,
      unit_price_gross: amount,
      line_total_gross: amount,
      discount_amount: 0,
      vat_rate: null,
      last_price_update: NOW_ISO(),
      confidence_score: 0.8,
    });
  }

  const dateStr = context.date ?? new Date().toISOString().slice(0, 10);
  const currency = (context.currency ?? "TRY") as "TRY" | string;
  const merchant: CanonicalMerchant = {
    canonical_name: context.merchantName ?? "Unknown",
    raw_name: context.merchantName ?? undefined,
    category_lvl1: context.category ?? undefined,
    last_update: NOW_ISO(),
  };

  const totalGross = context.totalPaid ?? context.paidExTax ?? (observations.length > 0
    ? observations.reduce((s, o) => s + o.line_total_gross, 0)
    : undefined);

  const payload: CanonicalPayload = {
    receipt_file: context.receiptId ?? "",
    date: dateStr,
    currency,
    total_gross: totalGross,
    merchant,
    observations,
  };
  return payload;
}
