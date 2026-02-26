/**
 * Receipt Gate - Stage 1: OCR Text/Layout Analysis
 * Requires POSITIVE EVIDENCE that document is a receipt/invoice
 */

import { OCRLine } from "@/lib/receipt/types";
import { prepareTextForClassification } from "./normalize";
import { RECEIPT_INVOICE_POSITIVE_PHRASES } from "./signals";
import { STATEMENT_STRONG_PHRASES, isBakiyeInFuelReceiptContext } from "./signals";
import { hasDeliveryNoteStrongPhrase } from "./signals";

export interface ReceiptGateResult {
  docType: "receipt" | "invoice" | "statement" | "other";
  confidence: number;
  reasons: string[];
  evidenceScores: {
    merchantEvidence: number;
    totalEvidence: number;
    moneyLineDensity: number;
    paymentEvidence: number;
    taxEvidence: number;
  };
  structureEvidenceCount: number; // Number of structure evidences (merchant, itemized, payment, tax/invoice)
  passed: boolean; // Whether gate passed (structureEvidenceCount >= 2)
}

/**
 * Multi-lingual total keywords
 */
const TOTAL_KEYWORDS = [
  // English
  "total", "subtotal", "sum", "amount", "due", "payable", "grand total",
  // Turkish
  "toplam", "ara toplam", "tutar", "ödenen", "ödenecek",
  // Thai
  "รวม", "ยอดรวม", "จำนวนเงิน",
  // Spanish
  "total", "subtotal", "importe", "a pagar",
  // French
  "total", "sous-total", "montant", "à payer",
  // German
  "gesamt", "summe", "betrag", "zu zahlen",
  // Chinese
  "合计", "总计", "总额", "应付",
  // Japanese
  "合計", "総計", "金額",
];

/**
 * STRONG payment keywords - actual payment evidence (not just headers)
 * These indicate that a payment was actually made
 */
const STRONG_PAYMENT_KEYWORDS = [
  // English - actual payment evidence
  "cash", "card", "change", "tender", "pos", "slip", "paid", "payment received",
  // Turkish - actual payment evidence
  "nakit", "nakıt", "kart", "kredi kart", "para üstü", "ödedi", "ödendi", "ödeme yapıldı",
  // Turkish Fiscal Device Indicators (Mali Cihaz) - these are real payment evidence
  "fiş no", "fis no", "ekü no", "eku no", "z no", "t.sicil no", "mali cihaz",
  "fiscal device", "cash register", "yazar kasa",
  // Thai
  "เงินสด", "บัตร", "เงินทอน", "ชำระ",
  // Spanish
  "efectivo", "tarjeta", "cambio", "pago",
  // French
  "espèces", "carte", "monnaie", "paiement",
  // German
  "bargeld", "karte", "wechselgeld", "zahlung",
];

/**
 * WEAK payment keywords - headers/titles that don't prove payment
 * These are NOT sufficient evidence of payment
 */
const WEAK_PAYMENT_KEYWORDS = [
  "ödeme fişi", "payment receipt", "receipt", "fiş", // Headers only, not payment evidence
];

/**
 * Multi-lingual payment keywords (for backward compatibility)
 * @deprecated Use STRONG_PAYMENT_KEYWORDS for actual payment evidence
 */
const PAYMENT_KEYWORDS = STRONG_PAYMENT_KEYWORDS;

/**
 * Multi-lingual tax keywords (from signals.ts but expanded)
 */
const TAX_KEYWORDS = [
  "vat", "gst", "sst", "ppn", "kdv", "topkdv", "tva", "mwst", "ндс",
  "tax", "vergi", "vergi dairesi", "ภาษี", "impuesto", "impôt", "steuer",
  "税", "消費税", "增值税",
  // Turkish VAT/Tax variants
  "kdv", "kdv tutarı", "topkdv", "toplam kdv",
];

/**
 * Money pattern regex (supports various formats)
 * Allows optional * prefix (common in Turkish fiscal receipts)
 * Currency symbol is optional (many receipts just show numbers)
 */
