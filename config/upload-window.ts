/**
 * Upload window: 2-day rule and penalty categories (Oracle plan).
 * Receipts uploaded after 2 days get a multiplier < 1 unless category is in NO_WINDOW_PENALTY_CATEGORIES.
 */

export const NO_WINDOW_PENALTY_CATEGORIES = [
  "utility",
  "telecom",
  "insurance",
  "rent",
  "healthcare",
] as const;

/** Multipliers by days late (0 = on time, 1 = 1 day late, 2+ = 2+ days late). */
export const UPLOAD_WINDOW_MULTIPLIERS: Record<number, number> = {
  0: 1.0,
  1: 0.8,
  2: 0.5,
};

/** Default multiplier when days late >= 3. */
export const UPLOAD_WINDOW_MULTIPLIER_DEFAULT = 0.2;

export function getUploadWindowMultiplier(daysLate: number): number {
  if (daysLate <= 0) return 1.0;
  return UPLOAD_WINDOW_MULTIPLIERS[daysLate] ?? UPLOAD_WINDOW_MULTIPLIER_DEFAULT;
}
