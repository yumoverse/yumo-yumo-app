/**
 * Address whitelist for Turkey
 * Used to validate address patterns and reject address-like text as merchant names.
 * 81 il ve 973 ilçe: mehmetkiran/turkiye-ilceler.json
 */

import turkeyData from "./data/turkey-il-ilce.json";

// Known brand names that should be prioritized / used for address heuristics (MY).
// Kept as a module export so other utilities can reuse safely.
export const knownBrands = [
  'shell', 'bp', 'petrol ofisi', 'tüpraş', 'opet', 'total', 'migros', 'carrefour',
  'a101', 'bim', 'şok', 'metro', 'real', 'koçtaş', 'ikea', 'media markt',
  'teknosa', 'vatan', 'mcdonalds', 'burger king', 'kfc', 'starbucks', 'gloria jeans',
  'zara', 'mango', 'h&m', 'lc waikiki', 'defacto', 'koton', 'mavi', 'watsons',
  'zus',
  // Common merchant type keywords (boost confidence)
  'cafe', 'restaurant', 'restoran', 'coffee', 'shop', 'store', 'market', 'supermarket',
  'lounge', 'game', 'bar', 'pub'
];

/** Metni küçük harf ve ASCII-benzeri formda normalize et (karşılaştırma için) */
function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, "i")
    .replace(/İ/g, "i")
    .replace(/ğ/g, "g")
    .replace(/Ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/Ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/Ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/Ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/Ç/g, "c");
}

/** Türkçe adres terimleri - sokak, mahalle, cadde vb. */
export const ADDRESS_TERMS = new Set([
  "mah", "mah.", "mahalle", "mahallesi", "mh", "mh.",
  "sok", "sok.", "sokak", "sokağı", "sokagi", "sk", "sk.",
  "cad", "cad.", "cadde", "caddesi", "cd", "cd.",
  "bulvar", "bulvarı", "bulvari", "blv", "blv.", "bulv",
  "yol", "yolu", "yy", "yy.",
  "no", "no.", "numara", "num", "apt", "apartman", "kat", "daire", "d",
  "blok", "bina", "site", "merkez", "avm", "plaza", "konak",
  "iş", "is", "merkezi", "şube", "sube", "şubesi", "subesi",
  "vergi", "vergi dairesi", "vd", "vd.", "mersis", "ticaret", "tic.", "sicil", "sicil no",
  "ilçe", "ilce", "il", "semt", "bölge", "bolge", "belde", "köy", "koy",
]);

/** Malaysia address terms — not valid as merchant name alone (Jalan, No, Lot, etc.) */
export const MY_ADDRESS_TERMS = new Set([
  "jalan", "jl", "jl.", "lorong", "lg", "lot", "taman", "persiaran", "no", "no.",
  "bangunan", "blok", "tingkat", "floor", "kompleks", "pusat", "wisma",
]);

/** Türkiye 81 il + 973 ilçe (normalize edilmiş) */
const _citySet = new Set<string>();
const _districtSet = new Set<string>();
const data = turkeyData as Record<string, string[]>;
for (const city of Object.keys(data)) {
  _citySet.add(normalizeForMatch(city));
  for (const district of data[city] || []) {
    _districtSet.add(normalizeForMatch(district));
  }
}
export const TURKEY_CITIES = _citySet;
export const TURKEY_DISTRICTS = _districtSet;

/** Primary address terms — mah, sok, cad, il/ilçe vb. Bunlardan en az biri OLMADAN sadece no/numara/apt ile adres sayılmaz. */
export const PRIMARY_ADDRESS_TERMS = new Set([
  "mah", "mah.", "mahalle", "mahallesi", "mh", "mh.",
  "sok", "sok.", "sokak", "sokağı", "sokagi", "sk", "sk.",
  "cad", "cad.", "cadde", "caddesi", "cd", "cd.",
  "bulvar", "bulvari", "blv", "blv.", "bulv",
  "yol", "yolu", "ilce", "ilçe", "il", "semt", "bolge", "bölge", "belde", "koy", "köy",
  "street", "st", "avenue", "ave", "road", "rd", "boulevard", "blvd", "drive", "dr", "lane", "ln",
  "jl", "jalan", "kecamatan", "kabupaten", "desa", "kelurahan", "gang", "gg", "perumahan", "komplek",
]);

