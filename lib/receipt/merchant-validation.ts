import { looksLikeAddress } from "./address-whitelist";

/** Fiş etiketleri — işletme adı DEĞİL, asla merchant olarak kabul edilmez */
export const FORBIDDEN_MERCHANT_NAMES = new Set([
  "topkdv", "toplam", "nakit", "ykb", "satış", "satis",
  "ödeme", "odeme", "iade", "iptal", "tutar", "sale", "sales",
  "eku", "fis", "fiş", "pos", "terminal", "değeri", "degeri",
  // Poşet / alışveriş poşeti — market adı değil, fişte çıkan etiket (normalize: ş→s, ı→i)
  "poset", "alisveris poseti", "alisveris poset",
  // Fiş disclaimer ibareleri — "MALI DEĞERİ YOKTUR" vb. (OCR: LI DEĞERİ YOKTUR, MALİ DEĞERİ YOKTUR)
  "yoktur", "mali değeri yoktur", "mali degeri yoktur", "li değeri yoktur", "li degeri yoktur",
  "malideğeriyoktur", "lideğeriyoktur", "malidegeriyoktur", "lidegeriyoktur",
  // E-Fatura / E-Arşiv belge türü etiketleri — işletme adı değil, fatura başlığı (typo: E Arşiv, E fatura vb.)
  "e-fatura", "e-arsiv", "e fatura", "e arsiv", "earsiv", "efatura",
  // "Hoş Geldiniz" — karşılama ibaresi, işletme adı olamaz (typo: HOS DELDINTZ, HOS GELDINTZ vb.)
  "hos geldiniz", "hosh geldiniz", "hos geldi.niz", "hosgeldiniz", "hoshgeldiniz",
  "hos geldi niz", "hosh geldi niz",
  "hos deldintz", "hos geldintz", "hos deldiniz", "hosh deldintz", "hosh geldintz",
  "deldintz", "geldintz", "hos deldintz ozdilek", "hoş geldiniz",
  // ETTN / ETN No — fatura etiketi, işletme adı değil (e-Fatura UUID etiketi)
  "ettn no", "ettn no:", "etn no", "etn no:", "ettn", "etn no",
]);

/** Ürün satırı mı? (PARM BON HAST KG, AHİR 600 G — ağırlık birimi ile biten, işletme adı değil) */
export function isProductLineMerchant(name: string): boolean {
  if (!name?.trim()) return false;
  const t = name.trim();
  if (t.length < 6 || t.length > 50) return false;
  // A.Ş, LTD vb. şirket ibaresi varsa işletme adıdır
  if (/\b(a\.ş\.?|ltd\.?|şti\.?|sti\.?|san\.?|tic\.?|inc\.?|corp\.?)\b/i.test(t)) return false;
  // KG, G, GR, ML ile bitiyorsa ürün satırı (ağırlık/hacim birimi)
  if (/\s+(kg|g|gr|ml)\s*$/i.test(t)) return true;
  return false;
}

