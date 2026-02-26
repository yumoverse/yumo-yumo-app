/**
 * Receipt Gate - Security layer to reject non-receipt documents
 * 
 * This module implements a deterministic gate that blocks delivery notes,
 * waybills, screenshots, and other non-receipt documents BEFORE mining/reward processing.
 * 
 * Note: Invoices are now accepted as valid receipts.
 * 
 * Anti-scam engineering: Uses multiple signals, explainable decisions.
 */

import type { OCRLine } from "../receipt/types";

export interface ReceiptGateResult {
  ok: boolean;
  confidence: number; // 0-100
  reasons: string[];
  docType: "receipt" | "invoice" | "delivery_note" | "unknown";
}

interface GateSignals {
  negativeKeywords: string[];
  receiptStructureSignals: number;
  pdfDocumentSignals: number;
  layoutScore: number;
}

/**
 * Negative keywords that strongly indicate non-receipt documents
 */
const NEGATIVE_KEYWORD_PATTERNS = [
  // Delivery notes / Waybills
  /\birsaliye\b/i,
  /\bsevk\s+irsaliyesi\b/i,
  /\bsevk\s+irsaliye\b/i,
  /\bteslimat\s+notu\b/i,
  /\bdelivery\s+note\b/i,
  /\bwaybill\b/i,
  /\bsevk\b/i,
  /\bteslimat\b/i,
  
  // Bank transaction receipts / Bank dekontları (should be rejected)
  /\bdekont\b/i,
  /\bpara\s+transferi\b/i,
  /\bmoney\s+transfer\b/i,
  /\btransfer\s+dekontu\b/i,
  /\btransaction\s+receipt\b/i,
  /\biban\b/i,
  /\bhesap\s+no\b/i,
  /\baccount\s+number\b/i,
  /\bgönderen\b/i,
  /\balici\b/i,
  /\bsender\b/i,
  /\brecipient\b/i,
  /\bvalör\s+tarihi\b/i,
  /\bvalue\s+date\b/i,
  /\bişlem\s+kanalı\b/i,
  /\btransaction\s+channel\b/i,
  
  // Refund/Return documents (should be rejected)
  /\biade\b/i,
  /\breturn\b/i,
  /\brefund\b/i,
  /\biade\s+dekontu\b/i,
  /\breturn\s+receipt\b/i,
  /\brefund\s+receipt\b/i,
  
  // Change/Modification documents (should be rejected)
  // These indicate refunds, changes, or modifications to original purchases
  /\bdeğişiklik\s+hizmeti\b/i,
  /\bchange\s+service\s+fee\b/i,
  /\bchange\s+service\b/i,
  /\bfiyat\s+farkı\b/i,
  /\bprice\s+difference\b/i,
  /\bmodification\s+fee\b/i,
  /\bdeğişiklik\s+ücreti\b/i,
  /\bchange\s+fee\b/i,
  /\bmodification\s+charge\b/i,
  
  // Note: Invoice patterns removed - invoices are now accepted as valid receipts
  // Note: Airline tickets are accepted - only change/modification fees are rejected
  // Invoice patterns (REMOVED - invoices are now accepted):
  // - /\binvoice\b/i,
  // - /\bbill\s+to\b/i,
  // - /\bship\s+to\b/i,
  // - /\bpurchase\s+order\b/i,
  // - /\bpo\s+number\b/i,
  // - /\bpo\s*:\s*\d+/i,
  // - Payment/banking terms removed
  // - Invoice-specific address patterns removed
];

/**
 * Receipt structure signals (positive indicators)
 */
const RECEIPT_POSITIVE_PATTERNS = [
  /\bfiş\s+no\b/i,
  /\breceipt\s+no\b/i,
  /\bkasiyer\b/i,
  /\bcashier\b/i,
  /\bpos\b/i,
  /\bterminal\b/i,
  /\bpara\s+üstü\b/i,
  /\bchange\b/i,
  /\bcash\b/i,
  /\bnakit\b/i,
  /\bthank\s+you\b/i,
  /\bteşekkür\b/i,
  /\bvisa\b/i,
  /\bmastercard\b/i,
  /\bcard\s+ending\b/i,
  /\bkart\s+sonu\b/i,
  // Turkish e-Arşiv Fatura indicators (these are valid retail receipts)
  /\be-arşiv\s+fatura\b/i,
  /\be\s*arşiv\s+fatura\b/i,
  /\btopkdv\b|\btopkdy\b|\btopldv\b|\btopdv\b|\btopv\b|\btopkdi\b|\bt0pkdv\b|\btopodv\b|\btopkda\b/i, // Total VAT (incl. OCR typos) - common in Turkish receipts
  /\bödenecek\s*tutar\b/i, // Amount to pay - common in Turkish receipts
  /\bmal\/hizmet\s*toplam\s*tutar[ıi]\b/i, // Goods/Service total - common in Turkish receipts
  /\bprovizyon\s+no\b/i, // Authorization number - common in Turkish card receipts
  /\bkredi\s+kart[ıi]\b/i, // Credit card - common in Turkish receipts
];

/**
 * PDF/document-like formatting indicators (negative)
 */
const PDF_DOCUMENT_PATTERNS = [
  /\bterms\s+and\s+conditions\b/i,
  /\bterms\b/i,
  /\bpayment\s+terms\b/i,
  /\bsignature\b/i,
  /\bauthorized\b/i,
  /\bpage\s+\d+\s*\/\s*\d+\b/i,
  /\bpage\s+\d+\b/i,
  /\bconfidential\b/i,
  /\bproprietary\b/i,
];

/**
 * Screenshot/UI element patterns that indicate this is a screenshot, not a real receipt
 */