/** Secondary address terms — sadece bunlarla adres sayılmaz; mah/sok/il/ilçe vb. primary terim de gerekir. */
export const SECONDARY_ADDRESS_TERMS = new Set([
  "no", "no.", "numara", "num", "apt", "apartman", "kat", "daire", "d",
  "blok", "bina", "site", "merkez", "avm", "plaza", "konak",
]);

/**
 * Metnin adres terimi içerip içermediğini kontrol eder.
 * Kelimelere bölerek ADDRESS_TERMS, TURKEY_CITIES, TURKEY_DISTRICTS ile karşılaştırır.
 */
export function containsAddressTerm(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const normalized = normalizeForMatch(text);
  const words = normalized.split(/\s+/).map((w) => w.replace(/[.,;:!?/]+$/, ""));
  for (const word of words) {
    if (word.length < 2) continue;
    if (ADDRESS_TERMS.has(word) || TURKEY_CITIES.has(word) || TURKEY_DISTRICTS.has(word))
      return true;
  }
  return false;
}

/**
 * Metinde primary adres terimi (mah, sok, il, ilçe vb.) var mı?
 * Sadece no/numara/apt ile adres sayılmaması için kullanılır.
 */
export function hasPrimaryAddressTerm(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const normalized = normalizeForMatch(text);
  const words = normalized.split(/\s+/).map((w) => w.replace(/[.,;:!?/]+$/, ""));
  for (const word of words) {
    if (word.length < 2) continue;
    if (PRIMARY_ADDRESS_TERMS.has(word) || TURKEY_CITIES.has(word) || TURKEY_DISTRICTS.has(word))
      return true;
  }
  return false;
}

/**
 * İşletme adı adayının adres gibi görünüp görünmediğini kontrol eder.
 * Adres terimi içeriyorsa true (merchant olarak kullanılmamalı veya kırpılmalı).
 * İstisna: 2 kelimelik "MARKA + İLÇE" (örn. AKRA KEMER) — ilk kelime adres terimi değilse işletme adı olarak kabul et.
 */
export function looksLikeAddress(text: string): boolean {
  if (!text || text.trim().length < 5) return false;

  const normalized = text.toLowerCase().replace(/[^a-z0-9çğıöşü\s]/g, "");
  const hasKnownBrand = knownBrands.some(brand => normalized.includes(brand));
  if (hasKnownBrand) {
    return false; // Bilinen bir marka içeriyorsa adres sayma (ör: Kemer Migros)
  }

  if (!containsAddressTerm(text)) return false;
  // İstisna: tam 2 kelime, ilk kelime adres/il/ilçe değilse → "MARKA + İLÇE" (örn. AKRA KEMER)
  const words = text.trim().split(/\s+/).map((w) => w.replace(/[.,;:!?/]+$/, "").toLowerCase());
  if (words.length === 2) {
    const first = normalizeForMatch(words[0]);
    if (first.length >= 3 && !ADDRESS_TERMS.has(first) && !TURKEY_CITIES.has(first) && !TURKEY_DISTRICTS.has(first))
      return false;
  }
  return true;
}

/**
 * Malaysia: merchant name candidate looks like address (Jalan, No, Lot, etc.).
 * Use when detectedCountry === "MY" to avoid accepting address-only text as merchant.
 */
export function looksLikeAddressMY(text: string): boolean {
  if (!text || text.trim().length < 5) return false;
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, "");

  // Check if the text contains a known brand first
  const hasKnownBrand = knownBrands.some(brand => normalized.includes(brand));
  if (hasKnownBrand) {
    return false; // If it's a known brand, it's not an address
  }

  const words = normalized.split(/\s+/).map((w) => w.replace(/[.,;:!?/]+$/, ""));
  for (const word of words) {
    if (word.length < 2) continue;
    if (MY_ADDRESS_TERMS.has(word)) return true;
  }
  return false;
}