/** İsim fiş etiketi mi? (BIM, A101, Migros gibi tek kelime işletmeler hariç) */
export function isForbiddenMerchant(name: string): boolean {
    if (!name?.trim()) return false;
    if (isProductLineMerchant(name)) return true;
    const norm = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c");
    if (FORBIDDEN_MERCHANT_NAMES.has(norm)) return true;
    // "Hoş Geldiniz" typo: merchant adı "HOS DELDINTZ OZDILEK..." gibi içeriyorsa asla kabul etme
    if (/\b(deldintz|geldintz)\b/.test(norm)) return true;
    // "Hoş Geldiniz" vb. — nokta/boşluk varyasyonları (örn. "hosh geldi.niz" → nokta kaldırıldığında eşleşir)
    const normNoPunct = norm.replace(/[.\-_,]/g, " ").replace(/\s+/g, " ").trim();
    if (FORBIDDEN_MERCHANT_NAMES.has(normNoPunct)) return true;
    // "Alışveriş Poşeti" vb. tam ifade veya içeren (ör. "XYZ Alışveriş Poşeti") — TR blacklist
    const bagKeywords = ["alisveris poseti", "alisveris poset", "poset"];
    if (bagKeywords.some((kw) => norm === kw || norm.includes(kw))) return true;
    // E-Fatura / E-Arşiv belge türü: isim "E-ARŞİV ALTERNATİF..." gibi başlıyorsa merchant değildir (typo: E Arşiv, E fatura vb.)
    const invoiceDocPrefixes = ["e-arsiv", "e arsiv", "e-fatura", "e fatura", "earsiv", "efatura"];
    if (invoiceDocPrefixes.some((p) => norm === p || norm.startsWith(p + " ") || norm.startsWith(p))) return true;
    // ETTN NO / ETN NO — fatura etiketi (e-Fatura UUID etiketi), işletme adı değil
    // ASCII : = veya fullwidth ： (U+FF1A) ile; OCR bazen n0, nο (Greek) döner — tüm varyasyonlar
    if (/\b(ettn|etn)\s*n[o0ο]\s*[:=：]?/i.test(norm)) return true;
    if (/^(ettn|etn)\s*n[o0ο]\s*[:=：]?\s*$/i.test(norm)) return true;
    // "MALI DEĞERİ YOKTUR", "LI DEĞERİ YOKTUR" vb. fiş disclaimer ibareleri (boşluklu/boşluksuz)
    const disclaimerKeywords = ["mali degeri yoktur", "mali değeri yoktur", "li degeri yoktur", "li değeri yoktur", "malidegeriyoktur", "lidegeriyoktur"];
    if (disclaimerKeywords.some((kw) => norm.includes(kw))) return true;
  
    // Yeni eklenecek mantık: "kredi" kelimesi ve belirli kalıplar
    if (norm === "kredi") return true; // Sadece "kredi" kelimesi ise yasakla
    if (norm.includes("yapı kredi")) return true;
    if (norm.includes("kredi kayıt bürosu")) return true;
    if (norm.includes("kredi karti")) return true; // Slip'lerde çıkabilecek bir ifade
  
    return false;
}

/**
 * Maskeli veya placeholder işletme adı mı? (K. N. : ****, **** vb.)
 * Bu tür satırlar kart sahibi / referans maskelemesi; asla işletme adı olarak kullanılmamalı.
 */
export function isMaskedOrPlaceholderMerchant(name: string): boolean {
  if (!name?.trim()) return false;
  const t = name.trim();
  // İki veya daha fazla ardışık yıldız → maske
  if (/\*{2,}/.test(t)) return true;
  // "K. N. : ****" / "X. X. :" gibi baş harf + iki nokta üst üste + yıldız (kart sahibi maskelemesi)
  if (/^[A-Za-z]\.\s*[A-Za-z]\.\s*:\s*[\s*]*$/i.test(t)) return true;
  // Sadece yıldız ve noktalama/boşluk (çok kısa anlamlı metin kalmıyorsa)
  const withoutAsterisks = t.replace(/\*/g, "").replace(/\s+/g, " ").trim();
  const lettersOnly = withoutAsterisks.replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]/g, "");
  if (t.includes("*") && lettersOnly.length <= 3) return true;
  return false;
}

/** İşletme adı whitelist - geçerli işletme göstergeleri (şirket unvanları vb.) */
const MERCHANT_WHITELIST_PATTERNS = [
  /\b(a\.ş\.?|a\.s\.?|ltd\.?|ltd\s*şti\.?|şti\.?|sti\.?|san\.?|tic\.?|ticaret|inc\.?|corp\.?|co\.?)\b/i,
  /\b(cafe|kafe|restoran|restaurant|market|mağaza|magaza|shop|store|avm|plaza)\b/i,
  /\b(holding|grup|group|gıda|gida|ürünler|urunler|pazarlama)\b/i,
];

/** Aday whitelist pattern'e uyuyor mu (geçerli işletme göstergesi) */
export function hasMerchantWhitelistPattern(name: string): boolean {
  if (!name?.trim()) return false;
  return MERCHANT_WHITELIST_PATTERNS.some((p) => p.test(name));
}