const MONEY_PATTERN = /[\d.,]+\s*(?:TRY|THB|USD|EUR|GBP|JPY|CNY|₺|฿|\$|€|£|¥|元|บาท|TL|TL\.?|B\.?|RM|RUB|₽)?/i;
const MONEY_AMOUNT_PATTERN = /^[\s*]*[\d.,]+\s*(?:TRY|THB|USD|EUR|GBP|JPY|CNY|₺|฿|\$|€|£|¥|元|บาท|TL|TL\.?|B\.?|RM|RUB|₽)?\s*$/i;

/**
 * Chart-like patterns (more specific to avoid false positives)
 */
const CHART_PATTERNS = [
  /\b(?:chart|graph)\s+(?:legend|axis)/i, // "chart legend" or "graph axis"
  /\blegend\s+(?:of|for|chart|graph|axis)/i, // "legend of" or "legend for chart"
  /\baxis\s+(?:label|title|chart|graph)/i, // "axis label" or "axis title"
  /\(%\)/, // "(%)" pattern (percentage in parentheses)
  /\b(?:x-axis|y-axis|z-axis)/i, // Axis labels
  /\b(?:pie\s+chart|bar\s+chart|line\s+chart|scatter\s+plot)/i, // Chart types
];

/**
 * Country name patterns (for detecting world maps/charts)
 */
const COUNTRY_NAMES = [
  "turkey", "thailand", "usa", "united states", "china", "japan",
  "germany", "france", "spain", "italy", "uk", "united kingdom",
  "russia", "india", "brazil", "australia", "canada", "mexico",
  "indonesia", "malaysia", "singapore", "vietnam", "philippines",
  "türkiye", "tayland", "çin", "japonya", "almanya", "fransa",
  "ispanya", "italya", "ingiltere", "rusya", "hindistan",
];

/**
 * Check if document is a price list or catalog (not a receipt)
 */
function checkPriceListPatterns(ocrText: string, ocrLines: OCRLine[]): { isPriceList: boolean; reasons: string[] } {
  const normalized = ocrText.toLowerCase();
  const reasons: string[] = [];
  
  // Price list/catalog keywords
  const priceListKeywords = [
    /\bfiyat\s+listesi\b/i,
    /\bprice\s+list\b/i,
    /\bkatalog\b/i,
    /\bcatalog\b/i,
    /\bürün\s+listesi\b/i,
    /\bproduct\s+list\b/i,
    /\bfiyat\s+kataloğu\b/i,
    /\bkargo\s+fiyat/i,           // Cargo/shipping prices
    /\bshipping\s+(?:price|rate)s?\b/i,
    /\bdelivery\s+(?:price|rate)s?\b/i,
    /\btariff\b/i,                // Tariff/rate table
    /\btarife\b/i,                // Tarife (Turkish for rate table)
    /\bücret\s+(?:tablosu|listesi)\b/i,  // Fee table/list
  ];
  
  const hasPriceListKeyword = priceListKeywords.some(pattern => {
    if (pattern.test(ocrText)) {
      const match = ocrText.match(pattern);
      if (match) reasons.push(`price_list_keyword: "${match[0]}"`);
      return true;
    }
    return false;
  });
  
  // Check for table headers that indicate pricing tables
  const tablePricingHeaders = [
    /\b(?:desi|kg|gram|weight)\s*\/\s*(?:kg|gram|price|fiyat)/i,  // "Desi/KG", "Weight/Price"
    /\b(?:bölge|zone|region)\s*[\/\|\s]+\s*(?:fiyat|price|ücret|rate)/i,  // "Zone/Price"
    /\b(?:km|mesafe|distance)\s*[\/\|\s]+\s*(?:fiyat|price|ücret|rate)/i,  // "Distance/Price"
  ];
  
  const hasTableHeader = tablePricingHeaders.some(pattern => {
    if (pattern.test(ocrText)) {
      const match = ocrText.match(pattern);
      if (match) reasons.push(`table_pricing_header: "${match[0]}"`);
      return true;
    }
    return false;
  });
  
  // Check if document has many product lines but no strong payment evidence
  const productLines = ocrLines.filter(line => {
    const text = line.text.trim();
    // Product line pattern: text (product name) + price at end
    return /^[^\d]+\s+[\d.,]+\s*$/.test(text) && text.length > 10;
  }).length;
  
  const hasManyProducts = productLines >= 10;
  const hasNoStrongPayment = !STRONG_PAYMENT_KEYWORDS.some(kw => normalized.includes(kw));
  
  // If has price list keyword OR table header OR (many products + no payment evidence), likely price list
  if (hasPriceListKeyword || hasTableHeader) {
    return { isPriceList: true, reasons };
  }
  
  if (hasManyProducts && hasNoStrongPayment) {
    reasons.push(`price_list_indicator: ${productLines} product lines but no payment evidence`);
    return { isPriceList: true, reasons };
  }
  
  return { isPriceList: false, reasons: [] };
}

