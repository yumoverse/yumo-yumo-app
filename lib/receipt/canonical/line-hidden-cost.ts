/**
 * Line-level reference price and hidden cost calculation for canonical observations.
 *
 * Metodoloji (YUMO HiddenCost Metodolojisi v3 — Dual Model):
 *
 *   Her kategori iki modelden birine atanmıştır (bkz. production_cost_weights.model_type):
 *
 *   producer_gap (fiziksel ürünler — groceries_fmcg, apparel, electronics, beauty, home):
 *     "Bu ürünü üreticiden/fabrikadan alsaydın ne kadar daha az öderdin?"
 *     Öncelik:
 *       0  → TÜİK resmi ortalama perakende fiyatı
 *       0.5 → Taxonomy bazlı PPI ağırlıklı maliyet hesabı (canonical_product_taxonomy)
 *       1  → Kategori bazlı PPI ağırlıklı maliyet hesabı (production_cost_weights)
 *       2  → profit_margin_factor
 *       3  → fallback_rate
 *
 *   market_benchmark (hizmetler — food_delivery, hospitality, travel, services_digital):
 *     "Bu hizmet için sektör ortalaması X TL, sen Y TL ödedin."
 *     Öncelik:
 *       0  → TÜİK resmi ortalama fiyatı
 *       B  → TÜİK TÜFE alt serisi CPI benchmark endeksi (benchmark_series)
 *              ReferencePrice = line_total / CPI_benchmark_index
 *       2  → profit_margin_factor
 *       3  → fallback_rate
 *
 *   fallback (other kategorisi):
 *     ReferencePrice = line_total / avg(TÜFE_GENEL_index, ÜFE_C_index)
 *
 * Kaynaklar:
 *   TÜİK Ortalama Fiyatlar: veriportali.tuik.gov.tr (Ocak 2026, 428 ürün)
 *   TCMB Enflasyon Raporu 2026-I, 12 Şubat 2026
 *   Dual HiddenCost Mimarisi Tasarım Belgesi, 19 Şubat 2026
 */

import type { CanonicalObservation, CanonicalPayload } from "../canonical-types";
import type { TuikPriceResult } from "@/lib/mining/tuikReferencePrice";
import type { HiddenCostModelType } from "@/lib/mining/types";

// ─────────────────────────────────────────────
// Tipler
// ─────────────────────────────────────────────

export interface ProductionCostWeightsRow {
  raw_material_pct: number;
  labor_pct: number;
  rent_pct: number;
  energy_pct: number;
  other_pct: number;
  profit_margin_factor: number;
  /** Hesaplama modeli: producer_gap | market_benchmark | fallback */
  model_type: HiddenCostModelType;
  /** market_benchmark için TÜİK TÜFE alt serisi kodu (ör. "11", "07", "08") */
  benchmark_series: string | null;
}

export interface LineHiddenCostResult {
  observation: CanonicalObservation;
  reference_price: number;
  hidden_cost_line: number;
  /**
   * Hangi hesap yolunun kullanıldığı:
   *   tuik_official      — TÜİK resmi ortalama fiyat
   *   taxonomy_weighted  — canonical_product_taxonomy ürün bazlı PPI ağırlıklı
   *   weighted_index     — production_cost_weights kategori bazlı PPI ağırlıklı (producer_gap)
   *   market_benchmark_cpi — TÜİK TÜFE alt serisi benchmark (market_benchmark)
   *   fallback_avg_index — avg(TÜFE GENEL + ÜFE C) (other/fallback)
   *   profit_margin_factor — sadece profit_margin_factor divisör
   *   fallback_rate      — sabit oran (hiçbir veri yok)
   */
  calc_method:
    | "tuik_official"
    | "taxonomy_weighted"
    | "weighted_index"
    | "market_benchmark_cpi"
    | "fallback_avg_index"
    | "profit_margin_factor"
    | "fallback_rate";
  /** model_type bilgisi — loglama ve frontend gösterimi için */
  model_type?: HiddenCostModelType;
  /** TÜİK eşleşmesi varsa: hangi ürün hangi fiyatla eşleşti */
  tuik_match?: Pick<TuikPriceResult, "canonical_key" | "tuik_name" | "avg_price_tl" | "match_type">;
  /** Taxonomy eşleşmesi varsa: hangi canonical ürün kaydı kullanıldı */
  taxonomy_match?: { canonical_name: string; category_lvl2: string; labor_type: string };
}

