/**
 * Batch-normalize Turkish grocery receipt line labels to canonical_product_taxonomy-style keys.
 * Uses OpenAI JSON mode; only called when DB fuzzy match is below threshold.
 */

import OpenAI from "openai";

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export interface LlmProductNormalization {
  raw_name: string;
  canonical_name: string;
  brand: string | null;
  unit_size: string | null;
  unit_type: string | null;
  category: string | null;
  confidence: number;
}

const SYSTEM = `You normalize Turkish grocery / supermarket receipt line items into a stable canonical product key.

Rules:
- canonical_name: lowercase snake_case, ASCII only (no Turkish chars: ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c), digits and underscore only. Include pack size in the key when obvious (e.g. 1l, 500ml, 80g, kg).
- brand: proper Turkish spelling for display when known, else null.
- unit_size / unit_type: e.g. size "1" type "L", or "500" / "ml", or null if unknown.
- category: short English slug: dairy, grocery, produce, meat, bakery, beverage, snacks, frozen, household, personal_care, other.
- confidence: 0–1 how sure you are.

Return ONLY valid JSON: { "items": [ { "raw_name", "canonical_name", "brand", "unit_size", "unit_type", "category", "confidence" } ] }

Examples:
"ÜLKER ÇUBUK KRK 80GR" → canonical_name "ulker_cubuk_kraker_80g"
"DOST AYRAN 500ML" → canonical_name "dost_ayran_500ml"
"DOMATES KG" → canonical_name "domates_kg"
"PINAR TAM YAG SUT 1LT" → canonical_name "pinar_tam_yagli_sut_1l"`;

function sanitizeCanonicalKey(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 200);
}

/**
 * Normalize up to ~20 receipt lines in one call.
 */
export async function normalizeReceiptLinesWithLLM(
  rawNames: string[]
): Promise<Map<string, LlmProductNormalization>> {
  const out = new Map<string, LlmProductNormalization>();
  if (rawNames.length === 0) return out;
  if (!client) {
    console.warn("[normalizeReceiptLinesWithLLM] OPENAI_API_KEY not set");
    return out;
  }

  const unique = [...new Set(rawNames.map((r) => r.trim()).filter(Boolean))];
  if (unique.length === 0) return out;

  const modelName =
    process.env.CANONICAL_PRODUCT_LLM_MODEL ||
    process.env.AI_MODEL_NAME ||
    "gpt-4.1-mini";

  const user = `Normalize each receipt line below. One JSON object per input line; preserve raw_name exactly as given.

Lines:
${unique.map((r, i) => `${i + 1}. ${JSON.stringify(r)}`).join("\n")}`;

  try {
    const completion = await client.chat.completions.create({
      model: modelName,
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return out;
    const cleaned = raw.trim().replace(/^```json\n?/, "").replace(/\n?```$/, "");
    const parsed = JSON.parse(cleaned) as { items?: unknown };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    for (const it of items) {
      if (!it || typeof it !== "object") continue;
      const row = it as Record<string, unknown>;
      const rawName = typeof row.raw_name === "string" ? row.raw_name.trim() : "";
      if (!rawName) continue;
      let canonical =
        typeof row.canonical_name === "string" ? sanitizeCanonicalKey(row.canonical_name) : "";
      if (!canonical) {
        canonical = sanitizeCanonicalKey(rawName);
      }
      if (!canonical) continue;
      const conf =
        typeof row.confidence === "number" && row.confidence >= 0 && row.confidence <= 1
          ? row.confidence
          : 0.7;
      out.set(rawName.toLowerCase(), {
        raw_name: rawName,
        canonical_name: canonical,
        brand: typeof row.brand === "string" ? row.brand.trim() || null : null,
        unit_size: typeof row.unit_size === "string" ? row.unit_size.trim() || null : null,
        unit_type: typeof row.unit_type === "string" ? row.unit_type.trim().toLowerCase() || null : null,
        category: typeof row.category === "string" ? row.category.trim().toLowerCase() || null : null,
        confidence: conf,
      });
    }
  } catch (e) {
    console.error("[normalizeReceiptLinesWithLLM] LLM failed:", (e as Error)?.message);
  }

  // If model returned items keyed by slightly different raw_name, alias to requested lines
  for (const line of unique) {
    const k = line.trim().toLowerCase();
    if (out.has(k)) continue;
    for (const v of out.values()) {
      if (v.raw_name.trim().toLowerCase() === k) {
        out.set(k, v);
        break;
      }
    }
  }

  return out;
}
