/**
 * Income bands (Cursor enum) for declared_monthly_income_band.
 * TRY thresholds in K (e.g. 30 = 30_000 TRY). Used for gelir aşımı and config.
 */

export const INCOME_BAND_KEYS = [
  "under_30",
  "30_35",
  "35_45",
  "45_60",
  "60_70",
  "70_85",
  "85_100",
  "100_120",
  "120_150",
  "150_plus",
] as const;

export type IncomeBandKey = (typeof INCOME_BAND_KEYS)[number];

/** TRY monthly gross in thousands (e.g. 30 = 30_000 TRY). */
export const INCOME_BAND_TRY_THRESHOLDS_K: Record<IncomeBandKey, { min: number; max: number | null }> = {
  under_30: { min: 0, max: 30 },
  "30_35": { min: 30, max: 35 },
  "35_45": { min: 35, max: 45 },
  "45_60": { min: 45, max: 60 },
  "60_70": { min: 60, max: 70 },
  "70_85": { min: 70, max: 85 },
  "85_100": { min: 85, max: 100 },
  "100_120": { min: 100, max: 120 },
  "120_150": { min: 120, max: 150 },
  "150_plus": { min: 150, max: null },
};

export function getIncomeBandKeyFromTryMonthly(tryAmountK: number): IncomeBandKey {
  if (tryAmountK < 30) return "under_30";
  if (tryAmountK < 35) return "30_35";
  if (tryAmountK < 45) return "35_45";
  if (tryAmountK < 60) return "45_60";
  if (tryAmountK < 70) return "60_70";
  if (tryAmountK < 85) return "70_85";
  if (tryAmountK < 100) return "85_100";
  if (tryAmountK < 120) return "100_120";
  if (tryAmountK < 150) return "120_150";
  return "150_plus";
}