/**
 * Check Turkish fiscal receipt requirements
 * Turkish receipts must have: VKN/Tax ID, FİŞ NO, Address, Timestamp
 */
function checkTurkishFiscalReceiptRequirements(ocrText: string, ocrLines: OCRLine[]): {
  hasVKN: boolean;
  hasFisNo: boolean;
  hasAddress: boolean;
  hasTimestamp: boolean;
  score: number;
} {
  const normalized = ocrText.toLowerCase();
  
  const hasVKN = /\b(?:vkn|tckn|vergi\s*(?:no|kimlik|numarası)|tax\s*(?:id|no)|vergi\s*dairesi)\b/i.test(ocrText);
  const hasFisNo = /\b(?:fiş\s*no|fis\s*no|receipt\s*no|fatura\s*no|fiş\s*numara)\b/i.test(ocrText);
  const hasAddress = /\b(?:cad(?:desi)?|sok(?:ak)?|bulv(?:ar)?|no\s*:\s*\d|apt|kat|blok|mahalle|mah|mah\.)\b/i.test(ocrText);
  const hasTimestamp = /\b\d{1,2}[:\.]\d{2}(?:[:\.]\d{2})?\b/.test(ocrText) && 
                       /\b\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}\b/.test(ocrText);
  
  const score = [hasVKN, hasFisNo, hasAddress, hasTimestamp].filter(Boolean).length;
  
  return { hasVKN, hasFisNo, hasAddress, hasTimestamp, score };
}

