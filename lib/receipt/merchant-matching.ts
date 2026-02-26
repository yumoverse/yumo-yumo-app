/**
 * Canonical merchant matching: 4 layers (VKN -> pattern -> location -> fuzzy).
 * No-match can auto-create merchant + pattern. SERVER-ONLY.
 */

import { db } from "@/lib/db/client";
import { isDatabaseAvailable } from "@/lib/receipt/db/connection";
import {
  isValidMerchantCandidate,
  normalizeMerchantForDbLookup,
} from "@/lib/receipt/merchant-validation";
import { loadVknMerchantMap, getMerchantIdByVkn } from "@/lib/receipt/vkn-map";
import { distance } from "fastest-levenshtein";

const CONFIDENCE_THRESHOLD = 0.75;
const LAYER1_CONFIDENCE = 0.98;
const MAX_FUZZY_CANDIDATES = 300;
const FUZZY_SIMILARITY_MIN = 0.6;

export type MerchantTier = "verified" | "candidate" | "unverified";

export interface MatchInput {
  merchantName: string;
  taxId?: string | null;
  category?: string | null;
  city?: string | null;
  district?: string | null;
  country?: string | null;
  /** Username who uploaded the receipt that triggered this merchant creation (for one-time 1.2x bonus when admin verifies). */
  firstReceiptUsername?: string | null;
}

export interface MatchResult {
  merchantId: string;
  displayName: string;
  canonicalName: string;
  category: string;
  tier: MerchantTier;
  confidence: number;
  layerUsed: "vkn" | "pattern" | "location" | "fuzzy" | "auto_create";
}

interface MerchantRow {
  id: string;
  canonical_name: string;
  display_name: string;
  category: string;
  tier: string;
  country_code: string | null;
}

interface PatternRow {
  merchant_id: string;
  confidence_score: number;
}

function normalizeForPattern(name: string): string {
  return normalizeMerchantForDbLookup(name)
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const d = distance(a.toLowerCase(), b.toLowerCase());
  return 1 - d / maxLen;
}

/**
 * Layer 1: VKN → merchant.
 * First checks the DB (merchants.vkn column), then falls back to the in-memory
 * env map (VKN_MERCHANT_MAP_JSON / VKN_MERCHANT_MAP_PATH) for backward compat.
 */
async function layer1Vkn(
  taxId: string | null | undefined
): Promise<MatchResult | null> {
  if (!taxId?.trim()) return null;
  const normalized = taxId.trim().replace(/\D/g, "");
  if (!normalized) return null;

  // 1a. DB lookup (primary – merchants.vkn column added in migration 034)
  if (isDatabaseAvailable()) {
    try {
      const rows = await db.query<MerchantRow>(
        "SELECT id, canonical_name, display_name, category, tier, country_code FROM merchants WHERE vkn = $1 LIMIT 1",
        [normalized]
      );
      if (rows.rows.length > 0) {
        const m = rows.rows[0];
        console.log(`[layer1Vkn] ✅ DB VKN match: ${normalized} → ${m.display_name}`);
        return {
          merchantId: m.id,
          displayName: m.display_name,
          canonicalName: m.canonical_name,
          category: m.category || "other",
          tier: m.tier as MerchantTier,
          confidence: LAYER1_CONFIDENCE,
          layerUsed: "vkn",
        };
      }
    } catch (err) {
      // vkn column may not exist yet (migration not run); fall through silently
      console.warn("[layer1Vkn] DB VKN query failed (migration 034 pending?):", (err as Error).message?.slice(0, 80));
    }
  }

  // 1b. In-memory env map (fallback / legacy)
  await loadVknMerchantMap();
  const merchantId = getMerchantIdByVkn(normalized);
  if (!merchantId) return null;
  const rows = await db.query<MerchantRow>(
    "SELECT id, canonical_name, display_name, category, tier, country_code FROM merchants WHERE id = $1",
    [merchantId]
  );
  if (rows.rows.length === 0) return null;
  const m = rows.rows[0];
  console.log(`[layer1Vkn] ✅ Env-map VKN match: ${normalized} → ${m.display_name}`);
  return {
    merchantId: m.id,
    displayName: m.display_name,
    canonicalName: m.canonical_name,
    category: m.category || "other",
    tier: m.tier as MerchantTier,
    confidence: LAYER1_CONFIDENCE,
    layerUsed: "vkn",
  };
}