const SCREENSHOT_PATTERNS = [
  // UI Panel/Header titles
  /\bhidden\s+cost\s+breakdown\b/i,
  /\bblockchain\s+receipt\b/i,
  /\breceipt\s+image\b/i,
  /\bevidence\s+&\s+ocr\s+panel\b/i,
  /\bprice\s+breakdown\s+panel\b/i,
  /\byour\s+reward\s+panel\b/i,
  /\bextracted\s+summary\b/i,
  /\bextracted\s+data\b/i,
  
  // UI Button/Action text
  /\bback\s+button\b/i,
  /\bcontinue\s+button\b/i,
  /\bupload\s+receipt\b/i,
  /\baction\s+buttons\b/i,
  
  // System messages (not on real receipts) - STRENGTHENED
  /\bpowered\s+by\s+yumo\b/i,
  /\bthis\s+receipt\s+will\s+be\s+recorded\s+on\s+the\s+blockchain\b/i,
  /\bearned\s+from\s+hidden\s+costs\b/i,
  /\bhidden\s+costs\s+and\s+vat\s+excluded\b/i,
  /\braw\s+reward\b/i,
  /\bconversion\s+rate\b/i,
  /\bcost\s+items\s+identified\b/i,
  
  // NEW: More specific screenshot UI patterns
  /^price\s+breakdown$/i, // Exact match for "Price Breakdown" title
  /^hidden\s+costs\s+and\s+vat\s+excluded$/i, // Exact match for subtitle
  /^your\s+reward$/i, // Exact match for "Your Reward" title
  /^evidence\s+&\s+ocr$/i, // Exact match for "Evidence & OCR" title
  /\btotal\s+paid\s*$/i, // "Total Paid" label (common in UI)
  /\bestimate\s*$/i, // "Estimate" button/label
  /\bimport\/system\s+costs\b/i, // UI breakdown item
  /\bretail\s+hidden\s+costs\b/i, // UI breakdown item
  /\btaxes\s+and\s+other\s+costs\b/i, // UI breakdown item
  /\breference\s+price\b/i, // UI label
  /\btotal\s+hidden\s+cost\b/i, // UI label
  
  // UI control labels
  /\bcontrols\b/i,
  /\brotation\b/i,
  /\bcrop\s+tool\b/i,
  /\bmagnifying\s+glass\b/i,
  /\bzoom\s+in\b/i,
  
  // Phone screenshot indicators (status bar, navigation, system UI)
  /\bstatus\s+bar\b/i,
  /\bnotification\s+bar\b/i,
  /\bnavigation\s+bar\b/i,
  /\bhome\s+indicator\b/i,
  /\bgesture\s+bar\b/i,
  /\bbattery\s+percentage\b/i,
  /\bsignal\s+bars?\b/i,
  /\bwifi\s+icon\b/i,
  /\bbluetooth\s+icon\b/i,
  /\blocation\s+icon\b/i,
  /\bairplane\s+mode\b/i,
  /\bdo\s+not\s+disturb\b/i,
  /\bflashlight\b/i,
  /\bcamera\s+icon\b/i,
  /\bclock\s+widget\b/i,
  /\bdate\s+widget\b/i,
  /\bweather\s+widget\b/i,
  /\bscreenshot\s+saved\b/i,
  /\bscreenshot\s+captured\b/i,
  /\bscreen\s+recording\b/i,
  /\bshare\s+screenshot\b/i,
  /\bedit\s+screenshot\b/i,
  /\bdelete\s+screenshot\b/i,
  /\bswipe\s+up\s+to\s+dismiss\b/i,
  /\bswipe\s+down\s+to\s+dismiss\b/i,
  /\btap\s+to\s+edit\b/i,
  /\btap\s+to\s+share\b/i,
  /\bpinch\s+to\s+zoom\b/i,
  /\bdouble\s+tap\s+to\s+zoom\b/i,
  /\bapp\s+drawer\b/i,
  /\brecent\s+apps\b/i,
  /\bmultitasking\b/i,
  /\bsplit\s+screen\b/i,
  /\bpicture\s+in\s+picture\b/i,
  /\bfullscreen\s+mode\b/i,
  /\bimmersive\s+mode\b/i,
  /\bedge\s+gestures\b/i,
  /\bback\s+gesture\b/i,
  /\bhome\s+gesture\b/i,
  /\brecent\s+gesture\b/i,
  
  // Evidence panel messages (these are system messages, not receipt content)
  /\bboth\s+toplam\s+and\s+topkdv\s+found\s+but\s+total\s+<\s+1000\s+-\s+high\s+risk\s+of\s+confusion\b/i,
  /\btopkdv\s+found\s+but\s+vat\s+not\s+extracted\b/i,
  /\bllm\s+fallback:\s+total\s+corrected\s+from\b/i,
  
  // UI percentage/breakdown labels
  /\bstore\s+&\s+operations\b/i,
  /\bsupply\s+chain\s+&\s+journey\b/i,
  /\bretail\s+&\s+brand\s+layer\b/i,
  /\bstate\s+layer\s+\(on\s+receipt\)\b/i,
  /\bimport\/system\s+costs\b/i,
  /\bretail\s+hidden\s+costs\b/i,
  /\btaxes\s+and\s+other\s+costs\b/i,
  /\breference\s+price\b/i,
  /\btotal\s+hidden\s+cost\b/i,
  
  // Console error patterns (these indicate screenshots of error messages)
  // Use more specific patterns to avoid false positives
  /\berrorbound.*notfounderror/i,
  /\berrorbound.*failed\s+to\s+execute.*removechild/i,
  /\bnotfounderror.*failed\s+to\s+execute.*removechild/i,
  /\bfailed\s+to\s+execute\s+['"]removechild['"].*not\s+a\s+child/i,
  // Stack trace patterns (must have multiple indicators)
  /\bstack\s+trace.*\.js:\d+:\d+.*at\s+\w+\s*\(/i,
  /\bcomponentstack.*\.js:\d+:\d+/i,
  // Multiple error keywords together
  /(?:errorbound|notfounderror|typeerror|referenceerror).*(?:\.js:\d+:\d+|stack\s+trace|componentstack)/i,
  /\buncaught\s+(?:exception|error).*\.js:\d+:\d+/i,
  /\bunhandled\s+rejection.*\.js:\d+:\d+/i,
];

/**
 * Check for negative keywords (invoices, delivery notes)
 */
function checkNegativeKeywords(ocrText: string, ocrLines: OCRLine[]): string[] {
  const found: string[] = [];
  const lowerText = ocrText.toLowerCase();
  
  for (const pattern of NEGATIVE_KEYWORD_PATTERNS) {
    if (pattern.test(lowerText)) {
      const match = lowerText.match(pattern);
      if (match) {
        found.push(match[0]);
      }
    }
  }
  
  return found;
}

/**
 * Check for receipt structure signals
 */
function checkReceiptStructure(ocrText: string, ocrLines: OCRLine[]): number {
  let score = 0;
  const lowerText = ocrText.toLowerCase();
  
  // Check for positive receipt patterns
  for (const pattern of RECEIPT_POSITIVE_PATTERNS) {
    if (pattern.test(lowerText)) {
      score += 1;
    }
  }
  
  // Check for right-column price alignment (many lines ending with numbers)
  const priceLikeLines = ocrLines.filter(line => {
    const trimmed = line.text.trim();
    // Line ends with number pattern (price-like)
    return /\d+[.,]\d{2}\s*$/.test(trimmed) || /\d+\s*(?:TL|TRY|USD|€|\$)\s*$/.test(trimmed);
  });
  
  if (priceLikeLines.length >= 3) {
    score += 1;
  }
  
  // Check for itemized pattern (repeated name + amount lines)
  let itemizedCount = 0;
  for (const line of ocrLines) {
    const text = line.text.trim();
    // Pattern: text followed by number at end
    if (/^[^\d]+\s+\d+[.,]\d{2}\s*$/.test(text) || /^[^\d]+\s+\d+\s*(?:TL|TRY|USD|€|\$)\s*$/.test(text)) {
      itemizedCount++;
    }
  }
  
  if (itemizedCount >= 3) {
    score += 1;
  }
  
  // Check for narrow receipt layout (short line lengths, high line density)
  const avgLineLength = ocrLines.reduce((sum, line) => sum + line.text.length, 0) / (ocrLines.length || 1);
  if (avgLineLength < 40 && ocrLines.length > 10) {
    score += 1; // Receipt-like: narrow, many lines
  }
  
  // Check for VAT/KDV line in receipt format (not invoice header)
  if (/\b(kdv|vat|tax)\s*:?\s*\d+[.,]\d{2}\b/i.test(ocrText)) {
    // But not in invoice header position (first 5 lines)
    const headerText = ocrLines.slice(0, 5).map(l => l.text).join(" ");
    if (!/\b(kdv|vat|tax)\s*:?\s*\d+[.,]\d{2}\b/i.test(headerText)) {
      score += 1; // VAT in receipt body, not header
    }
  }
  
  return score;
}

/**
 * Check for PDF/document-like formatting
 */
function checkPDFDocumentSignals(ocrText: string, ocrLines: OCRLine[]): number {
  let score = 0;
  const lowerText = ocrText.toLowerCase();
  
  // Check for PDF/document patterns
  for (const pattern of PDF_DOCUMENT_PATTERNS) {
    if (pattern.test(lowerText)) {
      score += 1;
    }
  }
  
  // Check for paragraph-like formatting (long sentences, uniform spacing)
  const longLines = ocrLines.filter(line => line.text.length > 60);
  if (longLines.length > ocrLines.length * 0.3) {
    score += 1; // Many long lines = document-like
  }
  
  // Check for centered/header-like patterns (all caps titles)
  const allCapsLines = ocrLines.filter(line => {
    const text = line.text.trim();
    return text.length > 5 && text === text.toUpperCase() && /^[A-ZÇĞİÖŞÜ\s]+$/.test(text);
  });
  
  if (allCapsLines.length > 3) {
    score += 1; // Many all-caps lines = document header-like
  }
  
  return score;
}

/**
 * Calculate layout score (receipt vs document)
 */
function calculateLayoutScore(ocrLines: OCRLine[]): number {
  if (ocrLines.length === 0) return 0;
  
  // Receipts typically have:
  // - Many short lines (narrow width)
  // - High line density
  // - Right-aligned prices
  
  const avgLineLength = ocrLines.reduce((sum, line) => sum + line.text.length, 0) / ocrLines.length;
  const shortLines = ocrLines.filter(line => line.text.length < 50).length;
  const shortLineRatio = shortLines / ocrLines.length;
  
  let score = 0;
  
  // Narrow layout (receipt-like)
  if (avgLineLength < 45) {
    score += 2;
  } else if (avgLineLength < 60) {
    score += 1;
  }
  
  // High density of short lines
  if (shortLineRatio > 0.7) {
    score += 2;
  } else if (shortLineRatio > 0.5) {
    score += 1;
  }
  
  // Right-column price alignment
  // STRICT: Require at least 4 lines with right-aligned prices to count as layout evidence
  const rightAlignedPrices = ocrLines.filter(line => {
    const trimmed = line.text.trim();
    return /\d+[.,]\d{2}\s*$/.test(trimmed) || /\d+\s*(?:TL|TRY|USD|€|\$)\s*$/.test(trimmed);
  }).length;
  
  // Only count right-aligned prices if we have at least 4 lines with money amounts
  // This prevents false positives from banners with single "$9.99"
  if (rightAlignedPrices >= 4) {
    const priceAlignmentRatio = rightAlignedPrices / ocrLines.length;
    if (priceAlignmentRatio > 0.3) {
      score += 2;
    } else if (priceAlignmentRatio > 0.15) {
      score += 1;
    }
  }
  // If less than 4 right-aligned prices, don't add to score (prevents banner false positives)
  
  return Math.min(score, 6); // Cap at 6
}

/**
 * Determine document type from signals
 */
function determineDocType(signals: GateSignals, negativeKeywords: string[], isEArsivFatura: boolean = false): "receipt" | "invoice" | "delivery_note" | "unknown" {
  const lowerKeywords = negativeKeywords.map(k => k.toLowerCase());
  
  // Check for bank transaction receipt (DEKONT) - should be rejected
  const bankReceiptKeywords = ["dekont", "iban", "para transferi", "transaction receipt", "gönderen", "alıcı", "sender", "recipient"];
  if (bankReceiptKeywords.some(kw => lowerKeywords.some(k => k.includes(kw)))) {
    return "unknown"; // Bank dekontları reddedilecek
  }
  
  // Check for refund/return document (İADE) - should be rejected
  const refundKeywords = ["iade", "return", "refund"];
  if (refundKeywords.some(kw => lowerKeywords.some(k => k.includes(kw)))) {
    return "unknown"; // İade belgeleri reddedilecek
  }
  
  // Check for change/modification document (DEĞİŞİKLİK) - should be rejected
  // These are change fees, price differences, or modification charges (not original purchases)
  const changeKeywords = [
    "değişiklik hizmeti", 
    "change service fee", 
    "change service", 
    "fiyat farkı", 
    "price difference", 
    "modification fee", 
    "değişiklik ücreti",
    "change fee",
    "modification charge"
  ];
  if (changeKeywords.some(kw => lowerKeywords.some(k => k.includes(kw)))) {
    return "unknown"; // Değişiklik belgeleri reddedilecek
  }
  
  // Note: Normal airline tickets are accepted - only change/modification fees are rejected
  
  // Check for delivery note - requires STRONG evidence (at least 2 strong phrases)
  // IMPORTANT: "irsaliye yerine geçer" is EXCLUDED (common on e-Arşiv invoices)
  const deliveryStrongKeywords = [
    "sevk irsaliyesi",
    "irsaliye no",
    "irsaliye numarası",
    "sevk tarihi",
    "teslim eden",
    "teslim alan",
    "gönderici",
    "alıcı",
    "araç plaka",
    "plaka no",
    "çıkış tarihi",
    "delivery note",
    "dispatch note",
    "goods received",
    "consignee",
    "ship to",
    "vehicle plate",
    "waybill number",
  ];
  
  // Count strong delivery note keywords (excluding "irsaliye yerine geçer")
  let deliveryNoteCount = 0;
  const matchedDeliveryKeywords: string[] = [];
  
  for (const keyword of deliveryStrongKeywords) {
    const lowerKeyword = keyword.toLowerCase();
    for (const negKw of lowerKeywords) {
      if (negKw.includes(lowerKeyword)) {
        // Check exclusion: "irsaliye yerine geçer" should not count
        if (lowerKeyword.includes("irsaliye") && negKw.includes("yerine geçer")) {
          continue; // Skip this match - it's a false positive
        }
        deliveryNoteCount++;
        matchedDeliveryKeywords.push(keyword);
        break;
      }
    }
  }
  
  // Require at least 2 strong delivery note signals
  if (deliveryNoteCount >= 2) {
    console.log("[receiptGate] Delivery note detected:", {
      count: deliveryNoteCount,
      matchedKeywords: matchedDeliveryKeywords,
    });
    return "delivery_note";
  }
  
  // Note: Invoice detection removed - invoices are now accepted as valid receipts
  // Invoices will be treated as receipts and accepted
  
  // If strong negative signals but unclear type
  if (negativeKeywords.length >= 2 || signals.pdfDocumentSignals >= 2) {
    return "unknown";
  }
  
  return "receipt";
}

/**
 * Check for screenshot/UI element patterns
 */
function checkScreenshotPatterns(ocrText: string, ocrLines: OCRLine[]): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const lowerText = ocrText.toLowerCase();
  
  // Check for screenshot patterns
  for (const pattern of SCREENSHOT_PATTERNS) {
    if (pattern.test(lowerText)) {
      score += 3; // Each screenshot pattern is a strong indicator
      const match = lowerText.match(pattern);
      if (match) {
        reasons.push(`screenshot: detected UI element "${match[0]}"`);
      }
    }
  }
  
  // Check for multiple UI-related keywords (stronger signal)
  const uiKeywordCount = SCREENSHOT_PATTERNS.filter(pattern => pattern.test(lowerText)).length;
  if (uiKeywordCount >= 2) {
    score += 5; // Multiple UI elements = very strong screenshot indicator
    reasons.push(`screenshot: detected ${uiKeywordCount} UI elements (strong screenshot indicator)`);
  }
  
  // Check for structured UI layout (panels, sections, buttons)
  // Screenshots often have multiple section headers
  const sectionHeaderPatterns = [
    /\b(?:panel|section|header|footer|button|control|tool)\b/i,
  ];
  const sectionHeaderCount = sectionHeaderPatterns.reduce((count, pattern) => {
    const matches = lowerText.match(new RegExp(pattern.source, 'gi'));
    return count + (matches ? matches.length : 0);
  }, 0);
  
  if (sectionHeaderCount >= 3) {
    score += 2;
    reasons.push(`screenshot: detected ${sectionHeaderCount} UI structure keywords`);
  }
  
  // Check for "Evidence & OCR" panel content (this is a system UI element)
  if (/\bevidence\s*[&]\s*ocr\b/i.test(lowerText)) {
    score += 4;
    reasons.push("screenshot: detected 'Evidence & OCR' panel (system UI element)");
  }
  
  // Check for "Blockchain Receipt" title (this is a UI label, not receipt content)
  if (/\bblockchain\s+receipt\b/i.test(lowerText)) {
    score += 4;
    reasons.push("screenshot: detected 'Blockchain Receipt' title (UI label, not receipt content)");
  }
  
  // Check for "Hidden Cost Breakdown" title (this is a UI label)
  if (/\bhidden\s+cost\s+breakdown\b/i.test(lowerText)) {
    score += 4;
    reasons.push("screenshot: detected 'Hidden Cost Breakdown' title (UI label)");
  }
  
  return { score, reasons };
}

/**
 * Check for handwritten document patterns
 * Handwritten documents typically have:
 * - Very short text (few lines)
 * - No typical receipt structure (no VKN/TCKN, no address patterns)
 * - No timestamp patterns
 * - No payment terminal/POS indicators
 * - No barcode/QR indicators
 * - No phone/fax numbers
 */
function checkHandwrittenPatterns(ocrText: string, ocrLines: OCRLine[]): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const lowerText = ocrText.toLowerCase();
  
  // Check for receipt infrastructure elements
  const hasVKN = /\b(?:vkn|tckn|vergi\s*(?:no|kimlik)|tax\s*(?:id|no)|vergi\s*dairesi|\bvd\b)\b/i.test(ocrText);
  const hasTimestamp = /\b\d{1,2}[:\.]\d{2}(?:[:\.]\d{2})?\b/.test(ocrText); // Time pattern like 14:30 or 14.30.00
  const hasDate = /\b\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}\b/.test(ocrText); // Date pattern
  const hasPOSTerminal = /\b(?:pos|terminal|eft|işlem\s*no|fiş\s*no|slip\s*no|ref\s*no|seri\s*no|z\s*no)\b/i.test(ocrText);
  // Check for barcode/QR indicators
  // Pattern 1: Visual barcode indicators (asterisks, hashes, pipes, or text)
  const hasVisualBarcode = /\*{3,}|\#{3,}|barcode|barkod|\|\|\||QR/i.test(ocrText);
  
  // Pattern 2: Long numeric strings at the end of receipt (common in Turkish e-Arşiv fatura)
  // Barcodes are typically 20+ digits and appear in the last few lines
  const lastLines = ocrLines.slice(-5).map(l => l.text).join(' ');
  const hasNumericBarcode = /\b\d{20,}\b/.test(lastLines); // 20+ consecutive digits
  
  // Pattern 3: Check if last line is a long numeric string (very common for barcodes)
  const lastLine = ocrLines.length > 0 ? ocrLines[ocrLines.length - 1].text : '';
  const isLastLineBarcode = /^\d{20,}$/.test(lastLine.trim()); // Last line is only 20+ digits
  
  const hasBarcode = hasVisualBarcode || hasNumericBarcode || isLastLineBarcode;
  const hasPhone = /\b(?:tel|telefon|gsm|fax|phone)\s*[:\-]?\s*[\d\s\(\)\+\-]{7,}/i.test(ocrText);
  // Check for proper address - supports Turkish, English, Indonesian addresses
  const hasProperAddress = /\b(?:cad(?:desi)?|sok(?:ak)?|bulv(?:ar)?|no\s*[:.]\s*\d|apt|kat\s*:\s*\d|blok|plaza|merkez|avm|şube|street|avenue|road|building|jl\.?|jalan|kecamatan|kabupaten|desa|kelurahan|rt\s*\/?\s*rw|gang|gg\.?|perumahan|komplek|blok\s+[a-z]|lantai|lt\.?)\b/i.test(ocrText);
  const hasPaymentMethod = /\b(?:nakit|cash|kredi\s*kart|credit\s*card|visa|mastercard|troy|banka\s*kart|debit)\b/i.test(ocrText);
  const hasMerchantType = /\b(?:market|süpermarket|restoran|restaurant|cafe|kafe|benzin|petrol|eczane|pharmacy)\b/i.test(ocrText);
  
  // Count infrastructure signals
  const infrastructureCount = [
    hasVKN,
    hasTimestamp,
    hasDate,
    hasPOSTerminal,
    hasBarcode,
    hasPhone,
    hasProperAddress
  ].filter(Boolean).length;
  
  // Very few infrastructure signals = likely handwritten/fake
  if (infrastructureCount === 0) {
    score += 4;
    reasons.push("warn: No receipt infrastructure detected (no VKN, timestamp, POS, barcode, phone, or proper address)");
  } else if (infrastructureCount === 1) {
    score += 2;
    reasons.push(`warn: Only ${infrastructureCount} receipt infrastructure element detected`);
  }
  
  // Very few lines (typical handwritten notes are short)
  if (ocrLines.length < 10 && !hasBarcode && !hasPOSTerminal) {
    score += 2;
    reasons.push(`warn: Very few lines (${ocrLines.length}) without POS/barcode indicators`);
  }
  
  // Check for handwritten-style keywords (common in fake receipts)
  const handwrittenKeywords = [
    /\blt\s*x\s*\d+/i, // "30 Lt x 500" pattern (handwritten fuel calculation)
    /^\s*\*\s*[\d.,]+\s*$/m, // Lines starting with * followed by number only
    /^[\d.,]+\s*TL?\s*$/im, // Lines with just numbers and TL
  ];
  
  const handwrittenKeywordCount = handwrittenKeywords.filter(pattern => pattern.test(ocrText)).length;
  if (handwrittenKeywordCount >= 1) {
    score += 2;
    reasons.push("warn: Handwritten calculation patterns detected");
  }
  
  // No timestamp AND no date AND no POS = very suspicious
  if (!hasTimestamp && !hasDate && !hasPOSTerminal) {
    score += 2;
    reasons.push("warn: No timestamp, date, or POS terminal information");
  }
  
  // Check line length consistency - handwritten notes often have very short lines
  const avgLineLength = ocrLines.reduce((sum, line) => sum + line.text.length, 0) / Math.max(ocrLines.length, 1);
  if (avgLineLength < 15 && ocrLines.length < 15) {
    score += 1;
    reasons.push(`warn: Very short average line length (${avgLineLength.toFixed(1)} chars)`);
  }
  
  // No VKN/Tax ID is a major red flag for Turkish receipts
  if (!hasVKN && lowerText.includes("kdv")) {
    score += 2;
    reasons.push("warn: Contains KDV reference but no VKN/Tax ID (required for Turkish receipts)");
  }
  
  return { score, reasons };
}