/** canonical_product_taxonomy tablosundan dönen satır */
export interface TaxonomyRow {
  canonical_name:   string;
  category_lvl1:    string;
  category_lvl2:    string | null;
  raw_material_pct: number;
  labor_pct:        number;
  rent_pct:         number;
  energy_pct:       number;
  other_pct:        number;
  labor_type:       "manufacturing" | "service";
  profit_margin:    number;
}

export interface ComputeLineHiddenCostInput {
  payload: CanonicalPayload;
  country: string;
  yearMonth: string;
  /** Fallback hidden rate (0-1): hiçbir veri yoksa kullanılır */
  fallbackHiddenRate: number;
  /** Pre-fetched production cost weights by internal category */
  weightsByCategory?: Record<string, ProductionCostWeightsRow>;
  /** Pre-fetched economic index multipliers (bkz. fetchEconomicIndexMultipliers) */
  economicMultipliers?: EconomicIndexMultipliers;
  /**
   * Pre-fetched TÜİK reference prices: canonical_key → TuikPriceResult
   * bkz. getTuikReferencePriceBulk()
   */
  tuikPrices?: Map<string, TuikPriceResult>;
  /**
   * Pre-fetched canonical_product_taxonomy: canonical_name → TaxonomyRow
   * Ürün bazlı maliyet ağırlıkları; kategori ağırlıklarından önce sorgulanır.
   * bkz. fetchTaxonomyBulk()
   */
  taxonomyByName?: Map<string, TaxonomyRow>;
}

/**
 * Ekonomik endeks çarpanları.
 * Değer: (1 + yıllık_değişim/100)
 * Örn: işçilik %40.3 artış → labor = 1.403
 * Eksik değerler 1.0 (nötr) kabul edilir.
 */
export interface EconomicIndexMultipliers {
  /** PPI/TARIM → ham madde maliyet çarpanı (producer_gap) */
  raw_material?: number;
  /** LABOR/TARIM_DISI_NOMINAL → işçilik çarpanı (producer_gap) */
  labor?: number;
  /** RENT/TUIK_GERCEK → kira çarpanı (producer_gap) */
  rent?: number;
  /** FUEL/ENERJI_TRENDYIL → enerji çarpanı (producer_gap) */
  energy?: number;
  /** CPI/GENEL → genel TÜFE çarpanı (fallback + service labor proxy) */
  other?: number;
  /** CPI-11: Lokanta ve Otel TÜFE — food_delivery, hospitality_lodging (market_benchmark) */
  cpi_11?: number;
  /** CPI-07: Ulaştırma TÜFE — travel_ticket (market_benchmark) */
  cpi_07?: number;
  /** CPI-08: Haberleşme TÜFE — services_digital (market_benchmark) */
  cpi_08?: number;
  /** PPI-C: İmalat ÜFE — fallback avg hesabı için */
  ppi_c?: number;
}

// ─────────────────────────────────────────────
// Yardımcı: kategori eşleme
// ─────────────────────────────────────────────

function toInternalCategory(
  categoryLvl1: string | null | undefined,
  receiptCategory?: string
): string {
  const raw = (categoryLvl1 ?? receiptCategory ?? "").toLowerCase().trim();
  const map: Record<string, string> = {
    gıda: "groceries_fmcg",
    gida: "groceries_fmcg",
    grocery: "groceries_fmcg",
    groceries: "groceries_fmcg",
    supermarket: "groceries_fmcg",
    fmcg: "groceries_fmcg",
    giyim: "apparel_fashion",
    apparel: "apparel_fashion",
    fashion: "apparel_fashion",
    elektronik: "electronics",
    electronics: "electronics",
    kozmetik: "beauty_personal_care",
    beauty: "beauty_personal_care",
    ev: "home_living",
    home: "home_living",
    mobilya: "home_living",
    seyahat: "travel_ticket",
    travel: "travel_ticket",
    yemek: "food_delivery",
    food: "food_delivery",
    restoran: "food_delivery",
    kafe: "food_delivery",
    cafe: "food_delivery",
    dijital: "services_digital",
    digital: "services_digital",
    konaklama: "hospitality_lodging",
    hotel: "hospitality_lodging",
  };
  return map[raw] ?? "other";
}

/**
 * benchmark_series kodunu EconomicIndexMultipliers içindeki ilgili çarpana çevirir.
 * "11" → cpi_11, "07" → cpi_07, "08" → cpi_08, diğerleri → other (genel CPI fallback)
 */