/** Layer 2: Exact match or receipt contains pattern (e.g. "ZUS COFFEE KASTURI WAON BHD." contains "zus coffee") */
async function layer2Pattern(
  merchantName: string,
  country: string | null | undefined
): Promise<MatchResult[]> {
  if (!isDatabaseAvailable()) return [];
  const normalized = normalizeForPattern(merchantName);
  if (normalized.length < 2) return [];
  const countryParam = country || null;
  // Exact match OR pattern is substring of receipt (longer pattern = more specific, prefer it)
  const patternQuery = `
    SELECT mp.merchant_id, mp.confidence_score,
           LENGTH(LOWER(TRIM(COALESCE(mp.normalized_pattern, mp.pattern)))) AS pattern_len
    FROM merchant_patterns mp
    JOIN merchants m ON m.id = mp.merchant_id
    WHERE (LOWER(TRIM(COALESCE(mp.normalized_pattern, mp.pattern))) = $1
           OR ($1 <> '' AND POSITION(LOWER(TRIM(COALESCE(mp.normalized_pattern, mp.pattern))) IN $1) > 0
               AND LENGTH(LOWER(TRIM(COALESCE(mp.normalized_pattern, mp.pattern)))) >= 3))
      AND (m.country_code = $2 OR m.country_code IS NULL OR $2 IS NULL)
    ORDER BY pattern_len DESC
    LIMIT 10
  `;
  interface PatternRowWithLen extends PatternRow {
    pattern_len: string;
  }
  const patternRows = await db.query<PatternRowWithLen>(patternQuery, [
    normalized,
    countryParam,
  ]);
  if (patternRows.rows.length === 0) return [];
  // One result per merchant: keep highest pattern_len per merchant_id
  const byMerchant = new Map<string, { confidence: number; patternLen: number }>();
  for (const r of patternRows.rows) {
    const id = r.merchant_id;
    const len = parseInt(r.pattern_len, 10) || 0;
    const conf = Number(r.confidence_score) ?? 0.85;
    const existing = byMerchant.get(id);
    if (!existing || len > existing.patternLen) {
      byMerchant.set(id, { confidence: conf, patternLen: len });
    }
  }
  const ids = [...byMerchant.keys()];
  const merchants = await db.query<MerchantRow>(
    "SELECT id, canonical_name, display_name, category, tier, country_code FROM merchants WHERE id = ANY($1)",
    [ids]
  );
  const scoreBy = Object.fromEntries(
    [...byMerchant.entries()].map(([id, v]) => [id, v.confidence])
  );
  const lenBy = Object.fromEntries(
    [...byMerchant.entries()].map(([id, v]) => [id, v.patternLen])
  );
  // Prefer longest pattern (most specific match, e.g. "zus coffee" over "zus")
  const sorted = [...merchants.rows].sort(
    (a, b) => (lenBy[b.id] ?? 0) - (lenBy[a.id] ?? 0)
  );
  return sorted.map((m) => ({
    merchantId: m.id,
    displayName: m.display_name,
    canonicalName: m.canonical_name,
    category: m.category || "other",
    tier: m.tier as MerchantTier,
    confidence: scoreBy[m.id] ?? 0.85,
    layerUsed: "pattern" as const,
  }));
}