/**
 * Check for suspicious extraction patterns that indicate non-receipt documents
 */
function checkSuspiciousExtractionPatterns(ocrText: string, ocrLines: OCRLine[]): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const lowerText = ocrText.toLowerCase();
  
  // Try to extract total amount (used by multiple patterns)
  let extractedTotal: number | null = null;
  const totalPatterns = [
    /toplam[\s:]*([\d,.]+)/i,
    /total[\s:]*([\d,.]+)/i,
    /ödenecek\s*tutar[\s:]*([\d,.]+)/i,
  ];
  
  for (const pattern of totalPatterns) {
    const match = ocrText.match(pattern);
    if (match && match[1]) {
      // Parse Turkish number format
      let amountStr = match[1].trim().replace(/\./g, '').replace(',', '.');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        extractedTotal = amount;
        break;
      }
    }
  }
  
  // Pattern 1: TOPKDV (or typos: TOPDY, TOPLDV, TOPDV, TOPKDI, etc.) found but no VAT amount extracted (suspicious)
  const hasTopkdv = /\btopkdv\b|\btopkdy\b|\btopldv\b|\btopdv\b|\btopv\b|\btopkdi\b|\bt0pkdv\b|\btopodv\b|\btopkda\b|\btoplam\s*kdv\b/i.test(ocrText);
  if (hasTopkdv) {
    // Check if there's a VAT amount near TOPKDV or any typo variant
    const topkdvVariants = ["topkdv", "topkdy", "topldv", "topdv", "topv", "topkdi", "t0pkdv", "topodv", "topkda"];
    const topkdvIndex = Math.min(
      ...topkdvVariants.map((v) => (lowerText.indexOf(v) >= 0 ? lowerText.indexOf(v) : Infinity))
    );
    const topkdvIndexValid = topkdvIndex !== Infinity ? topkdvIndex : -1;
    if (topkdvIndexValid !== -1) {
      const contextAfter = ocrText.substring(topkdvIndexValid, Math.min(ocrText.length, topkdvIndexValid + 100));
      // Look for VAT amount pattern near TOPKDV
      const hasVatAmount = /\d+[.,]\d{2}/.test(contextAfter);
      if (!hasVatAmount) {
        score += 2;
        reasons.push("suspicious: TOPKDV found but no VAT amount nearby");
      }
    }
  }
  
  // Pattern 2: Both TOPLAM (or typo) and TOPKDV found but total is very small (< 1000) - high confusion risk
  const hasToplam = /\btoplam\b|\btop_am\b|\btoplom\b|\btoplarn\b|\btoplan\b|\btop1am\b|\bt0plam\b/i.test(ocrText);
  if (hasToplam && hasTopkdv && extractedTotal !== null) {
    // If total is very small (< 1000), it's suspicious (might be confusion between TOPLAM and TOPKDV)
    if (extractedTotal < 1000) {
      score += 3;
      reasons.push(`suspicious: Both TOPLAM and TOPKDV found but total < 1000 (${extractedTotal}) - high risk of confusion`);
    }
  }
  
  // Pattern 3: Very low total amount (< 10) - likely not a real receipt
  if (extractedTotal !== null && extractedTotal < 10) {
    score += 2;
    reasons.push(`suspicious: Total amount is very low (${extractedTotal}) - unlikely to be a real receipt`);
  }
  
  // Pattern 4: LLM fallback corrected total significantly (indicates extraction confusion)
  // This will be checked in the analyze route, but we can check for signs here
  // If document has complex structure but low total, it's suspicious
  // BUT: e-Arşiv Fatura is a valid retail receipt, so don't penalize it
  const isEArsivFatura = /\be-arşiv\s+fatura\b|\be\s*arşiv\s+fatura\b/i.test(ocrText);
  // Note: Invoice structure check removed - invoices are now accepted as valid receipts
  // const hasComplexStructure = /e-fatura|invoice|fatura/i.test(ocrText) && !isEArsivFatura;
  // if (hasComplexStructure && extractedTotal !== null && extractedTotal < 500) {
  //   score += 2;
  //   reasons.push("suspicious: Complex document structure (invoice) but low total - likely confusion");
  // }
  
  return { score, reasons };
}