function getBenchmarkMultiplier(
  benchmarkSeries: string | null | undefined,
  multipliers: EconomicIndexMultipliers
): number {
  if (!benchmarkSeries) return multipliers.other ?? 1.0;
  switch (benchmarkSeries) {
    case "11": return multipliers.cpi_11 ?? multipliers.other ?? 1.0;
    case "07": return multipliers.cpi_07 ?? multipliers.other ?? 1.0;
    case "08": return multipliers.cpi_08 ?? multipliers.other ?? 1.0;
    default:   return multipliers.other ?? 1.0;
  }
}

// ─────────────────────────────────────────────
// Ana hesap: computeLineHiddenCosts
// ─────────────────────────────────────────────

/**
 * Her observation için ReferencePrice ve HiddenCost hesaplar.
 * Model tipi (producer_gap | market_benchmark | fallback) weights.model_type'tan belirlenir.
 */
export function computeLineHiddenCosts(input: ComputeLineHiddenCostInput): {
  results: LineHiddenCostResult[];
  totalHiddenCanonical: number;
} {
  const {
    payload,
    fallbackHiddenRate,
    weightsByCategory = {},
    economicMultipliers,
    tuikPrices,
    taxonomyByName,
  } = input;

  const receiptCategory = payload.merchant?.category_lvl1 ?? undefined;
  const results: LineHiddenCostResult[] = [];

  for (const obs of payload.observations) {
    const lineTotal = obs.line_total_gross ?? 0;

    if (lineTotal <= 0) {
      results.push({
        observation: obs,
        reference_price: 0,
        hidden_cost_line: 0,
        calc_method: "fallback_rate",
        model_type: "fallback",
      });
      continue;
    }

    const internalCat = toInternalCategory(obs.category_lvl1, receiptCategory);
    const weights = weightsByCategory[internalCat];
    const modelType: HiddenCostModelType = weights?.model_type ?? "fallback";

    let reference: number;
    let calc_method: LineHiddenCostResult["calc_method"];
    let tuik_match: LineHiddenCostResult["tuik_match"] | undefined;
    let taxonomy_match: LineHiddenCostResult["taxonomy_match"] | undefined;

    // ── Yol 0: TÜİK resmi ortalama fiyat (her model için en önce denenir) ───
    if (tuikPrices && tuikPrices.size > 0) {
      const { buildSearchKey } = require("@/lib/mining/tuikReferencePrice") as typeof import("@/lib/mining/tuikReferencePrice");
      const searchKey = buildSearchKey(obs.canonical_name || obs.raw_name, obs.unit_type ?? undefined);
      const tuikResult = tuikPrices.get(searchKey);

      if (tuikResult) {
        const qty = obs.quantity && obs.quantity > 0 ? obs.quantity : 1;
        const tuikLineRef = tuikResult.avg_price_tl * qty;
        if (tuikLineRef > 0 && tuikLineRef <= lineTotal * 3) {
          reference = tuikLineRef;
          calc_method = "tuik_official";
          tuik_match = {
            canonical_key: tuikResult.canonical_key,
            tuik_name:     tuikResult.tuik_name,
            avg_price_tl:  tuikResult.avg_price_tl,
            match_type:    tuikResult.match_type,
          };
          const hidden = Math.max(0, lineTotal - reference);
          results.push({
            observation: obs,
            reference_price: Math.round(reference * 100) / 100,
            hidden_cost_line: Math.round(hidden * 100) / 100,
            calc_method,
            model_type: modelType,
            tuik_match,
          });
          continue;
        }
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // MODEL AYRIMI: TÜİK fiyatı bulunamadıysa model tipine göre farklı yollar
    // ════════════════════════════════════════════════════════════════════════

    if (modelType === "producer_gap") {
      // ── PRODUCER GAP: Tedarik zinciri marjı (PPI bazlı) ──────────────────
      //
      // Yol 0.5: Ürün bazlı taxonomy (canonical_product_taxonomy)
      if (taxonomyByName && taxonomyByName.size > 0 && economicMultipliers) {
        const productKey = (obs.canonical_name || obs.raw_name || "").toLowerCase().trim();
        const taxRow = productKey ? taxonomyByName.get(productKey) : undefined;

        if (taxRow) {
          const rm = economicMultipliers.raw_material ?? 1.0;
          const lb = taxRow.labor_type === "service"
            ? (economicMultipliers.cpi_11 ?? economicMultipliers.other ?? 1.0)
            : (economicMultipliers.labor ?? 1.0);
          const rn = economicMultipliers.rent   ?? 1.0;
          const en = economicMultipliers.energy ?? 1.0;
          const ot = economicMultipliers.other  ?? 1.0;

          const rmW = taxRow.raw_material_pct / 100;
          const lbW = taxRow.labor_pct        / 100;
          const rnW = taxRow.rent_pct         / 100;
          const enW = taxRow.energy_pct       / 100;
          const otW = taxRow.other_pct        / 100;

          const costMultiplier = rmW * rm + lbW * lb + rnW * rn + enW * en + otW * ot;
          const profitFactor   = 1 + taxRow.profit_margin / 100;

          if (costMultiplier > 0) {
            reference = lineTotal / (costMultiplier * profitFactor);
            calc_method = "taxonomy_weighted";
            taxonomy_match = {
              canonical_name: taxRow.canonical_name,
              category_lvl2:  taxRow.category_lvl2 ?? "",
              labor_type:     taxRow.labor_type,
            };
            const hidden = Math.max(0, lineTotal - reference);
            results.push({
              observation: obs,
              reference_price:  Math.round(reference * 100) / 100,
              hidden_cost_line: Math.round(hidden * 100) / 100,
              calc_method,
              model_type: modelType,
              taxonomy_match,
            });
            continue;
          }
        }
      }

      // Yol 1: Kategori bazlı ağırlıklı PPI endeksi
      if (weights && weights.profit_margin_factor >= 1 && economicMultipliers) {
        const rm = economicMultipliers.raw_material ?? 1.0;
        const lb = economicMultipliers.labor        ?? 1.0;
        const rn = economicMultipliers.rent         ?? 1.0;
        const en = economicMultipliers.energy       ?? 1.0;
        const ot = economicMultipliers.other        ?? 1.0;

        const costMultiplier =
          weights.raw_material_pct * rm +
          weights.labor_pct        * lb +
          weights.rent_pct         * rn +
          weights.energy_pct       * en +
          weights.other_pct        * ot;

        reference = lineTotal / costMultiplier;
        calc_method = "weighted_index";
      } else if (weights && weights.profit_margin_factor >= 1) {
        // Yol 2: Endeks yok, sadece profit_margin_factor
        reference = lineTotal / weights.profit_margin_factor;
        calc_method = "profit_margin_factor";
      } else {
        // Yol 3: Fallback oran
        const rate = Math.max(0, Math.min(1, fallbackHiddenRate));
        reference = lineTotal / (1 + rate);
        calc_method = "fallback_rate";
      }

    } else if (modelType === "market_benchmark") {
      // ── MARKET BENCHMARK: Sektör ortalaması karşılaştırması (CPI bazlı) ──
      //
      // Yol B: benchmark_series CPI endeksini divisör olarak kullan
      // Yorum: "Bu ay sektör fiyatları CPI_benchmark_index kadar arttı;
      //         eğer ortalama seviyede ödenseydi line_total / index olurdu."
      if (economicMultipliers && weights?.benchmark_series) {
        const benchmarkIdx = getBenchmarkMultiplier(weights.benchmark_series, economicMultipliers);
        if (benchmarkIdx > 1.0) {
          // Benchmark index > 1 ise gerçek enflasyon var, anlamlı hesap
          reference = lineTotal / benchmarkIdx;
          calc_method = "market_benchmark_cpi";
        } else if (weights.profit_margin_factor >= 1) {
          reference = lineTotal / weights.profit_margin_factor;
          calc_method = "profit_margin_factor";
        } else {
          const rate = Math.max(0, Math.min(1, fallbackHiddenRate));
          reference = lineTotal / (1 + rate);
          calc_method = "fallback_rate";
        }
      } else if (weights && weights.profit_margin_factor >= 1) {
        reference = lineTotal / weights.profit_margin_factor;
        calc_method = "profit_margin_factor";
      } else {
        const rate = Math.max(0, Math.min(1, fallbackHiddenRate));
        reference = lineTotal / (1 + rate);
        calc_method = "fallback_rate";
      }

    } else {
      // ── FALLBACK (other): avg(TÜFE GENEL + ÜFE C) ────────────────────────
      if (economicMultipliers) {
        const cpiGenel = economicMultipliers.other   ?? 1.0;  // CPI GENEL
        const ppiC     = economicMultipliers.ppi_c   ?? economicMultipliers.labor ?? 1.0;  // PPI C
        const avgIdx   = (cpiGenel + ppiC) / 2;
        if (avgIdx > 1.0) {
          reference = lineTotal / avgIdx;
          calc_method = "fallback_avg_index";
        } else {
          const rate = Math.max(0, Math.min(1, fallbackHiddenRate));
          reference = lineTotal / (1 + rate);
          calc_method = "fallback_rate";
        }
      } else {
        const rate = Math.max(0, Math.min(1, fallbackHiddenRate));
        reference = lineTotal / (1 + rate);
        calc_method = "fallback_rate";
      }
    }

    const hidden = Math.max(0, lineTotal - reference);

    results.push({
      observation: obs,
      reference_price: Math.round(reference * 100) / 100,
      hidden_cost_line: Math.round(hidden * 100) / 100,
      calc_method,
      model_type: modelType,
      taxonomy_match,
    });
  }

  const totalHiddenCanonical =
    Math.round(results.reduce((s, r) => s + r.hidden_cost_line, 0) * 100) / 100;

  // Log özeti
  const methodCounts = results.reduce((acc, r) => {
    const key = `${r.model_type ?? "?"}:${r.calc_method}`;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log("[computeLineHiddenCosts] Hesap yöntemi dağılımı:", methodCounts);

  return { results, totalHiddenCanonical };
}

// ─────────────────────────────────────────────
// DB fetch: fetchProductionCostWeights
// ─────────────────────────────────────────────

export async function fetchProductionCostWeights(
  country: string
): Promise<Record<string, ProductionCostWeightsRow>> {
  const { getSql } = await import("@/lib/db/client");
  const sql = getSql();
  if (!sql) return {};

  try {
    const rows = await sql`
      SELECT category, raw_material_pct, labor_pct, rent_pct, energy_pct, other_pct,
             profit_margin_factor, model_type, benchmark_series
      FROM production_cost_weights
      WHERE country = ${country}
    `;
    const map: Record<string, ProductionCostWeightsRow> = {};
    for (const r of rows as Array<{
      category: string;
      raw_material_pct: number;
      labor_pct: number;
      rent_pct: number;
      energy_pct: number;
      other_pct: number;
      profit_margin_factor: number;
      model_type: string | null;
      benchmark_series: string | null;
    }>) {
      const rawModelType = r.model_type ?? "producer_gap";
      const modelType: HiddenCostModelType =
        rawModelType === "market_benchmark" ? "market_benchmark"
        : rawModelType === "fallback"       ? "fallback"
        : "producer_gap";

      map[r.category] = {
        raw_material_pct:    Number(r.raw_material_pct),
        labor_pct:           Number(r.labor_pct),
        rent_pct:            Number(r.rent_pct),
        energy_pct:          Number(r.energy_pct),
        other_pct:           Number(r.other_pct),
        profit_margin_factor: Number(r.profit_margin_factor),
        model_type:          modelType,
        benchmark_series:    r.benchmark_series ?? null,
      };
    }
    return map;
  } catch (e) {
    console.warn(
      "[line-hidden-cost] fetchProductionCostWeights failed:",
      (e as Error)?.message
    );
    return {};
  }
}

// ─────────────────────────────────────────────
// DB fetch: fetchEconomicIndexMultipliers
// ─────────────────────────────────────────────

/**
 * economic_indices tablosundan belirtilen ülke + ay için tüm bileşen çarpanlarını çeker.
 * Çarpan = 1 + (value / 100)
 *
 * Eşleme:
 *   raw_material → PPI/TARIM veya PPI/IMALAT_TREND
 *   labor        → LABOR/TARIM_DISI_NOMINAL veya LABOR/ASGARI_UCRET
 *   rent         → RENT/TUIK_GERCEK veya RENT/YKKE
 *   energy       → FUEL/ENERJI_TRENDYIL veya FUEL/ELEKTRIK_PROXY
 *   other        → CPI/GENEL  (market_benchmark fallback + service labor proxy)
 *   cpi_11       → CPI/11    (lokanta/hazır yemek — food_delivery, hospitality)
 *   cpi_07       → CPI/07    (ulaştırma — travel_ticket)
 *   cpi_08       → CPI/08    (haberleşme — services_digital)
 *   ppi_c        → PPI/C     (imalat ÜFE — fallback avg için)
 */
export async function fetchEconomicIndexMultipliers(
  country: string,
  yearMonth: string
): Promise<EconomicIndexMultipliers | null> {
  const { getSql } = await import("@/lib/db/client");
  const sql = getSql();
  if (!sql) return null;

  try {
    const rows = await sql`
      SELECT index_type, series, year_month, value
      FROM economic_indices
      WHERE country = ${country}
        AND is_verified = TRUE
        AND (
          year_month = ${yearMonth}
          OR year_month = (
            SELECT MAX(e2.year_month)
            FROM economic_indices e2
            WHERE e2.country    = economic_indices.country
              AND e2.index_type = economic_indices.index_type
              AND e2.series     = economic_indices.series
              AND e2.is_verified = TRUE
          )
        )
      ORDER BY year_month DESC
    ` as Array<{ index_type: string; series: string; year_month: string; value: number }>;

    if (!rows.length) return null;

    function pick(indexType: string, ...seriesList: string[]): number {
      for (const series of seriesList) {
        const exact = rows.find(
          (r) =>
            r.index_type === indexType &&
            r.series === series &&
            r.year_month === yearMonth
        );
        if (exact) return 1 + Number(exact.value) / 100;

        const latest = rows.find(
          (r) => r.index_type === indexType && r.series === series
        );
        if (latest) return 1 + Number(latest.value) / 100;
      }
      return 1.0;
    }

    const multipliers: EconomicIndexMultipliers = {
      // producer_gap bileşenleri
      raw_material: pick("PPI",   "TARIM", "IMALAT_TREND"),
      labor:        pick("LABOR", "TARIM_DISI_NOMINAL", "ASGARI_UCRET"),
      rent:         pick("RENT",  "TUIK_GERCEK", "YKKE"),
      energy:       pick("FUEL",  "ENERJI_TRENDYIL", "ELEKTRIK_PROXY"),
      // genel + fallback
      other:        pick("CPI",   "GENEL"),
      ppi_c:        pick("PPI",   "C"),
      // market_benchmark alt seriler
      cpi_11:       pick("CPI",   "11"),
      cpi_07:       pick("CPI",   "07"),
      cpi_08:       pick("CPI",   "08"),
    };

    return multipliers;
  } catch (e) {
    console.warn(
      "[line-hidden-cost] fetchEconomicIndexMultipliers failed:",
      (e as Error)?.message
    );
    return null;
  }
}

// ─────────────────────────────────────────────
// DB fetch: fetchTaxonomyBulk
// ─────────────────────────────────────────────

/**
 * canonical_product_taxonomy tablosundan verilen ürün adları için toplu lookup.
 * canonical_name → TaxonomyRow map döner.
 *
 * Sadece producer_gap kategorilerinde kullanılır (taxonomy'deki ürünler fiziksel ürünler).
 */
export async function fetchTaxonomyBulk(
  canonicalNames: (string | null | undefined)[]
): Promise<Map<string, TaxonomyRow>> {
  const map = new Map<string, TaxonomyRow>();
  const keys = canonicalNames
    .map((n) => (n ?? "").toLowerCase().trim())
    .filter(Boolean);
  if (!keys.length) return map;

  const { getSql } = await import("@/lib/db/client");
  const sql = getSql();
  if (!sql) return map;

  try {
    const rows = await sql`
      SELECT canonical_name, category_lvl1, category_lvl2,
             raw_material_pct, labor_pct, rent_pct, energy_pct, other_pct,
             labor_type, profit_margin
      FROM canonical_product_taxonomy
      WHERE canonical_name = ANY(${keys})
    `;
    for (const r of rows as TaxonomyRow[]) {
      map.set(r.canonical_name.toLowerCase().trim(), {
        canonical_name:   r.canonical_name,
        category_lvl1:    r.category_lvl1,
        category_lvl2:    r.category_lvl2,
        raw_material_pct: Number(r.raw_material_pct),
        labor_pct:        Number(r.labor_pct),
        rent_pct:         Number(r.rent_pct),
        energy_pct:       Number(r.energy_pct),
        other_pct:        Number(r.other_pct),
        labor_type:       r.labor_type,
        profit_margin:    Number(r.profit_margin),
      });
    }
    if (map.size > 0) {
      console.log(`[fetchTaxonomyBulk] ${map.size}/${keys.length} ürün eşleşti`);
    }
  } catch (e) {
    console.warn(
      "[line-hidden-cost] fetchTaxonomyBulk failed:",
      (e as Error)?.message
    );
  }
  return map;
}