/** Layer 3: Category + city/district */
async function layer3Location(
  category: string | null | undefined,
  city: string | null | undefined,
  country: string | null | undefined
): Promise<MerchantRow[]> {
  if (!isDatabaseAvailable() || !category?.trim()) return [];
  const cityNorm = city?.trim().toLowerCase() || "";
  const countryCode = country?.trim().toUpperCase().slice(0, 2) || null;
  const locationQuery = `
    SELECT DISTINCT m.id, m.canonical_name, m.display_name, m.category, m.tier, m.country_code
    FROM merchants m
    JOIN merchant_locations ml ON ml.merchant_id = m.id
    WHERE LOWER(TRIM(m.category)) = $1
      AND (m.country_code = $2 OR m.country_code IS NULL OR $2 IS NULL)
      AND ($3 = '' OR LOWER(TRIM(ml.city)) = $3 OR $3 = ANY(
        SELECT LOWER(TRIM(unnest(ml.address_keywords))) FROM merchant_locations ml2 WHERE ml2.merchant_id = m.id
      ))
    LIMIT 50
  `;
  const rows = await db.query<MerchantRow>(locationQuery, [
    category.trim().toLowerCase(),
    countryCode,
    cityNorm,
  ]);
  return rows.rows;
}

/** Layer 4: Fuzzy only on candidates (from Layer 2 or 3), max MAX_FUZZY_CANDIDATES */
function layer4Fuzzy(
  merchantName: string,
  candidates: MerchantRow[],
  category: string | null | undefined
): MatchResult | null {
  if (candidates.length === 0) return null;
  const normInput = normalizeForPattern(merchantName);
  const categoryNorm = category?.trim().toLowerCase() || "";
  const limited = candidates.slice(0, MAX_FUZZY_CANDIDATES);
  let best: { row: MerchantRow; score: number } | null = null;
  for (const m of limited) {
    const normCanon = normalizeForPattern(m.canonical_name);
    const normDisplay = normalizeForPattern(m.display_name);
    const simCanon = similarity(normInput, normCanon);
    const simDisplay = similarity(normInput, normDisplay);
    const score = Math.max(simCanon, simDisplay);
    if (score < FUZZY_SIMILARITY_MIN) continue;
    const categoryBonus =
      categoryNorm && categoryNorm === m.category?.toLowerCase() ? 0.1 : 0;
    const total = Math.min(1, score * 0.9 + categoryBonus);
    if (!best || total > best.score) best = { row: m, score: total };
  }
  if (!best) return null;
  const m = best.row;
  return {
    merchantId: m.id,
    displayName: m.display_name,
    canonicalName: m.canonical_name,
    category: m.category || "other",
    tier: m.tier as MerchantTier,
    confidence: Math.min(0.85, best.score),
    layerUsed: "fuzzy",
  };
}