/**
 * Main receipt gate function
 * 
 * @param ocrText Full OCR text
 * @param ocrLines OCR lines array
 * @returns Gate result with pass/fail, confidence, reasons, and docType
 */
export function receiptGate(
  ocrText: string,
  ocrLines: OCRLine[]
): ReceiptGateResult {
  const reasons: string[] = [];
  let confidence = 50; // Start neutral
  
  // Check for Lorem Ipsum (test/placeholder text) - REJECT IMMEDIATELY
  const hasLoremIpsum = /\blorem\s+ipsum\b/i.test(ocrText);
  if (hasLoremIpsum) {
    return {
      ok: false,
      confidence: 0,
      reasons: [
        "reject: Lorem Ipsum placeholder text detected (not a real receipt)",
      ],
      docType: "unknown" as const,
    };
  }
  
  // Special handling: e-Arşiv Fatura is a valid retail receipt in Turkey
  // Check this first to avoid false rejections
  const isEArsivFatura = /\be-arşiv\s+fatura\b|\be\s*arşiv\s+fatura\b/i.test(ocrText);
  
  // Check for screenshots/error messages (RE-ENABLED - screenshots and error messages should be rejected)
  const screenshotPatterns = checkScreenshotPatterns(ocrText, ocrLines);
  if (screenshotPatterns.score > 0) {
    // Screenshots/error messages should always be rejected
    confidence -= screenshotPatterns.score * 15;
    reasons.push(...screenshotPatterns.reasons);
    
    // If ANY screenshot/error indicators found, reject immediately (lowered threshold from 5 to 3)
    // This ensures even single screenshot pattern triggers rejection
    if (screenshotPatterns.score >= 3) {
      return {
        ok: false,
        confidence: 0,
        reasons: [
          "reject: Screenshot or error message detected (not a real receipt)",
          ...screenshotPatterns.reasons,
        ],
        docType: "unknown" as const,
      };
    }
  }
  
  // Check for handwritten/fake document patterns
  const handwrittenPatterns = checkHandwrittenPatterns(ocrText, ocrLines);
  if (handwrittenPatterns.score > 0) {
    confidence -= handwrittenPatterns.score * 8;
    reasons.push(...handwrittenPatterns.reasons);
    
    // If strong handwritten/fake indicators found, reject immediately
    if (handwrittenPatterns.score >= 8) {
      return {
        ok: false,
        confidence: 0,
        reasons: [
          "reject: Document appears to be handwritten or lacks receipt infrastructure",
          ...handwrittenPatterns.reasons,
        ],
        docType: "unknown" as const,
      };
    }
  }
  
  // Check negative keywords
  const negativeKeywords = checkNegativeKeywords(ocrText, ocrLines);
  
  // Check for "irsaliye yerine geçer" exclusion (common on e-Arşiv invoices)
  const hasIrsaliyeYerineGecer = /\birsaliye\s+yerine\s+geçer\b/i.test(ocrText);
  
  // Filter negative keywords:
  // 1. Remove "fatura" if e-Arşiv Fatura
  // 2. Remove "irsaliye" if "irsaliye yerine geçer" is present
  const filteredNegativeKeywords = negativeKeywords.filter(kw => {
    const lowerKw = kw.toLowerCase();
    if (isEArsivFatura && lowerKw.includes("fatura")) {
      return false; // Don't penalize e-Arşiv Fatura for "fatura"
    }
    if (hasIrsaliyeYerineGecer && lowerKw.includes("irsaliye")) {
      return false; // Don't penalize "irsaliye yerine geçer" phrase
    }
    return true;
  });
  
  if (filteredNegativeKeywords.length > 0) {
    confidence -= filteredNegativeKeywords.length * 10; // Reduced from 15 to 10
    reasons.push(`warning: found keywords [${filteredNegativeKeywords.slice(0, 3).join(", ")}]`);
  }
  
  // TR e-Arşiv Invoice Booster: Check for strong e-Arşiv signals
  const hasEArsivFaturaText = /\b(?:e-arşiv|e\s*arşiv)\s+fatura\b/i.test(ocrText);
  const hasETTN = /\bettn\b/i.test(ocrText) && /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(ocrText);
  const hasKDV = /\bkdv\b/i.test(ocrText);
  const hasToplam = /\btoplam\b/i.test(ocrText);
  
  // Count e-Arşiv signals
  const eArsivSignals = [
    hasEArsivFaturaText,
    hasETTN,
    hasKDV && hasToplam, // Both KDV and Toplam together
  ].filter(Boolean).length;
  
  let hasStrongEArsivSignals = eArsivSignals >= 2; // At least 2 strong signals
  
  // If it's e-Arşiv Fatura or has strong e-Arşiv signals, boost confidence
  if (isEArsivFatura || hasStrongEArsivSignals) {
    const boostAmount = hasStrongEArsivSignals ? 20 : 25; // Strong signals get 20, simple detection gets 25
    confidence += boostAmount;
    const signalDetails = hasStrongEArsivSignals 
      ? ` (${eArsivSignals} strong signals: ${hasEArsivFaturaText ? "e-Arşiv Fatura text" : ""}${hasETTN ? " ETTN" : ""}${hasKDV && hasToplam ? " KDV+Toplam" : ""})`
      : "";
    reasons.push(`pass: e-Arşiv Fatura detected${signalDetails} (valid retail receipt in Turkey)`);
  }
  
  // DISABLED: Suspicious extraction patterns (fake/real verification disabled)
  // Only keep VAT > Total validation in analyze route
  // const suspiciousPatterns = checkSuspiciousExtractionPatterns(ocrText, ocrLines);
  
  // Check receipt structure signals
  const receiptStructureScore = checkReceiptStructure(ocrText, ocrLines);
  if (receiptStructureScore >= 3) {
    confidence += 30; // Increased from 20
    reasons.push(`pass: detected ${receiptStructureScore} receipt structure signals`);
  } else if (receiptStructureScore >= 2) {
    confidence += 20; // Increased from 10
    reasons.push(`pass: detected ${receiptStructureScore} receipt structure signals`);
  } else if (receiptStructureScore >= 1) {
    confidence += 10; // Added: even 1 signal is positive
    reasons.push(`pass: detected ${receiptStructureScore} receipt structure signal`);
  } else {
    confidence -= 10; // Reduced from 15
    reasons.push("missing: receipt structure signals (no cashier, POS, itemized lines)");
  }
  
  // Check layout score
  // IMPORTANT: Layout evidence must NEVER count as structure evidence
  // Layout is only a supporting signal, not a primary requirement
  const layoutScore = calculateLayoutScore(ocrLines);
  
  // Check PDF/document signals
  const pdfSignals = checkPDFDocumentSignals(ocrText, ocrLines);
  
  // Only penalize document-like formatting if:
  // 1. Multiple PDF signals (>= 2) AND
  // 2. Receipt structure evidence is low (receiptStructureScore < 2) OR
  // 3. Layout is A4-like (layoutScore < 2)
  // This prevents penalizing narrow receipt-shaped documents
  if (pdfSignals >= 2 && (receiptStructureScore < 2 || layoutScore < 2)) {
    confidence -= 15; // Reduced from 20
    reasons.push(`warning: document-like formatting (${pdfSignals} signals) with low receipt structure evidence`);
  } else if (pdfSignals === 1 && receiptStructureScore < 1) {
    confidence -= 5; // Reduced from 10
    reasons.push("info: some document-like formatting detected (low receipt structure)");
  } else if (pdfSignals >= 2) {
    // PDF signals but good receipt structure - don't penalize
    reasons.push(`info: document-like formatting (${pdfSignals} signals) but good receipt structure evidence`);
  }
  
  // Count lines with money amounts for layout validation
  const moneyLines = ocrLines.filter(line => {
    const trimmed = line.text.trim();
    return /\d+[.,]\d{2}\s*(?:TL|TRY|USD|EUR|GBP|JPY|CNY|₺|฿|\$|€|£|¥|元|บาท)?\s*$/.test(trimmed) ||
           /^\s*[\d.,]+\s*(?:TL|TRY|USD|EUR|GBP|JPY|CNY|₺|฿|\$|€|£|¥|元|บาท)?\s*$/.test(trimmed);
  }).length;
  
  // Only add layout pass if we have at least 4 lines with money amounts
  // This prevents banners with single "$9.99" from passing layout check
  if (layoutScore >= 4 && moneyLines >= 4) {
    confidence += 25; // Increased from 15
    reasons.push(`pass: receipt-like layout (narrow, high density, ${moneyLines} right-aligned prices)`);
  } else if (layoutScore >= 2 && moneyLines >= 4) {
    confidence += 15; // Increased from 5
    reasons.push(`pass: receipt-like layout detected (${moneyLines} money lines)`);
  } else if (layoutScore >= 1 && moneyLines >= 3) {
    confidence += 5; // Added: even 1 point is positive if we have some money lines
  } else {
    // Don't penalize for layout if we have good structure evidence
    if (receiptStructureScore < 2) {
      confidence -= 5; // Reduced from 10
      reasons.push("warning: layout may not be receipt-like (too wide or sparse)");
    }
  }
  
  // Build signals object
  const signals: GateSignals = {
    negativeKeywords: negativeKeywords,
    receiptStructureSignals: receiptStructureScore,
    pdfDocumentSignals: pdfSignals,
    layoutScore: layoutScore,
  };
  
  // Determine document type (use filtered keywords for e-Arşiv Fatura)
  const docType = determineDocType(signals, filteredNegativeKeywords, isEArsivFatura || hasStrongEArsivSignals);
  
  // Override: e-Arşiv Fatura or strong e-Arşiv signals -> always accept as receipt/invoice
  if (isEArsivFatura || hasStrongEArsivSignals) {
    // Check for strong statement signals (should still reject statements)
    const hasStrongStatementSignals = /\b(?:minimum\s+ödeme|asgari\s+ödeme|ekstre|kart\s+limiti|faiz\s+oranı|gecikme\s+faizi)\b/i.test(ocrText);
    
    // Check for strong delivery note signals (should still reject delivery notes)
    const hasStrongDeliveryNoteSignals = /\b(?:sevk\s+irsaliyesi|irsaliye\s+no|sevk\s+tarihi|teslim\s+alan|teslim\s+eden)\b/i.test(ocrText);
    
    // Only reject if strong statement or delivery note signals (not just "irsaliye" alone)
    if (hasStrongStatementSignals || hasStrongDeliveryNoteSignals) {
      // Strong negative signals override e-Arşiv detection
      return {
        ok: false,
        confidence: Math.max(0, confidence - 30),
        reasons: [
          hasStrongStatementSignals ? "reject: Strong statement signals detected" : "reject: Strong delivery note signals detected",
          ...reasons,
        ],
        docType: docType,
      };
    }
    
    // Accept e-Arşiv invoice/receipt
    return {
      ok: true,
      confidence: Math.max(75, Math.min(100, confidence)),
      reasons,
      docType: "invoice" as const, // e-Arşiv is an invoice
    };
  }
  
  // Final decision: lenient threshold (fake/real verification disabled)
  // Accept if confidence >= 75 OR (confidence >= 50 AND no negative keywords)
  const ok = (confidence >= 75) || 
             (confidence >= 50 && filteredNegativeKeywords.length === 0);
  
  // Clamp confidence to 0-100
  confidence = Math.max(0, Math.min(100, confidence));
  
  // Add docType to reasons if not receipt/invoice
  if (docType !== "receipt" && docType !== "invoice") {
    reasons.unshift(`reject: document type appears to be ${docType}`);
  }
  
  // Add score breakdown for debugging
  const scoreBreakdown = {
    base: 50,
    receiptStructure: receiptStructureScore >= 3 ? 30 : receiptStructureScore >= 2 ? 20 : receiptStructureScore >= 1 ? 10 : -10,
    layout: layoutScore >= 4 ? 25 : layoutScore >= 2 ? 15 : layoutScore >= 1 ? 5 : -5,
    pdfPenalty: pdfSignals >= 2 ? -15 : pdfSignals === 1 ? -5 : 0,
    negativeKeywords: -filteredNegativeKeywords.length * 10,
    eArsivBoost: (isEArsivFatura || hasStrongEArsivSignals) ? (hasStrongEArsivSignals ? 20 : 25) : 0,
    screenshotPenalty: -screenshotPatterns.score * 15,
  };
  reasons.push(`debug: score breakdown - base:${scoreBreakdown.base} +structure:${scoreBreakdown.receiptStructure} +layout:${scoreBreakdown.layout} -pdf:${scoreBreakdown.pdfPenalty} -keywords:${scoreBreakdown.negativeKeywords} +eArsiv:${scoreBreakdown.eArsivBoost} -screenshot:${scoreBreakdown.screenshotPenalty} = ${Math.round(confidence)}`);
  
  return {
    ok,
    confidence: Math.round(confidence),
    reasons,
    docType,
  };
}

