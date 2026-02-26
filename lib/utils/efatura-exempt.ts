/**
 * E-Fatura Margin Exemption
 *
 * E-faturalar (e-arşiv fatura vb.) arka plan/margin kuralından muaftır.
 * E-ticaret e-faturası: gönderim tarihi, gönderi taşıyan, kargo vb. + "e-arşiv fatura"
 * ibareleri varsa marjin ve fotoğraf kontrollerinden muaf.
 *
 * Upload aşamasında image için OCR (Vision API) ile metin alınıp e-fatura tespiti yapılır.
 */

export interface EfaturaExemptParams {
  buffer: Buffer;
  filename?: string;
  mimeType?: string;
}

const NO_BACKGROUND_MARGIN_THRESHOLD = 3;

/** E-arşiv fatura metin deseni (varyantlar) */
const E_ARSIV_FATURA = /\b(?:e-arşiv|e-arsiv|e-arxiv)\s*fatura\b/i;

/** İnternet Fatura: bu ibare varsa kesin e-fatura (başka detaya bakılmaz). Türkçe İ için \b kullanılmaz (JS \w sadece ASCII). */
const INTERNET_FATURA_DEFINITIVE =
  /(?:^|[\s\W])(?:internet|Internet|INTERNET|İnternet|İNTERNET)\s*(?:fatura|Fatura|FATURA)(?=[\s\W]|$)/;

/**
 * ETTN UUID: GİB tarafından zorunlu tutulan e-fatura tanımlayıcısı.
 * OCR bazen ETTN ile UUID arasına boşluk/iki nokta koymaz — pattern buna toleranslıdır.
 * UUID'nin ilk iki segmenti (8-4 hex) eşleşirse yeterli.
 * Örnek: "ETTN76ac9d0c-3eb1-...", "ETTN: c9320765-657b-..."
 */
const ETTN_UUID =
  /ettn[:\s]*[0-9a-f]{6,}[-][0-9a-f]{4}/i;

/** E-fatura yapısal sinyalleri: en az 3 tanesi varsa e-fatura sayılır (fatura tipi, mersis no, düzenlenme tarihi, e-arşiv fatura, ticaret sicil no) */
const EFATURA_STRUCTURE_SIGNALS = [
  /\bfatura\s*tipi\b/i,
  /\bmersis\s*(?:numarası|numarasi|no)\b/i,
  /\b(?:düzenlenme|duzenlenme|düzenleme|duzenleme)\s*tarihi\b/i,
  /\b(?:e-arşiv|e-arsiv|e-arxiv)\s*fatura\b/i,
  /\bticaret\s*sicil\s*no\b/i,
];
const MIN_STRUCTURE_SIGNATURES = 3;

/** E-ticaret e-fatura sinyalleri: en az MIN_SIGNATURES tanesi + e-arşiv fatura gerekli */
const ECOMMERCE_SIGNATURES = [
  /\bgönderim\s*tarihi\b/i,
  /\bgönderim\s*zamanı\b/i,
  /\bgönderi\s*taşıyan\b/i,
  /\bgönderi\s*taşiyan\b/i,
  /\btaşıyıcı\s*(?:ünvan|unvan)\b/i,
  /\btaşıyıcı\b/i,
  /\bkargo\b/i,
  /\binternet\s*(?:üzerinden|uzerinden)\s*yapılmıştır\b/i,
  /\binternet\s*(?:üzerinden|uzerinden)\s*yapilmistir\b/i,
  // Fiili sevk tarihi (FİİLİ SEVK TARİHİ, fiili sevk tarihi, FIILI SEVK TARIHI)
  /\b(?:fiili|FİİLİ|FIILI)\s*sevk\s*tarih[iIİı]\b/i,
  // İnternet Fatura (pozitif kelime; Türkçe İ için \b yerine sınır)
  /(?:^|[\s\W])(?:internet|Internet|INTERNET|İnternet|İNTERNET)\s*(?:fatura|Fatura|FATURA)(?=[\s\W]|$)/,
];
const MIN_ECOMMERCE_SIGNATURES = 2;

/** Dosya adında e-fatura sinyali (fallback, OCR yokken) */
const FILENAME_EFATURA_HINT = /\b(?:e-arşiv|e-arsiv|e-arxiv|fatura|kargo)\b/i;

/**
 * Metin yapısal olarak e-fatura mı? (fatura tipi, mersis no, düzenlenme tarihi, e-arşiv fatura, ticaret sicil no - en az 3 tanesi)
 */