/** Auto-create: insert merchant (unverified) + pattern if no duplicate/similar */
async function autoCreateMerchant(
  input: MatchInput
): Promise<MatchResult | null> {
  if (!isDatabaseAvailable()) return null;
  const name = input.merchantName?.trim();
  if (!name || !isValidMerchantCandidate(name)) return null;
  const normalized = normalizeForPattern(name);
  const countryCode = input.country?.trim().toUpperCase().slice(0, 2) || null;
  const category = input.category?.trim() || "other";

    const taxIdStr = input.taxId?.trim().replace(/\D/g, "") || null;

    const existing = await db.query<{ id: string }>(
      "SELECT id FROM merchants WHERE LOWER(TRIM(canonical_name)) = $1 AND (country_code = $2 OR (country_code IS NULL AND $2 IS NULL)) LIMIT 1",
      [normalized, countryCode]
    );
    if (existing.rows.length > 0) {
      await addPatternIfMissing(existing.rows[0].id, name, normalized);
      const row = (await db.query<{ id: string, vkn: string | null }>(
        "SELECT id, vkn FROM merchants WHERE id = $1",
        [existing.rows[0].id]
      )).rows[0];
      
      if (taxIdStr && !row.vkn) {
        await db.query("UPDATE merchants SET vkn = $1 WHERE id = $2", [taxIdStr, existing.rows[0].id]);
        console.log(`[autoCreateMerchant] Updated existing merchant with VKN: ${taxIdStr}`);
      }
      
      const m = await db.query<MerchantRow>(
        "SELECT id, canonical_name, display_name, category, tier, country_code FROM merchants WHERE id = $1",
        [existing.rows[0].id]
      );
      if (m.rows.length > 0) {
        const resultRow = m.rows[0];
        return {
          merchantId: resultRow.id,
          displayName: resultRow.display_name,
          canonicalName: resultRow.canonical_name,
          category: resultRow.category || "other",
          tier: resultRow.tier as MerchantTier,
          confidence: 0.8,
          layerUsed: "auto_create",
        };
      }
    }

    const insertMerchant = await db.query<{ id: string }>(
      `INSERT INTO merchants (canonical_name, display_name, category, tier, country_code, vkn)
       VALUES ($1, $2, $3, 'unverified', $4, $5)
       RETURNING id`,
      [name, name, category, countryCode, taxIdStr]
    );
  if (insertMerchant.rows.length === 0) return null;
  const merchantId = insertMerchant.rows[0].id;
  await db.query(
    `INSERT INTO merchant_patterns (merchant_id, pattern, normalized_pattern, pattern_type, confidence_score)
     VALUES ($1, $2, $3, 'ocr', 0.8)`,
    [merchantId, name, normalized]
  );
  return {
    merchantId,
    displayName: name,
    canonicalName: name,
    category,
    tier: "unverified",
    confidence: 0.8,
    layerUsed: "auto_create",
  };
}

async function addPatternIfMissing(
  merchantId: string,
  pattern: string,
  normalizedPattern: string
): Promise<void> {
  const exists = await db.query<{ id: string }>(
    "SELECT id FROM merchant_patterns WHERE merchant_id = $1 AND LOWER(TRIM(COALESCE(normalized_pattern, pattern))) = $2 LIMIT 1",
    [merchantId, normalizedPattern]
  );
  if (exists.rows.length > 0) return;
  await db.query(
    `INSERT INTO merchant_patterns (merchant_id, pattern, normalized_pattern, pattern_type, confidence_score)
     VALUES ($1, $2, $3, 'ocr', 0.8)`,
    [merchantId, pattern, normalizedPattern]
  );
}

/**
 * Ensure a merchant exists in DB as unverified so it appears in Admin → İşletmeler for approval.
 * Used when receipt passes all stages (saved as verified) but merchant was not in canonical DB (TR/MY/ID/TH).
 * Idempotent: if merchant already exists, adds pattern if missing; does not change tier.
 */
