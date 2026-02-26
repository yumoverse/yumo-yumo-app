/**
 * Reward formula config: USD rate (local currency per 1 USD) and category CPI catalyzer.
 * aYUMO = HiddenCost / USD_rate
 * rYUMO = aYUMO × CPI × Level_Catalyzer × Category_Level_Catalyzer_by_CPI
 *
 * Sources: TÜİK, TCMB (exchange). profit_margin_factor 1.20 from TÜİK-based methodology.
 */

/** Sync fallback: local currency units per 1 USD. Env override: USD_RATE_TR, USD_RATE_TH, etc. */
export function getUsdRate(currency: string | null | undefined, country?: string): number {
  const c = (currency ?? "").toUpperCase();
  const co = (country ?? "").toUpperCase();
  if (c === "USD") return 1;
  if (co === "TR" || c === "TRY" || c === "TL") {
    const env = typeof process !== "undefined" ? process.env.USD_RATE_TR : undefined;
    return env ? Number(env) : 43.73;
  }
  if (co === "TH" || c === "THB") {
    const env = typeof process !== "undefined" ? process.env.USD_RATE_TH : undefined;
    return env ? Number(env) : 36;
  }
  if (co === "MY" || c === "MYR" || c === "RM") {
    const env = typeof process !== "undefined" ? process.env.USD_RATE_MY : undefined;
    return env ? Number(env) : 3.85;
  }
  return 1;
}

/**
 * Async: TR için TCMB EVDS'den USD/TRY kuru çeker (yearMonth veya güncel).
 * API key: TCMB_EVDS_API_KEY veya EVDS_API_KEY. Yoksa veya hata olursa getUsdRate() fallback.
 */
export async function getUsdRateAsync(
  currency: string | null | undefined,
  country?: string,
  yearMonth?: string
): Promise<number> {
  const c = (currency ?? "").toUpperCase();
  const co = (country ?? "").toUpperCase();
  if (c === "USD") return 1;
  if (co === "TR" || c === "TRY" || c === "TL") {
    try {
      const { fetchUsdTryRateForMonth, fetchUsdTryRateLatest } = await import("@/lib/etl/tcmb-evds");
      const rate = yearMonth
        ? await fetchUsdTryRateForMonth(yearMonth)
        : await fetchUsdTryRateLatest();
      if (rate != null && rate > 0) return rate;
    } catch {
      // fallback to env/constant
    }
    return getUsdRate(currency, country);
  }
  return getUsdRate(currency, country);
}

/**
 * Internal category → CPI series (economic_indices). TÜİK/TCMB: GENEL, GIDA, HIZMET, TEMEL_MAL, ENERJI.
 * Kategori bazlı enflasyon çarpanı için kullanılır (data/tufe-ufe Tüm Tüfe ile uyumlu).
 */
export function getCpiSeriesForCategory(internalCategory: string): string {
  const map: Record<string, string> = {
    groceries_fmcg: "GIDA",
    food_delivery: "GIDA",
    apparel_fashion: "TEMEL_MAL",
    electronics: "GENEL",
    beauty_personal_care: "TEMEL_MAL",
    home_living: "TEMEL_MAL",
    travel_ticket: "HIZMET",
    services_digital: "HIZMET",
    hospitality_lodging: "HIZMET",
    other: "GENEL",
  };
  return map[internalCategory] ?? "GENEL";
}

/**
 * Kategori bazlı CPI çarpanı run-post-process içinde hesaplanır:
 * getCpiSeriesForCategory(internalCategory) → economic_indices CPI seri değeri → 1 + value/100.
 * Veri: economic_indices (026 TCMB: GENEL, GIDA, HIZMET, TEMEL_MAL, ENERJI). data/tufe-ufe/Tüm Tüfe.csv
 * ile daha detaylı kategori enflasyonu import edilirse seri seti genişletilebilir.
 */