function isEfaturaByStructure(text: string): boolean {
  if (!text) return false;
  const count = EFATURA_STRUCTURE_SIGNALS.filter((re) => re.test(text)).length;
  return count >= MIN_STRUCTURE_SIGNATURES;
}

/**
 * Metin e-fatura mı? (marjin muafiyeti, template extraction vb. için)
 * 0. İnternet Fatura / INTERNET FATURA / İnternet Fatura vb. varsa kesin e-fatura.
 * 1. ETTN UUID: GİB e-fatura zorunlu tanımlayıcısı — varsa kesin e-fatura.
 * 2. E-Arşiv Fatura etiketi + FATURA NO: perakende e-fatura (BİM, A101, Migros vb.).
 * 3. Yapısal e-fatura: fatura tipi, mersis no, düzenlenme tarihi, e-arşiv fatura, ticaret sicil no — en az 3 tanesi.
 * 4. E-ticaret e-faturası: "e-arşiv fatura" + gönderim/kargo/fiili sevk tarihi vb. en az 2 tanesi.
 */
export function isEcommerceEfatura(text: string, _filename?: string): boolean {
  if (!text) return false;

  // 0. İnternet Fatura grubu varsa kesin e-fatura
  if (INTERNET_FATURA_DEFINITIVE.test(text)) return true;

  // 1. ETTN UUID — GİB zorunlu tanımlayıcısı, kesin e-fatura
  if (ETTN_UUID.test(text)) return true;

  // 2. "E-Arsiv Fatura" / "E-Arşiv Fatura" etiketi + FATURA NO — perakende e-fatura
  if (E_ARSIV_FATURA.test(text) && /\bfatura\s*no\b/i.test(text)) return true;

  // 3. Yapısal kriter: en az 3 ibare (B2B e-fatura)
  if (isEfaturaByStructure(text)) return true;

  // 4. E-ticaret kriteri: e-arşiv fatura + gönderim/kargo/fiili sevk tarihi vb.
  if (!E_ARSIV_FATURA.test(text)) return false;
  const signatureCount = ECOMMERCE_SIGNATURES.filter((re) => re.test(text)).length;
  return signatureCount >= MIN_ECOMMERCE_SIGNATURES;
}

/**
 * Sadece dosya adına bakarak muhtemel e-fatura mı? (OCR yokken fallback)
 */
export function filenameSuggestsEfatura(filename: string): boolean {
  return FILENAME_EFATURA_HINT.test(filename);
}

/**
 * Upload aşamasında image buffer için tek Vision OCR çağrısı; dönen metni verir.
 * API key yoksa veya hata olursa boş string döner.
 */
export async function runQuickOcrForExempt(imageBuffer: Buffer): Promise<string> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return "";

  const base64 = imageBuffer.toString("base64");
  const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

  try {
    const response = await fetch(visionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [{
          image: { content: base64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION", maxResults: 1 }],
          imageContext: { languageHints: ["tr", "en"] },
        }],
      }),
    });

    if (!response.ok) return "";

    const data = await response.json();
    const textAnnotations = data.responses?.[0]?.textAnnotations || [];
    const fullText = textAnnotations[0]?.description || "";
    return typeof fullText === "string" ? fullText : "";
  } catch {
    return "";
  }
}

/**
 * Margin değerlerinin hepsi bu eşikten küçükse "arka plan yok" sayılır.
 */
export function getNoBackgroundMarginThreshold(): number {
  return NO_BACKGROUND_MARGIN_THRESHOLD;
}

/**
 * Bu dosya e-fatura mı? E-faturalar margin (arka plan) kuralından muaftır.
 * - PDF: her zaman exempt.
 * - Image: Vision OCR ile metin alınır; isEcommerceEfatura(text) ise true. OCR boş/hatalıysa dosya adı fallback.
 */
export async function isEfaturaExemptForMarginCheck(
  params: EfaturaExemptParams
): Promise<boolean> {
  const { buffer, filename, mimeType } = params;

  if (mimeType === "application/pdf") {
    return true;
  }

  const ocrText = await runQuickOcrForExempt(buffer);
  if (ocrText && isEcommerceEfatura(ocrText, filename)) return true;

  // OCR yokken veya metin e-fatura kriterini sağlamıyorsa: dosya adı fallback
  if (filename && filenameSuggestsEfatura(filename)) return true;

  return false;
}