export async function ensureUnverifiedMerchantForApproval(
  input: MatchInput
): Promise<{ created: boolean }> {
  const name = input.merchantName?.trim();
  console.log("[ensureUnverifiedMerchantForApproval] Called for:", name?.substring(0, 50) ?? "(empty)");
  try {
    if (!isDatabaseAvailable()) {
      console.warn("[ensureUnverifiedMerchantForApproval] Skipped: DB not available");
      return { created: false };
    }
    if (!name) {
      console.warn("[ensureUnverifiedMerchantForApproval] Skipped: empty merchant name");
      return { created: false };
    }
    if (!isValidMerchantCandidate(name)) {
      console.warn("[ensureUnverifiedMerchantForApproval] Skipped: invalid candidate:", name?.substring(0, 50));
      return { created: false };
    }
    const normalized = normalizeForPattern(name);
    const taxIdStr = input.taxId?.trim().replace(/\D/g, "") || null;
    const countryCode = input.country?.trim().toUpperCase().slice(0, 2) || null;
    const category = input.category?.trim() || "other";

    const existing = await db.query<{ id: string }>(
      "SELECT id FROM merchants WHERE LOWER(TRIM(canonical_name)) = $1 AND (country_code = $2 OR (country_code IS NULL AND $2 IS NULL)) LIMIT 1",
      [normalized, countryCode]
    );
    if (existing.rows.length > 0) {
      await addPatternIfMissing(existing.rows[0].id, name, normalized);
      if (taxIdStr) {
        const currentVkn = await db.query<{ vkn: string | null }>("SELECT vkn FROM merchants WHERE id = $1", [existing.rows[0].id]);
        if (!currentVkn.rows[0].vkn) {
          await db.query("UPDATE merchants SET vkn = $1 WHERE id = $2", [taxIdStr, existing.rows[0].id]);
          console.log("[ensureUnverifiedMerchantForApproval] Updated existing merchant with VKN:", taxIdStr);
        }
      }
      console.log("[ensureUnverifiedMerchantForApproval] Merchant already in DB, pattern added if missing:", name?.substring(0, 40));
      return { created: false };
    }

    const firstUsername = input.firstReceiptUsername?.trim() || null;
    let merchantId: string;
    try {
      const insertResult = await db.query<{ id: string }>(
        `INSERT INTO merchants (canonical_name, display_name, category, tier, country_code, first_receipt_username, vkn)
         VALUES ($1, $2, $3, 'unverified', $4, $5, $6)
         RETURNING id`,
        [name, name, category, countryCode, firstUsername, taxIdStr]
      );
      if (insertResult.rows.length > 0) {
        merchantId = insertResult.rows[0].id;
        await db.query(
          `INSERT INTO merchant_patterns (merchant_id, pattern, normalized_pattern, pattern_type, confidence_score)
           VALUES ($1, $2, $3, 'ocr', 0.8)`,
          [merchantId, name, normalized]
        );
        console.log("[ensureUnverifiedMerchantForApproval] Inserted unverified merchant:", name?.substring(0, 40));
        return { created: true };
      }
    } catch (insertErr: any) {
      if (insertErr?.code === "23505") {
        const after = await db.query<{ id: string }>(
          "SELECT id FROM merchants WHERE LOWER(TRIM(canonical_name)) = $1 AND (country_code = $2 OR (country_code IS NULL AND $2 IS NULL)) LIMIT 1",
          [normalized, countryCode]
        );
        if (after.rows.length > 0) {
          await addPatternIfMissing(after.rows[0].id, name, normalized);
          console.log("[ensureUnverifiedMerchantForApproval] Merchant already existed (unique), pattern added:", name?.substring(0, 40));
        }
        return { created: false };
      }
      throw insertErr;
    }

    console.warn("[ensureUnverifiedMerchantForApproval] INSERT RETURNING returned no row (name=" + name?.substring(0, 30) + ")");
    return { created: false };
  } catch (err) {
    console.error("[ensureUnverifiedMerchantForApproval] Error:", err);
    throw err;
  }
}

/**
 * Add a pattern for a merchant (e.g. after user confirms "this receipt is from this merchant").
 * Used by Faz 3 learning loop. Idempotent: same normalized pattern is not duplicated.
 */
export async function addMerchantPattern(
  merchantId: string,
  ocrMerchantName: string
): Promise<{ added: boolean }> {
  if (!ocrMerchantName?.trim()) return { added: false };
  const normalized = normalizeForPattern(ocrMerchantName);
  if (normalized.length < 2) return { added: false };
  const exists = await db.query<{ id: string }>(
    "SELECT id FROM merchant_patterns WHERE merchant_id = $1 AND LOWER(TRIM(COALESCE(normalized_pattern, pattern))) = $2 LIMIT 1",
    [merchantId, normalized]
  );
  if (exists.rows.length > 0) return { added: false };
  await db.query(
    `INSERT INTO merchant_patterns (merchant_id, pattern, normalized_pattern, pattern_type, confidence_score)
     VALUES ($1, $2, $3, 'fuzzy', 0.8)`,
    [merchantId, ocrMerchantName.trim(), normalized]
  );
  return { added: true };
}