export function analyzeReceiptGate(
  ocrText: string,
  ocrLines: OCRLine[]
): ReceiptGateResult {
  const reasons: string[] = [];
  const evidenceScores = {
    merchantEvidence: 0,
    totalEvidence: 0,
    moneyLineDensity: 0,
    paymentEvidence: 0,
    taxEvidence: 0,
  };

  const normalizedResult = prepareTextForClassification(ocrText);
  const normalizedLower = normalizedResult.normalized; // Already lowercase from normalizeText
  
  // EARLY REJECTION: Check for identity cards/passports BEFORE other checks
  const identityCardPatterns = [
    /\b(?:türkiye\s*cumhuriyeti\s*kimlik\s*kartı|republic\s*of\s*turkey\s*identity\s*card)\b/i,
    /\b(?:kimlik\s*kartı|identity\s*card|id\s*card)\b/i,
    /\b(?:t\.c\.\s*kimlik\s*no|tr\s*identity\s*no)\b/i,
    /\b(?:passport|pasaport)\b/i,
    /\b(?:driving\s*license|ehliyet|sürücü\s*belgesi)\b/i,
    /\b(?:doğum\s*tarihi|date\s*of\s*birth|birth\s*date)\b/i,
    /\b(?:son\s*geçerlilik\s*tarihi|valid\s*until|expiry\s*date)\b/i,
    /\b(?:seri\s*no|document\s*no|serial\s*number)\b/i,
  ];
  
  const hasIdentityCardPattern = identityCardPatterns.some(pattern => pattern.test(ocrText));
  // Additional check: If we have multiple identity card indicators, it's definitely an ID card
  const identityCardIndicators = identityCardPatterns.filter(pattern => pattern.test(ocrText)).length;
  
  if (hasIdentityCardPattern && identityCardIndicators >= 2) {
    return {
      docType: "other",
      confidence: 0.95,
      reasons: [
        "reject: Document appears to be an identity card, passport, or government ID (not a receipt)",
        `identity_card: Found ${identityCardIndicators} identity card indicators`,
      ],
      evidenceScores,
      structureEvidenceCount: 0,
      passed: false,
    };
  }

  // EARLY REJECTION: Check for price list/catalog BEFORE other checks
  const priceListCheck = checkPriceListPatterns(ocrText, ocrLines);
  if (priceListCheck.isPriceList) {
    return {
      docType: "other",
      confidence: 0.9,
      reasons: [
        "reject: Document appears to be a price list or catalog (not a receipt)",
        ...priceListCheck.reasons,
      ],
      evidenceScores,
      structureEvidenceCount: 0,
      passed: false,
    };
  }

  // 1. MERCHANT EVIDENCE SCORE
  // Top 15 lines should contain merchant-like name + contact info
  const topLines = ocrLines.slice(0, 15).map((line) => line.text.toLowerCase());
  const topLinesText = topLines.join(" ");

  // NEGATIVE KEYWORDS: If these are present, it's NOT a merchant (government IDs, documents, etc.)
  // E-Arşiv/fatura context: "Belge No", "Document No" are normal invoice fields - do NOT penalize
  const isEArchiveOrInvoice =
    /\b(?:e-arşiv|e-arsiv)\s*fatura\b|\bettn\s*no\b|\bmersis\s*no\b|\bfatura\s*adres\b|\bfaturaadres\b/i.test(ocrText);

  const negativeMerchantKeywordsAlways = [
    /\b(?:identity\s*card|kimlik\s*kartı|id\s*card|passport|pasaport|driving\s*license|ehliyet|sürücü\s*belgesi)\b/i,
    /\b(?:republic\s*of|cumhuriyeti|government|hükümet|devlet)\b/i,
    /\b(?:date\s*of\s*birth|doğum\s*tarihi|birth\s*date)\b/i,
    /\b(?:valid\s*until|geçerlilik|expiry|son\s*geçerlilik)\b/i,
    /\b(?:yerleşim\s*yeri\s*ve\s*diger\s*adres\s*belgesi|ikametgah\s*belgesi|adres\s*belgesi|residence\s*certificate|address\s*certificate)\b/i,
    /\b(?:nüfus\s*ve\s*vatandaşlık|içişleri\s*bakanlığı)\b/i,
    /\b(?:bakanlık|ministry|müdürlük\w*|directorate|genel\s*müdürlük\w*|general\s*directorate)\b/i,
  ];
  const negativeMerchantKeywordsUnlessInvoice = [
    /\b(?:document\s*no|seri\s*no|serial\s*number|belge\s*no)\b/i,
  ];

  const hasNegativeMerchantKeyword =
    negativeMerchantKeywordsAlways.some((p) => p.test(ocrText)) ||
    (!isEArchiveOrInvoice && negativeMerchantKeywordsUnlessInvoice.some((p) => p.test(ocrText)));
  if (hasNegativeMerchantKeyword) {
    evidenceScores.merchantEvidence = 0;
    reasons.push("merchant_evidence: Negative keyword detected (identity card, passport, government document)");
  } else {
    // Check for merchant name patterns (letters, possibly with numbers)
    const hasMerchantName = /[a-z]{3,}/i.test(topLinesText);
    
    // Check for contact info
    const hasPhone = /\b(?:\+?\d{1,4}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/.test(topLinesText);
    const hasAddress = /\b(?:street|st|avenue|ave|road|rd|boulevard|blvd|city|town|province|state|zip|postal)\b/i.test(topLinesText);
    const hasTaxId = /\b(?:tax\s*id|vat\s*no|tax\s*number|vergi\s*no|kdv\s*no|tax\s*id|vergi\s*dairesi)\b/i.test(topLinesText);
    const hasBranch = /\b(?:branch|şube|filiale|sucursal)\b/i.test(topLinesText);

    if (hasMerchantName && (hasPhone || hasAddress || hasTaxId || hasBranch)) {
      evidenceScores.merchantEvidence = 1.0;
      reasons.push("merchant_evidence: Merchant name + contact info found");
    } else if (hasMerchantName) {
      evidenceScores.merchantEvidence = 0.5;
      reasons.push("merchant_evidence: Merchant name found but no contact info");
    }
  }

  // 2. TOTAL EVIDENCE SCORE
  // Presence of total keywords + nearby money amount
  let totalScore = 0;
  for (const keyword of TOTAL_KEYWORDS) {
    if (normalizedLower.includes(keyword.toLowerCase())) {
      totalScore += 0.3;
      // Check if money amount is nearby (within 50 chars)
      const keywordIndex = normalizedLower.indexOf(keyword.toLowerCase());
      const nearbyText = normalizedLower.substring(
        Math.max(0, keywordIndex - 50),
        Math.min(normalizedLower.length, keywordIndex + keyword.length + 50)
      );
      if (MONEY_PATTERN.test(nearbyText)) {
        totalScore += 0.7;
        reasons.push(`total_evidence: "${keyword}" found with nearby amount`);
        break;
      }
    }
  }
  evidenceScores.totalEvidence = Math.min(1.0, totalScore);

  // 3. MONEY LINE DENSITY / ITEMIZED LINES EVIDENCE
  // Count lines ending with money-like tokens (itemized lines evidence)
  let moneyLines = 0;
  for (const line of ocrLines) {
    const lineText = line.text.trim();
    // Check if line ends with money pattern
    if (MONEY_AMOUNT_PATTERN.test(lineText) || MONEY_PATTERN.test(lineText)) {
      moneyLines++;
    }
  }
  evidenceScores.moneyLineDensity = Math.min(1.0, moneyLines / 5); // Normalize to 0-1
  if (moneyLines >= 2) {
    reasons.push(`money_line_density: ${moneyLines} lines with money amounts`);
  }
  
  // Itemized lines evidence: at least 2 lines with money amounts (lowered from 3)
  // Single-item receipts are valid receipts
  const hasItemizedLinesEvidence = moneyLines >= 2;

  // 4. PAYMENT EVIDENCE SCORE
  // IMPORTANT: Only count STRONG payment keywords (actual payment evidence)
  // Do NOT count weak keywords like "ÖDEME FİŞİ" (just a header, not payment proof)
  let foundStrongPayment = false;
  for (const keyword of STRONG_PAYMENT_KEYWORDS) {
    if (normalizedLower.includes(keyword.toLowerCase())) {
      evidenceScores.paymentEvidence = 1.0;
      reasons.push(`payment_evidence: "${keyword}" found (strong payment indicator)`);
      foundStrongPayment = true;
      break;
    }
  }
  
  // Check for weak payment keywords (headers only) - these don't count as payment evidence
  const hasWeakPaymentKeyword = WEAK_PAYMENT_KEYWORDS.some(kw => normalizedLower.includes(kw.toLowerCase()));
  if (hasWeakPaymentKeyword && !foundStrongPayment) {
    reasons.push(`payment_evidence: Found payment header but no actual payment evidence (weak keyword)`);
  }

  // 5. TAX EVIDENCE SCORE
  for (const keyword of TAX_KEYWORDS) {
    if (normalizedLower.includes(keyword.toLowerCase())) {
      evidenceScores.taxEvidence = 1.0;
      reasons.push(`tax_evidence: "${keyword}" found`);
      break;
    }
  }
  
  // Tax or Invoice evidence: tax keywords OR invoice keywords
  const hasTaxOrInvoiceEvidence = evidenceScores.taxEvidence >= 0.5 || 
    RECEIPT_INVOICE_POSITIVE_PHRASES.some((phrase) =>
      normalizedLower.includes(phrase.toLowerCase())
    );

  // Check for marketing banner patterns (strong negative)
  const marketingBannerPatterns = [
    /did you think/i,
    /did you know/i,
    /coming soon/i,
    /join (?:us|now)/i,
    /where.*your.*money.*went/i,
    /where.*does.*your.*money.*go/i,
    /how.*much.*do.*you.*spend/i,
    /what.*happens.*to.*your.*money/i,
  ];
  
  let marketingBannerScore = 0;
  for (const pattern of marketingBannerPatterns) {
    if (pattern.test(ocrText)) {
      marketingBannerScore += 0.5;
      reasons.push(`marketing_banner_pattern: ${pattern.source} detected`);
    }
  }
  
  // Check for single monetary value with no receipt keywords (banner indicator)
  const moneyMatches = ocrText.match(MONEY_PATTERN);
  const hasReceiptKeywords = RECEIPT_INVOICE_POSITIVE_PHRASES.some((phrase) =>
    normalizedLower.includes(phrase.toLowerCase())
  ) || evidenceScores.paymentEvidence >= 0.5 || evidenceScores.taxEvidence >= 0.5;
  
  if (moneyMatches && moneyMatches.length === 1 && !hasReceiptKeywords && evidenceScores.merchantEvidence < 0.5) {
    marketingBannerScore += 0.5;
    reasons.push("marketing_banner_indicator: Single monetary value with no receipt keywords");
  }
  
  // REJECT if marketing banner detected
  if (marketingBannerScore >= 0.5) {
    return {
      docType: "other",
      confidence: 0.9,
      reasons: [
        "receipt_gate: Document appears to be a marketing banner/infographic",
        ...reasons,
      ],
      evidenceScores,
      structureEvidenceCount: 0,
      passed: false,
    };
  }

  // Check for statement (strong reject)
  for (const phrase of STATEMENT_STRONG_PHRASES) {
    if (normalizedLower.includes(phrase.toLowerCase())) {
      // Fuel receipt with bakiye = loyalty card balance (Shell, Opet), NOT bank statement
      if (phrase.toLowerCase() === "bakiye" && isBakiyeInFuelReceiptContext(ocrText)) {
        continue;
      }
      return {
        docType: "statement",
        confidence: 0.95,
        reasons: [
          "receipt_gate: Statement detected (credit card/bank statement)",
          `statement_phrase: "${phrase}"`,
        ],
        evidenceScores,
        structureEvidenceCount: 0,
        passed: false,
      };
    }
  }

  // Check for delivery note (requires at least 2 strong phrases)
  // IMPORTANT: "irsaliye yerine geçer" is excluded (common on e-Arşiv invoices)
  // E-Arşiv fatura: "teslim eden", "teslim alan", "taşıyıcı" are normal signature block fields - do NOT treat as delivery note
  const deliveryNoteCheck = hasDeliveryNoteStrongPhrase(ocrText, ocrLines);
  if (deliveryNoteCheck.found && deliveryNoteCheck.matches.length >= 2) {
    const isEArchiveFatura = /\b(?:e-arşiv|e-arsiv)\s*fatura\b/i.test(ocrText);
    if (!isEArchiveFatura) {
      const matchedPhrases = deliveryNoteCheck.matches.join(", ");
      const matchDetails = deliveryNoteCheck.matchContexts
        .map((ctx, idx) => `line ${ctx.lineIndex + 1}: "${ctx.line}"`)
        .join("; ");

      return {
        docType: "other", // delivery_note is treated as "other" (reject)
        confidence: 0.9,
        reasons: [
          "receipt_gate: Delivery note detected (requires receipt/invoice)",
          `delivery_note_phrases: ${matchedPhrases}`,
          `delivery_note_context: ${matchDetails}`,
        ],
        evidenceScores,
        structureEvidenceCount: 0,
        passed: false,
      };
    }
    reasons.push("e_arsiv_delivery_note_skip: E-Arşiv fatura - teslim eden/alan/taşıyıcı are signature fields, not delivery note");
  }

  // Check for Turkish receipt - require fiscal infrastructure
  const isTurkishReceipt = /\b(?:türkiye|turkey|tr|try|tl|₺)\b/i.test(ocrText) || 
                           /\b(?:toplam|kdv|vergi|fis|fiş|turkish)\b/i.test(ocrText) ||
                           normalizedLower.includes("toplam") || normalizedLower.includes("kdv");
  
  let turkishFiscalPenalty = 0;
  if (isTurkishReceipt) {
    const fiscalReqs = checkTurkishFiscalReceiptRequirements(ocrText, ocrLines);

    // E-Arşiv bonus: invoices have ETTN, Belge No, Müşteri TCKN etc. - valid fiscal structure
    const eArchiveIndicators = {
      hasETTN: /\bettn\s*no\b/i.test(ocrText),
      hasBelgeNo: /\bbelge\s*no\b/i.test(ocrText),
      hasMusteriTCKN: /\b(?:müşteri|mosteri)\s*tckn\b/i.test(ocrText),
      hasEArchivLabel: /\b(?:e-arşiv|e-arsiv)\s*fatura\b/i.test(ocrText),
      hasMersis: /\bmersis\s*no\b/i.test(ocrText),
    };
    const eArchiveCount = Object.values(eArchiveIndicators).filter(Boolean).length;

    if (isEArchiveOrInvoice && eArchiveCount >= 2) {
      turkishFiscalPenalty = 0;
      reasons.push(
        `e_arsiv_ok: E-Arşiv fatura detected (${eArchiveCount} indicators) - valid fiscal structure`
      );
    } else if (fiscalReqs.score < 2 && evidenceScores.paymentEvidence < 0.5) {
      turkishFiscalPenalty = 1; // Reduce structure evidence count
      reasons.push(
        `turkish_fiscal_warning: Turkish receipt missing fiscal infrastructure (VKN=${fiscalReqs.hasVKN}, FİŞ NO=${fiscalReqs.hasFisNo}, Address=${fiscalReqs.hasAddress}, Timestamp=${fiscalReqs.hasTimestamp})`
      );
    } else if (fiscalReqs.score >= 2) {
      reasons.push(
        `turkish_fiscal_ok: Turkish fiscal receipt infrastructure verified (VKN=${fiscalReqs.hasVKN}, FİŞ NO=${fiscalReqs.hasFisNo}, Address=${fiscalReqs.hasAddress}, Timestamp=${fiscalReqs.hasTimestamp})`
      );
    }
  }

  // HARD REQUIREMENT: Count STRUCTURE evidences
  // Structure evidences are: merchantEvidence, totalEvidence (REQUIRED), itemizedLinesEvidence, paymentEvidence, taxOrInvoiceEvidence
  // Layout evidence must NEVER count as structure evidence
  // CRITICAL: Total evidence is REQUIRED - receipts must have a total amount
  const hasTotalEvidence = evidenceScores.totalEvidence >= 0.5; // Total keyword + nearby money amount
  
  const structureEvidences = [
    evidenceScores.merchantEvidence >= 0.5, // merchantEvidence
    hasTotalEvidence, // totalEvidence (REQUIRED - receipts must have total amount)
    hasItemizedLinesEvidence, // itemizedLinesEvidence (>=2 money lines)
    evidenceScores.paymentEvidence >= 0.5, // paymentEvidence (STRONG keywords only)
    hasTaxOrInvoiceEvidence, // taxOrInvoiceEvidence
  ];
  let structureEvidenceCount = structureEvidences.filter(Boolean).length;
  
  // CRITICAL: If no total evidence, reduce structure evidence count significantly
  // Receipts MUST have a total amount - this is a fundamental requirement
  if (!hasTotalEvidence) {
    structureEvidenceCount = Math.max(0, structureEvidenceCount - 1);
    reasons.push("total_evidence_required: No total amount found (receipts must have a total amount)");
  }
  
  // Apply Turkish fiscal penalty (reduce structure evidence if missing fiscal infrastructure)
  if (turkishFiscalPenalty > 0 && structureEvidenceCount > 0) {
    structureEvidenceCount = Math.max(0, structureEvidenceCount - turkishFiscalPenalty);
  }

  // POS slip exception: masked card + approval code or POS indicators = allow with 1 structure evidence
  const posSlipIndicators = [
    "müşteri nüshası", "musteri nushasi", "işlem tutarı", "islem tutari",
    "onay kodu", "rrn", "bank referans", "pos no", "işlem no", "stan",
    "batch no", "işyeri no", "customer copy", "merchant copy", "transaction amount",
    "authorization code", "approval code", "retrieval reference number",
    "terminal no", "term.no", "term no", "kart hamili", "cardholder",
  ];
  const hasPosSlipIndicators = posSlipIndicators.some((kw) => normalizedLower.includes(kw));
  const hasPosSlipMaskedCard = /\*{4}\s*\*{4}\s*\d{4}/.test(ocrText);
  const hasPosSlipApprovalCode = /onay\s*kodu|approval\s*code|auth\s*code/i.test(ocrText);
  const isPosSlipGate = hasPosSlipMaskedCard && (hasPosSlipApprovalCode || hasPosSlipIndicators);
  if (isPosSlipGate && structureEvidenceCount >= 1 && structureEvidenceCount < 2) {
    structureEvidenceCount = 2;
    reasons.push("pos_slip_ok: POS/bank slip detected - allowing pass with 1 structure evidence");
  }

  reasons.push(`structure_evidence_count: ${structureEvidenceCount}/4 (merchant:${evidenceScores.merchantEvidence >= 0.5 ? 1 : 0}, itemized:${hasItemizedLinesEvidence ? 1 : 0}, payment:${evidenceScores.paymentEvidence >= 0.5 ? 1 : 0}, tax/invoice:${hasTaxOrInvoiceEvidence ? 1 : 0}${turkishFiscalPenalty > 0 ? ` - ${turkishFiscalPenalty} penalty for missing fiscal infrastructure` : ''})`);

  // Check for chart-like patterns ONLY if structure evidence is low
  // This prevents false positives on valid receipts with words like "legend" or "%" symbols
  if (structureEvidenceCount < 2) {
    let chartScore = 0;
    for (const pattern of CHART_PATTERNS) {
      if (pattern.test(ocrText)) {
        chartScore += 0.3;
        reasons.push(`chart_pattern: ${pattern.source} detected`);
      }
    }

    // Check for many country names (world map/chart indicator)
    let countryCount = 0;
    for (const country of COUNTRY_NAMES) {
      if (normalizedLower.includes(country.toLowerCase())) {
        countryCount++;
      }
    }
    if (countryCount >= 3 && evidenceScores.merchantEvidence < 0.5) {
      chartScore += 0.5;
      reasons.push(`chart_indicator: ${countryCount} country names found (likely world map/chart)`);
    }

    // REJECT if chart-like AND structure evidence is low
    // Only reject if we have strong chart signals AND low structure evidence
    if (chartScore >= 0.9) {
      return {
        docType: "other",
        confidence: 0.9,
        reasons: [
          "receipt_gate: Document appears to be a chart/infographic",
          ...reasons,
        ],
        evidenceScores,
        structureEvidenceCount,
        passed: false,
      };
    }
  }
  
  // HARD REQUIREMENT: Must have at least 2 structure evidences to pass
  if (structureEvidenceCount < 2) {
    return {
      docType: "other",
      confidence: 0.7,
      reasons: [
        `reject: insufficient receipt structure evidence (${structureEvidenceCount}/4 required, minimum 2)`,
        ...reasons,
      ],
      evidenceScores,
      structureEvidenceCount,
      passed: false,
    };
  }

  // ACCEPTANCE CRITERIA (only if structure evidence requirement met)
  // At least 3 of 5 evidences OR (invoice: invoice keywords + tax id + total)
  const evidenceCount = [
    evidenceScores.merchantEvidence >= 0.5,
    evidenceScores.totalEvidence >= 0.5,
    evidenceScores.moneyLineDensity >= 0.3,
    evidenceScores.paymentEvidence >= 0.5,
    evidenceScores.taxEvidence >= 0.5,
  ].filter(Boolean).length;

  // Check for invoice-specific evidence
  const hasInvoiceKeyword = RECEIPT_INVOICE_POSITIVE_PHRASES.some((phrase) =>
    normalizedLower.includes(phrase.toLowerCase())
  );
  const isInvoice = hasInvoiceKeyword && evidenceScores.taxEvidence >= 0.5 && evidenceScores.totalEvidence >= 0.5;

  if (isInvoice) {
    return {
      docType: "invoice",
      confidence: 0.85,
      reasons: [
        "receipt_gate: Invoice detected (invoice keyword + tax + total)",
        ...reasons,
      ],
      evidenceScores,
      structureEvidenceCount,
      passed: true,
    };
  }

  if (evidenceCount >= 3) {
    return {
      docType: "receipt",
      confidence: 0.8,
      reasons: [
        `receipt_gate: Receipt detected (${evidenceCount}/5 evidences)`,
        ...reasons,
      ],
      evidenceScores,
      structureEvidenceCount,
      passed: true,
    };
  }

  // Reject if money line density is too low
  if (evidenceScores.moneyLineDensity < 0.2 && evidenceScores.totalEvidence < 0.3) {
    return {
      docType: "other",
      confidence: 0.7,
      reasons: [
        "receipt_gate: Insufficient evidence (low money lines + no total)",
        ...reasons,
      ],
      evidenceScores,
      structureEvidenceCount,
      passed: false,
    };
  }

  // Ambiguous - low confidence (but structure requirement met)
  return {
    docType: "other",
    confidence: 0.5,
    reasons: [
      `receipt_gate: Ambiguous document (only ${evidenceCount}/5 evidences)`,
      ...reasons,
    ],
    evidenceScores,
    structureEvidenceCount,
    passed: false, // Structure met but other evidence insufficient
  };
}


