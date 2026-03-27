/**
 * Resolve OCR receipt line labels to canonical_product_taxonomy keys:
 * 1) pg_trgm similarity (replace _ with space) ≥ threshold → DB row
 * 2) Else batch LLM normalization → upsert taxonomy (defaults for cost columns)
 *
 * DB setup (once): CREATE EXTENSION IF NOT EXISTS pg_trgm;
 * + GIN index on lower(replace(canonical_name::text, '_', ' ')) gin_trgm_ops
 *   for fast similarity(). Without it, fuzzy step is skipped and LLM is used.
 */

import { db } from "@/lib/db/client";
import type { CanonicalObservation } from "../canonical-types";
import type { TaxonomyRow } from "./line-hidden-cost";
import { normalizeReceiptLinesWithLLM } from "./normalize-product-llm";

const FUZZY_THRESHOLD = 0.85;
/** Default FMCG-style cost split for LLM-created taxonomy rows (sums to 100). */
const DEFAULT_PCTS = {
  raw_material_pct: 55,
  labor_pct: 12,
  rent_pct: 10,
  energy_pct: 8,
  other_pct: 15,
  labor_type: "manufacturing" as const,
  profit_margin: 25,
};

function normQuery(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Map English LLM category slugs to taxonomy category_lvl1 (Turkish keys). */
function llmCategoryToLvl1(cat: string | null | undefined): string {
  const c = (cat ?? "other").toLowerCase().trim();
  const map: Record<string, string> = {
    dairy: "gıda",
    grocery: "gıda",
    produce: "gıda",
    meat: "gıda",
    bakery: "gıda",
    beverage: "gıda",
    snacks: "gıda",
    frozen: "gıda",
    household: "gıda",
    personal_care: "kozmetik",
    electronics: "elektronik",
    apparel: "giyim",
    beauty: "kozmetik",
    other: "gıda",
  };
  return map[c] ?? "gıda";
}

function mapUnitTypeToObservation(u: string | null | undefined): string {
  if (!u) return "adet";
  const t = u.toLowerCase();
  if (t === "l" || t === "lt" || t === "liter") return "l";
  if (t === "ml") return "ml";
  if (t === "kg") return "kg";
  if (t === "g" || t === "gr") return "g";
  if (t === "adet" || t === "pcs" || t === "pk") return "adet";
  return t;
}

function packSizeFromLlm(size: string | null, type: string | null): string | null {
  if (size && type) return `${size}${type}`;
  if (size) return size;
  return null;
}

async function fuzzyMatchTaxonomyBulk(
  rawNames: string[]
): Promise<Map<string, { row: TaxonomyRow; similarity: number }>> {
  const map = new Map<string, { row: TaxonomyRow; similarity: number }>();
  const uniq = [...new Set(rawNames.map(normQuery).filter((q) => q.length > 0))];
  if (uniq.length === 0) return map;

  const query = `
WITH wanted AS (
  SELECT DISTINCT trim(lower(x)) AS q
  FROM unnest($1::text[]) AS t(x)
  WHERE length(trim(x)) > 0
),
best AS (
  SELECT
    w.q,
    t.canonical_name,
    t.category_lvl1,
    t.category_lvl2,
    t.raw_material_pct,
    t.labor_pct,
    t.rent_pct,
    t.energy_pct,
    t.other_pct,
    t.labor_type,
    t.profit_margin,
    similarity(
      lower(replace(t.canonical_name::text, '_', ' ')),
      w.q
    ) AS sim
  FROM wanted w
  CROSS JOIN LATERAL (
    SELECT
      canonical_name,
      category_lvl1,
      category_lvl2,
      raw_material_pct,
      labor_pct,
      rent_pct,
      energy_pct,
      other_pct,
      labor_type,
      profit_margin
    FROM canonical_product_taxonomy t
    ORDER BY similarity(
      lower(replace(t.canonical_name::text, '_', ' ')),
      w.q
    ) DESC
    LIMIT 1
  ) t
)
SELECT * FROM best WHERE sim >= $2::float
`;

  try {
    const { rows } = await db.query<{
      q: string;
      canonical_name: string;
      category_lvl1: string;
      category_lvl2: string | null;
      raw_material_pct: string | number;
      labor_pct: string | number;
      rent_pct: string | number;
      energy_pct: string | number;
      other_pct: string | number;
      labor_type: string;
      profit_margin: string | number;
      sim: string | number;
    }>(query, [uniq, FUZZY_THRESHOLD]);

    for (const r of rows) {
      const row: TaxonomyRow = {
        canonical_name: r.canonical_name,
        category_lvl1: r.category_lvl1,
        category_lvl2: r.category_lvl2,
        raw_material_pct: Number(r.raw_material_pct),
        labor_pct: Number(r.labor_pct),
        rent_pct: Number(r.rent_pct),
        energy_pct: Number(r.energy_pct),
        other_pct: Number(r.other_pct),
        labor_type: r.labor_type === "service" ? "service" : "manufacturing",
        profit_margin: Number(r.profit_margin),
      };
      map.set(r.q, { row, similarity: Number(r.sim) });
    }
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    if (/pg_trgm|similarity|does not exist|function similarity/i.test(msg)) {
      console.warn(
        "[resolve-canonical-product] Fuzzy taxonomy skipped (pg_trgm / similarity). Apply sql/037_pg_trgm_taxonomy_fuzzy.sql:",
        msg
      );
    } else {
      console.warn("[resolve-canonical-product] fuzzyMatchTaxonomyBulk failed:", msg);
    }
  }

  return map;
}

async function upsertTaxonomyFromLlm(
  canonicalName: string,
  categoryLvl1: string,
  categoryLvl2: string | null
): Promise<void> {
  const ins = `
INSERT INTO canonical_product_taxonomy (
  canonical_name,
  category_lvl1,
  category_lvl2,
  raw_material_pct,
  labor_pct,
  rent_pct,
  energy_pct,
  other_pct,
  labor_type,
  profit_margin
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text, $10)
ON CONFLICT (canonical_name) DO NOTHING
`;
  try {
    await db.query(ins, [
      canonicalName,
      categoryLvl1,
      categoryLvl2,
      DEFAULT_PCTS.raw_material_pct,
      DEFAULT_PCTS.labor_pct,
      DEFAULT_PCTS.rent_pct,
      DEFAULT_PCTS.energy_pct,
      DEFAULT_PCTS.other_pct,
      DEFAULT_PCTS.labor_type,
      DEFAULT_PCTS.profit_margin,
    ]);
  } catch (e) {
    console.warn(
      "[resolve-canonical-product] upsertTaxonomyFromLlm failed:",
      (e as Error)?.message
    );
  }
}

const LLM_BATCH = 18;

/**
 * Mutates observations: sets canonical_name, brand, pack_size, category_lvl1, unit_type, confidence_score.
 */
export async function resolveCanonicalObservations(
  observations: CanonicalObservation[]
): Promise<void> {
  if (!observations.length) return;

  const rawNames = observations.map((o) => o.raw_name).filter(Boolean);
  const fuzzyByNorm = await fuzzyMatchTaxonomyBulk(rawNames);

  const fuzzyResolvedNorm = new Set<string>();
  for (const obs of observations) {
    const q = normQuery(obs.raw_name);
    const hit = q ? fuzzyByNorm.get(q) : undefined;
    if (hit && hit.similarity >= FUZZY_THRESHOLD) {
      obs.canonical_name = hit.row.canonical_name;
      obs.category_lvl1 = hit.row.category_lvl1;
      obs.category_lvl2 = hit.row.category_lvl2;
      obs.confidence_score = Math.max(obs.confidence_score ?? 0.8, hit.similarity);
      fuzzyResolvedNorm.add(q);
    }
  }

  const needLlm = observations
    .filter((o) => !fuzzyResolvedNorm.has(normQuery(o.raw_name)))
    .map((o) => o.raw_name);
  const uniqueLlm = [...new Set(needLlm.map((r) => r.trim()).filter(Boolean))];
  if (uniqueLlm.length === 0) return;

  for (let i = 0; i < uniqueLlm.length; i += LLM_BATCH) {
    const chunk = uniqueLlm.slice(i, i + LLM_BATCH);
    const llmMap = await normalizeReceiptLinesWithLLM(chunk);

    for (const obs of observations) {
      const q = normQuery(obs.raw_name);
      if (fuzzyResolvedNorm.has(q)) continue;

      const llm =
        llmMap.get(obs.raw_name.toLowerCase()) ||
        llmMap.get(q) ||
        llmMap.get(obs.raw_name.trim());
      if (!llm) continue;

      const cat1 = llmCategoryToLvl1(llm.category);
      const cat2 = llm.category && llm.category !== "other" ? llm.category : null;

      await upsertTaxonomyFromLlm(llm.canonical_name, cat1, cat2);

      obs.canonical_name = llm.canonical_name;
      if (llm.brand) obs.brand = llm.brand;
      obs.pack_size = packSizeFromLlm(llm.unit_size, llm.unit_type);
      obs.category_lvl1 = cat1;
      obs.category_lvl2 = cat2;
      obs.unit_type = mapUnitTypeToObservation(llm.unit_type);
      obs.confidence_score = llm.confidence;
    }
  }
}