/**
 * Match receipt to a canonical merchant. Layers 1 -> 2 -> 2+3 candidates -> 4.
 * If best confidence < CONFIDENCE_THRESHOLD, and autoCreate is true, may create new merchant.
 */
export async function matchMerchant(
  input: MatchInput,
  options: { autoCreate?: boolean } = {}
): Promise<MatchResult | null> {
  const { autoCreate = true } = options;

  const layer1 = await layer1Vkn(input.taxId);
  if (layer1) return layer1;

  const layer2Results = await layer2Pattern(
    input.merchantName,
    input.country
  );
  const bestFrom2 =
    layer2Results.length > 0
      ? layer2Results.reduce((a, b) =>
          a.confidence >= b.confidence ? a : b
        )
      : null;
  if (bestFrom2 && bestFrom2.confidence >= CONFIDENCE_THRESHOLD)
    return bestFrom2;

  let locationCandidates: MerchantRow[] = [];
  if (input.category || input.city) {
    locationCandidates = await layer3Location(
      input.category,
      input.city,
      input.country
    );
  }

  const allCandidates = [
    ...layer2Results.map((r) => ({
      id: r.merchantId,
      canonical_name: r.canonicalName,
      display_name: r.displayName,
      category: "",
      tier: r.tier,
      country_code: null as string | null,
    })),
    ...locationCandidates,
  ];
  const uniqueById = Array.from(
    new Map(allCandidates.map((m) => [m.id, m])).values()
  );

  const layer4Result = layer4Fuzzy(
    input.merchantName,
    uniqueById,
    input.category
  );
  if (layer4Result && layer4Result.confidence >= CONFIDENCE_THRESHOLD)
    return layer4Result;

  if (bestFrom2) return bestFrom2;
  if (layer4Result) return layer4Result;

  if (autoCreate) return autoCreateMerchant(input);
  return null;
}

/** Tier multiplier for reward: verified up to 1.2 (only for first uploader, once), candidate 1.0, unverified 0.7 */
export const MERCHANT_TIER_MULTIPLIERS: Record<MerchantTier, number> = {
  verified: 1.2,
  candidate: 1.0,
  unverified: 0.7,
};

export function getTierMultiplier(tier: MerchantTier): number {
  return MERCHANT_TIER_MULTIPLIERS[tier] ?? 1;
}

const VERIFIED_BONUS_MULTIPLIER = 1.2;

/**
 * For verified merchants: 1.2x only for the user who first uploaded (triggered unverified insert), and only once.
 * Other users or same user's 2nd+ upload get 1.0x.
 */
export async function getVerifiedBonusMultiplier(
  merchantId: string,
  username: string
): Promise<{ multiplier: number; isFirstTimeBonus: boolean }> {
  if (!isDatabaseAvailable() || !username?.trim()) {
    return { multiplier: 1, isFirstTimeBonus: false };
  }
  try {
    const merchant = await db.query<{ first_receipt_username: string | null }>(
      "SELECT first_receipt_username FROM merchants WHERE id = $1 LIMIT 1",
      [merchantId]
    );
    if (!merchant.rows.length || merchant.rows[0].first_receipt_username !== username) {
      return { multiplier: 1, isFirstTimeBonus: false };
    }
    const inserted = await db.query<{ username: string }>(
      `INSERT INTO user_verified_merchant_bonus (username, merchant_id)
       VALUES ($1, $2)
       ON CONFLICT (username, merchant_id) DO NOTHING
       RETURNING username`,
      [username.trim(), merchantId]
    );
    if (inserted.rows.length > 0) {
      return { multiplier: VERIFIED_BONUS_MULTIPLIER, isFirstTimeBonus: true };
    }
    return { multiplier: 1, isFirstTimeBonus: false };
  } catch {
    return { multiplier: 1, isFirstTimeBonus: false };
  }
}