/** Karşılaştırma için normalize (küçük harf, özel karakterler kaldırılmış) */
function normalizeForComparison(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü]/g, "")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c");
}

/**
 * LLM ve OCR merchant arasında pozitif benzerlik var mı?
 * (Aynı işletmeyi işaret ediyorlar mı?)
 */
export function hasPositiveSimilarity(llm: string, ocr: string): boolean {
  if (!llm?.trim() || !ocr?.trim()) return false;
  const a = normalizeForComparison(llm);
  const b = normalizeForComparison(ocr);
  if (a.length < 3 || b.length < 3) return false;

  // İlk 5-7 karakter örtüşmesi veya uzunluk oranı >= 0.5
  const minLen = Math.min(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);
  const prefixA = a.substring(0, Math.min(7, a.length));
  const prefixB = b.substring(0, Math.min(7, b.length));

  const prefixOverlap =
    (minLen >= 5 && (a.includes(prefixB) || b.includes(prefixA))) || false;
  const lengthRatio = maxLen > 0 ? minLen / maxLen : 0;

  return prefixOverlap || lengthRatio >= 0.5;
}

/**
 * Metin adres gibi görünüyorsa, ilk adres teriminden önceki kısmı al (max 4 kelime).
 * Aksi halde metni olduğu gibi döndür.
 */
export function trimAddressPartIfNeeded(text: string, maxWordsBeforeAddress = 4): string {
  if (!text?.trim()) return text;
  if (!looksLikeAddress(text)) return text.trim();

  const words = text.trim().split(/\s+/);
  let taken = 0;
  const result: string[] = [];
  for (const w of words) {
    if (taken >= maxWordsBeforeAddress) break;
    result.push(w);
    taken++;
  }
  return result.join(" ").trim() || text.trim();
}

/**
 * OCR metninden çıkarılan işletme adı adayını doğrular.
 * Bu fonksiyon daha katıdır ve adres, fiş etiketi vb. metinleri filtreler.
 */
export function validateOcrMerchant(name: string): boolean {
  if (!name || typeof name !== "string") return false;
  const t = name.trim();
  if (t.length < 2 || t.length > 80) return false;
  if (looksLikeAddress(t)) return false;
  if (isForbiddenMerchant(t)) return false;
  return true;
}

/**
 * LLM'den çıkarılan işletme adı adayını doğrular.
 * Bu fonksiyon daha esnektir, çünkü LLM görsel bağlamı anlar ve adres-işletme ayrımını yapabilir.
 * Sadece bariz geçersiz durumları (çok kısa/uzun, boş, anlamsız) kontrol eder.
 */
export function validateLlmMerchant(name: string, context: { merchantTaxId?: string | null }): boolean {
  if (!name || typeof name !== "string") return false;
  const t = name.trim();
  if (t.length < 2 || t.length > 80) return false;
  
  // Eğer VKN varsa, LLM'in adresi doğru tahmin etme olasılığı yüksektir, bu yüzden adres filtresini esnet.
  if (context.merchantTaxId && t.length > 3 && !isForbiddenMerchant(t)) {
    return true;
  }

  // LLM'in kendisi adres gibi bir şey döndürüyorsa, bu genellikle bir hatadır.
  if (looksLikeAddress(t)) return false;

  // LLM'in yasaklı kelimeler döndürmesi de bir hatadır.
  if (isForbiddenMerchant(t)) return false;
  
  return true;
}

/**
 * Backward-compatible alias. Genel işletme adı doğrulaması (OCR seviyesinde katı).
 * Yeni kod: OCR için validateOcrMerchant, LLM için validateLlmMerchant kullanın.
 */
export function isValidMerchantCandidate(name: string): boolean {
  return validateOcrMerchant(name);
}

/**
 * DB'den gelen merchant adı (merchant_tiers veya merchant_places_cache)
 * Benzerlik varsa kullanılabilir.
 */
export function normalizeMerchantForDbLookup(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\wçğıöşü\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}