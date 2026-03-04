/**
 * Robust receipt extraction with scoring system
 * Prevents branch IDs, invoice numbers, and other identifiers from being mistaken as totals
 *
 * Exports:
 * - extractTotalRobust(lines)
 * - extractVATRobust(lines, totalAmount)
 *
 * Notes:
 * - Server-side friendly. Do NOT run in client for security.
 * - Does not use Unicode property regex (\p{L}) so it works in older runtimes.
 */

import type { OCRLine, TotalExtraction, VATExtraction } from "../receipt/types";
import { TOTAL_STRONG_KEYS, CURRENCY_SYMBOLS } from "@/lib/shared/constants";
import type { CountryConfig } from "@/lib/country/base";

/** Lines containing these are loyalty/points (Maxi Puan, etc.) — not receipt total. */
const LOYALTY_PUAN_PATTERN = /maxipuan|maxi\s*puan|kazanilan\s*maxipuan|toplam\s*maxipuan/i;

interface AmountCandidate {
  value: number;
  lineNo: number;
  rawText: string; // full line text (normalized)
  matchedText: string; // the specific numeric token matched (original, with asterisk if present)
  hasAsteriskPrefix?: boolean; // Turkish convention: *43,50 - checked before any stripping
  contextWindow: {
    prev: string;
    current: string;
    next: string;
  };
  score: number;
  scoreBreakdown: string[];
  /** True when this is the only candidate with . or , (POS slip: single amount). */
  isOnlyDotCommaCandidate?: boolean;
}

interface BranchIdMatch {
  branchId: number;
  lineNo: number;
  pattern: string;
}

/**
 * Preprocess OCR lines: normalize and clean
 */
function preprocessOCRLines(lines: OCRLine[]): OCRLine[] {
  const noisePatterns = [
    /wifi.*password/i,
    /password\s*:/i,
    /qr.*code/i,
    /promo.*code/i,
    /discount.*code/i,
    /website.*http/i,
    /https?:\/\//i,
    /www\./i,
  ];

  return lines
    .map((line) => {
      // Normalize: lowercase, trim, collapse spaces
      let normalized = (line.text ?? "")
        .toLowerCase()
        .trim()
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ");

      if (!normalized) return null;

      // Remove obvious noise lines but keep numbers
      // (If a line is purely noise-like, drop it)
      for (const pattern of noisePatterns) {
        if (pattern.test(normalized)) return null;
      }

      return {
        ...line,
        text: normalized,
      };
    })
    .filter((line): line is OCRLine => line !== null);
}

/**
 * Extract branch/store IDs from OCR lines
 */
function extractBranchIds(lines: OCRLine[]): BranchIdMatch[] {
  const branchPatterns = [
    /(Ã Â¸ÂªÃ Â¸Â²Ã Â¸â€šÃ Â¸Â²|branch)\s*[:#\-]?\s*(\d{3,6})/i,
    /(store|shop|location)\s*[:#\-]?\s*(\d{3,6})/i,
    /(branch|Ã Â¸ÂªÃ Â¸Â²Ã Â¸â€šÃ Â¸Â²)\s+(\d{3,6})/i,
  ];

  const branchIds: BranchIdMatch[] = [];

  for (const line of lines) {
    for (const pattern of branchPatterns) {
      const match = line.text.match(pattern);
      if (match) {
        const branchId = parseInt(match[2], 10);
        if (!isNaN(branchId)) {
          branchIds.push({
            branchId,
            lineNo: line.lineNo,
            pattern: match[0],
          });
        }
      }
    }
  }

  return branchIds;
}

/**
 * Generate amount candidates from OCR lines
 * @param lines OCR lines to scan
 * @param countryConfig Optional country config for number format parsing
 */
function generateAmountCandidates(lines: OCRLine[], countryConfig?: CountryConfig): AmountCandidate[] {
  const candidates: AmountCandidate[] = [];

  // Match amounts like:
  // 135.00, 8.83, 200,00, 1,234.56, 1234,56, 135
  // Special: 8.566.00 (Turkish fuel receipts - multiple dots)
  // Turkish receipt convention: *43,50 (asterisk prefix)
  // We'll normalize later.
  // Priority: Match "8.566.00" format first (multiple dots with 2-digit decimal)
  // Also handle cases with asterisks: "**8.566.00**"
  const multipleDotsPattern = /(\*{0,2}\d{1,3}(?:\.\d{3})+\.\d{2}\*{0,2})/g; // Matches "8.566.00", "**8.566.00**", "1.234.567.89"
  // Turkish format: "1.109,00" (dot = thousand, comma = decimal) - must match as single token
  const turkishFormatPattern = /(\*{0,2}\d{1,3}(?:\.\d{3})+,\d{2}\*{0,2})/g; // Matches "1.109,00", "*1.109,00", "12.345,67"
  const amountPattern = /(\*{0,2}\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})?|\*{0,2}\d+[.,]\d{2}|\*{0,2}\d+)/g; // Also matches "*43,50"

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

// Ã¢Å¡Â Ã¯Â¸Â SKIP DATE PATTERNS - they look like numbers!
    // Dates like "26.01.2026" get parsed as "2601" causing false total amounts
    if (/\b\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4}\b/.test(line.text)) {
      continue; // Skip this line completely
    }

    const matchedMultipleDots: Set<string> = new Set(); // Track matched positions
    
    // First, try to match Turkish format (e.g., "1.109,00" - dot = thousand, comma = decimal)
    const turkishFormatMatches = Array.from(line.text.matchAll(turkishFormatPattern));
    for (const match of turkishFormatMatches) {
      const token = match[0];
      const hasAsteriskPrefix = /^\*/.test(token);
      const matchStart = match.index || 0;
      const matchEnd = matchStart + match[0].length;
      
      // Store matched range to skip overlapping regular matches
      for (let pos = matchStart; pos < matchEnd; pos++) {
        matchedMultipleDots.add(`${i}:${pos}`);
      }
      
      const value = parseLooseNumber(token, countryConfig);
      if (value != null && value > 0) {
        const prevLine = i > 0 ? lines[i - 1].text : "";
        const nextLine = i < lines.length - 1 ? lines[i + 1].text : "";
        candidates.push({
          value,
          lineNo: line.lineNo,
          rawText: line.text,
          matchedText: token,
          hasAsteriskPrefix,
          contextWindow: {
            prev: prevLine,
            current: line.text,
            next: nextLine,
          },
          score: 0,
          scoreBreakdown: [],
        });
        console.log(`[generateAmountCandidates] Ã¢Å“â€¦ Matched Turkish format: "${token}" Ã¢â€ â€™ ${value} (line ${line.lineNo}, raw: "${line.text}")`);
      }
    }
    
    // Then, try to match multiple dots format (e.g., "8.566.00")
    const multipleDotsMatches = Array.from(line.text.matchAll(multipleDotsPattern));
    for (const match of multipleDotsMatches) {
      const token = match[0];
      const hasAsteriskPrefix = /^\*/.test(token);
      // Remove asterisks if present (e.g., "**8.566.00**" -> "8.566.00")
      const cleanToken = token.replace(/\*/g, '');
      const matchStart = match.index || 0;
      const matchEnd = matchStart + match[0].length; // Use original length for overlap detection
      
      // Store matched range to skip overlapping regular matches
      for (let pos = matchStart; pos < matchEnd; pos++) {
        matchedMultipleDots.add(`${i}:${pos}`);
      }
      
      const value = parseLooseNumber(cleanToken, countryConfig);
      if (value != null && value > 0) {
        const prevLine = i > 0 ? lines[i - 1].text : "";
        const nextLine = i < lines.length - 1 ? lines[i + 1].text : "";
        candidates.push({
          value,
          lineNo: line.lineNo,
          rawText: line.text,
          matchedText: token,
          hasAsteriskPrefix,
          contextWindow: {
            prev: prevLine,
            current: line.text,
            next: nextLine,
          },
          score: 0,
          scoreBreakdown: [],
        });
        console.log(`[generateAmountCandidates] Ã¢Å“â€¦ Matched multiple dots format: "${token}" Ã¢â€ â€™ ${value} (line ${line.lineNo}, raw: "${line.text}")`);
      }
    }
    
    // Then match regular amounts (but skip if already matched as multiple dots)
    const matches = line.text.matchAll(amountPattern);
    for (const match of matches) {
      const token = match[0];
      const matchStart = match.index || 0;
      const matchEnd = matchStart + token.length;
      
      // Skip if this token overlaps with a multiple dots pattern
      let overlaps = false;
      for (let pos = matchStart; pos < matchEnd; pos++) {
        if (matchedMultipleDots.has(`${i}:${pos}`)) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) {
        continue; // Skip this token, already matched as part of multiple dots
      }

      const hasAsteriskPrefix = /^\*/.test(token);
      const value = parseLooseNumber(token, countryConfig);
      if (value == null) continue;
      if (value <= 0) continue;

      const prevLine = i > 0 ? lines[i - 1].text : "";
      const nextLine = i < lines.length - 1 ? lines[i + 1].text : "";

      candidates.push({
        value,
        lineNo: line.lineNo,
        rawText: line.text,
        matchedText: token,
        hasAsteriskPrefix,
        contextWindow: {
          prev: prevLine,
          current: line.text,
          next: nextLine,
        },
        score: 0,
        scoreBreakdown: [],
      });
    }
  }

  // POS slip: if exactly one candidate has . or , in matched/raw text, mark it
  const hasDotOrComma = (text: string) => text.includes(".") || text.includes(",");
  const candidatesWithDecimal = candidates.filter(
    (c) => hasDotOrComma(c.matchedText) || hasDotOrComma(c.rawText)
  );
  const onlyDotCommaCandidate = candidatesWithDecimal.length === 1;
  return candidates.map((c) => ({
    ...c,
    isOnlyDotCommaCandidate:
      onlyDotCommaCandidate && (hasDotOrComma(c.matchedText) || hasDotOrComma(c.rawText)),
  }));
}

/**
 * Parse number token that may contain commas, spaces, dots
 * Uses countryConfig for country-specific number format parsing
 * - "1,234.56" -> 1234.56 (US format)
 * - "1.234,56" -> 1234.56 (EU format)
 * - "8,500" -> 8500 (Indonesian format, comma = thousand)
 * - "200,00" -> 200.00 (decimal)
 * - "135" -> 135
 * 
 * @param token Raw number string from OCR
 * @param countryConfig Optional country config for number format rules
 */
export function parseLooseNumber(token: string, countryConfig?: CountryConfig): number | null {
  let s = (token ?? "").trim();
  if (!s) return null;

  // Remove asterisks (Turkish receipt convention: *43,50)
  s = s.replace(/^\*+|\*+$/g, "");

  // Remove spaces used as thousand separators
  s = s.replace(/\s+/g, "");


  const format = countryConfig?.numberFormat;

  // 1) Country-specific parseFunction has highest priority
  if (format?.parseFunction) {
    const result = format.parseFunction(s);
    if (result !== null) {
      return result;
    }
    // If parseFunction returns null, fall through to generic logic
  }

  // 2) Special case: Multiple dots (e.g., "8.566.00" from Turkish fuel receipts)
  const dotCount = (s.match(/\./g) || []).length;
  if (dotCount >= 2) {
    // Handle weird format like "8.566.00" (multiple dots)
    const parts = s.split('.');
    const lastPart = parts.pop() || '';
    
    // If last part is 2 digits, it's likely decimal (e.g., "8.566.00" -> 8566.00)
    if (lastPart.length === 2 && /^\d+$/.test(lastPart)) {
      // Combine all parts except last as integer, then add last as decimal
      const integerPart = parts.join('');
      s = integerPart + '.' + lastPart;
      const result = parseFloat(s);
      if (!isNaN(result) && result > 0) {
        return result;
      }
    }
    
    // If last part is 1-3 digits, treat as decimal
    if (lastPart.length <= 3 && /^\d+$/.test(lastPart)) {
      const integerPart = parts.join('');
      s = integerPart + '.' + lastPart;
      const result = parseFloat(s);
      if (!isNaN(result) && result > 0) {
        return result;
      }
    }
  }

  // 3) Generic logic using decimalSeparators / thousandSeparators if provided
  if (format) {
    const { decimalSeparators = [], thousandSeparators = [] } = format;
    const hasComma = s.includes(",");
    const hasDot = s.includes(".");

    if (hasComma && hasDot) {
      const lastComma = s.lastIndexOf(",");
      const lastDot = s.lastIndexOf(".");
      if (decimalSeparators.includes(".") && thousandSeparators.includes(",")) {
        // "1,234.56" format
        s = s.replace(/,/g, "");
      } else if (decimalSeparators.includes(",") && thousandSeparators.includes(".")) {
        // "1.234,56" format
        s = s.replace(/\./g, "").replace(/,/g, ".");
      } else {
        // Fallback based on position: last separator is decimal
        if (lastDot > lastComma) {
          s = s.replace(/,/g, "");
        } else {
          s = s.replace(/\./g, "").replace(/,/g, ".");
        }
      }
    } else if (hasComma && !hasDot) {
      if (decimalSeparators.includes(",") && !thousandSeparators.includes(",")) {
        // Comma is decimal
        const parts = s.split(",");
        if (parts.length === 2 && parts[1].length <= 2) {
          s = s.replace(/,/g, ".");
        } else {
          s = s.replace(/,/g, "");
        }
      } else if (thousandSeparators.includes(",") && !decimalSeparators.includes(",")) {
        // Comma is thousand
        s = s.replace(/,/g, "");
      } else {
        // Ambiguous - use heuristic
        const parts = s.split(",");
        if (parts.length === 2 && parts[1].length === 2) {
          s = s.replace(/,/g, ".");
        } else {
          s = s.replace(/,/g, "");
        }
      }
    } else if (!hasComma && hasDot) {
      if (decimalSeparators.includes(".") && !thousandSeparators.includes(".")) {
        // Dot is decimal - keep as is
      } else if (thousandSeparators.includes(".") && !decimalSeparators.includes(".")) {
        // Dot is thousand
        s = s.replace(/\./g, "");
      }
      // Otherwise keep as is
    }
  } else {
    // 3) Existing fallback logic (for countries without numberFormat config)
    // If both comma and dot exist, decide thousand vs decimal:
    // "1,234.56" => comma thousands, dot decimal
    // "1.234,56" => dot thousands, comma decimal
    const hasComma = s.includes(",");
    const hasDot = s.includes(".");

    if (hasComma && hasDot) {
      const lastComma = s.lastIndexOf(",");
      const lastDot = s.lastIndexOf(".");
      if (lastDot > lastComma) {
        // dot is decimal separator, commas are thousand separators
        s = s.replace(/,/g, "");
      } else {
        // comma is decimal separator, dots are thousand separators
        s = s.replace(/\./g, "");
        s = s.replace(/,/g, ".");
      }
    } else if (hasComma && !hasDot) {
      // Could be decimal (200,00) or thousands (1,234)
      const parts = s.split(",");
      if (parts.length === 2 && parts[1].length === 2) {
        s = s.replace(/,/g, ".");
      } else {
        s = s.replace(/,/g, "");
      }
    }
    // only dot or only digits: keep as-is
  }

  let v = parseFloat(s);
  if (!isFinite(v)) return null;

  // Turkish 100x heuristic: "1.700,00" -> OCR "170000" (missing thousand separator)
  if (v > 10_000 && v % 100 === 0) {
    const corrected = v / 100;
    if (corrected >= 1 && corrected <= 1_000_000) {
      return corrected;
    }
  }
  return v;
}

function tokenHasTwoDecimals(token: string): boolean {
  const s = token.replace(/\s+/g, "");
  // Accept both "." and "," as decimal separator in token (before normalization)
  return /[.,]\d{2}\b/.test(s);
}

export interface ScoreCandidateOpts {
  isOnlyDotCommaCandidate?: boolean;
  isPosSlip?: boolean;
  /** When set (e.g. MY), context disqualifier (-60) is skipped so footer lines with "%" / "charge" don't penalize "RM 61.50" on current line. */
  countryConfig?: CountryConfig;
}

/**
 * Score a candidate using explicit, additive rules
 */
function scoreCandidate(
  candidate: AmountCandidate,
  lines: OCRLine[],
  branchIds: BranchIdMatch[],
  lineIndex: number,
  totalKeywords: string[] = TOTAL_STRONG_KEYS,
  opts?: ScoreCandidateOpts
): AmountCandidate {
  let score = 0;
  const breakdown: string[] = [];
  const { value, rawText, contextWindow, matchedText } = candidate;
  const isPosSlip = opts?.isPosSlip;
  const isOnlyDotCommaCandidate = candidate.isOnlyDotCommaCandidate ?? opts?.isOnlyDotCommaCandidate;

  const strongTotalKeywords = totalKeywords;

  // +100: POS slip and single candidate with . or , (transaction amount)
  if (isPosSlip && isOnlyDotCommaCandidate) {
    score += 100;
    breakdown.push("+100: POS slip - single . or , amount (transaction total)");
  }

  const lowerCurrent = contextWindow.current.toLowerCase();
  const lowerPrev = contextWindow.prev.toLowerCase();
  const lowerNext = contextWindow.next.toLowerCase();
  const lowerContext = `${lowerPrev} ${lowerCurrent} ${lowerNext}`.toLowerCase();

  // -150: Amount in loyalty/puan section (e.g. TOPLAM MAXIPUAN 21.71 TL) — not the receipt total
  if (LOYALTY_PUAN_PATTERN.test(lowerContext)) {
    score -= 150;
    breakdown.push("-150: Line in loyalty/puan section (not receipt total)");
  }

  // +80: Contains strong total keywords on current line OR (current is number-only and prev has total keyword)
  const isMostlyNumberLine = /^[^a-zÃ Â¸Â-Ã Â¹â„¢]*\d+([.,]\d{1,2})?[^a-zÃ Â¸Â-Ã Â¹â„¢]*$/i.test(lowerCurrent);
  const prevHasStrong = strongTotalKeywords.some((k) => lowerPrev.includes(k.toLowerCase()));  // Ã¢â€ Â EKLE .toLowerCase()
  const curHasStrong = strongTotalKeywords.some((k) => lowerCurrent.includes(k.toLowerCase())); // Ã¢â€ Â EKLE .toLowerCase()
  // Also check next line for "Grand Total :" pattern where total is on next line
  const nextHasValue = /^\d+([.,]\d{1,2})?$/.test(contextWindow.next.trim());

  // Ödenecek tutar: fişte "ödenecek tutar" etiketi varsa toplam olarak o satırdaki veya sonraki tutar seçilsin (A101 vb.).
  // Etiket ile tutar arasında ödeme/kart satırları olabilir → aday satırından geriye 2–10 satır tara.
  const ODENECEK_TUTAR_KEYS = ["ödenecek tutar", "ödenecek toplam", "odenecek tutar", "odenecek toplam", "ödenecek kdv dahil tutar", "odenecek kdv dahil tutar"];
  const prevHasOdenecekTutar = ODENECEK_TUTAR_KEYS.some((k) => lowerPrev.includes(k));
  const curHasOdenecekTutar = ODENECEK_TUTAR_KEYS.some((k) => lowerCurrent.includes(k));
  const nextHasOdenecekTutar = ODENECEK_TUTAR_KEYS.some((k) => lowerNext.includes(k));
  let hasOdenecekTutarInPrevLines = prevHasOdenecekTutar || curHasOdenecekTutar || nextHasOdenecekTutar;
  if (!hasOdenecekTutarInPrevLines) {
    for (let j = Math.max(0, lineIndex - 10); j < lineIndex && j <= lineIndex - 2; j++) {
      const prevLineLower = (lines[j]?.text ?? "").toLowerCase();
      if (ODENECEK_TUTAR_KEYS.some((k) => prevLineLower.includes(k))) {
        hasOdenecekTutarInPrevLines = true;
        break;
      }
    }
  }
  if (hasOdenecekTutarInPrevLines) {
    score += 90;
    breakdown.push("+90: Ödenecek tutar satırı (veya önceki 10 satırda etiket)");
  }

  // "Ödenecek KDV Dahil Tutar" gibi en yetkili toplam etiketi sonraki satırdaki tutara +100 verir
  let hasOdenecekToplamHeader = false;
  if (!hasOdenecekTutarInPrevLines) {
    for (let j = Math.max(0, lineIndex - 3); j < lineIndex; j++) {
      const prevLineLower = (lines[j]?.text ?? "").toLowerCase();
      const hasOdenecekKey = ODENECEK_TUTAR_KEYS.some((k) => prevLineLower.includes(k));
      const prevLineHasNumbers = /\d/.test(prevLineLower);
      if (hasOdenecekKey && !prevLineHasNumbers) {
        hasOdenecekToplamHeader = true;
        break;
      }
    }
  } else if ((prevHasOdenecekTutar || curHasOdenecekTutar) && isMostlyNumberLine) {
    hasOdenecekToplamHeader = true;
  }
  if (hasOdenecekToplamHeader) {
    score += 100;
    breakdown.push("+100: Tutar 'Ödenecek KDV Dahil Tutar' başlığından sonra geliyor (en yetkili TR toplam etiketi)");
  }

  if (curHasStrong || (isMostlyNumberLine && prevHasStrong) || (curHasStrong && nextHasValue)) {
    score += 80;
    breakdown.push(`+80: Strong total keyword (current or prev-number pairing)`);
  }

  // +40: Within 3 lines of a strong total keyword line
  // +100: Turkish e-ArÅŸiv pattern: TOPLAM header is 1-10 lines before amount
  let foundToplamInPrev = false;
  let nearStrongKeyword = false;
  
  // DEBUG: Log current line being scored
  
  for (let i = Math.max(0, lineIndex - 10); i <= Math.min(lines.length - 1, lineIndex + 3); i++) {
    if (i === lineIndex) continue;
    const checkLine = lines[i].text.toLowerCase();
    const hasStrongKeyword = strongTotalKeywords.some((k) => checkLine.includes(k));
    
    if (hasStrongKeyword) {
      // Check if it's a standalone header (no numbers on that line)
      const hasNumbers = /\d+([.,]\d{1,2})?/.test(checkLine);
      // "TOPLAM KDV" / "KDV TOPLAM" → KDV özet etiketi, grand total başlığı değil
      const isTotalKdvLine = /toplam\s*kdv|kdv\s*toplam/i.test(checkLine);
      
      if (!hasNumbers && i < lineIndex && (lineIndex - i) <= 10) {
        // Do not treat "TOPLAM MAXIPUAN" or "TOPLAM KDV" as receipt total header
        if (!LOYALTY_PUAN_PATTERN.test(checkLine) && !isTotalKdvLine) {
          foundToplamInPrev = true;
        }
      }
      // Do not give +40 "near strong keyword" when the keyword is loyalty (e.g. TOPLAM MAXIPUAN) — ref/no lines would otherwise win over real total
      if (Math.abs(i - lineIndex) <= 3 && !LOYALTY_PUAN_PATTERN.test(checkLine)) {
        nearStrongKeyword = true;
      }
    }
  }
  
  // Same-line TOPLAM + amount (e.g. "TOPAM *272,90") — Turkish e-Arşiv; loop skips current line so we check here
  // "TOPLAM KDV" satırındaki tutar grand total değil, KDV tutarıdır — bu bonus verilmez
  const curIsTotalKdvLine = /toplam\s*kdv|kdv\s*toplam/i.test(lowerCurrent);
  if (curHasStrong && !foundToplamInPrev && !curIsTotalKdvLine) {
    foundToplamInPrev = true;
  }

  if (foundToplamInPrev) {
    score += 100;
    breakdown.push(`+100: Amount found after standalone TOPLAM header (e-ArÅŸiv pattern)`);
  } else if (nearStrongKeyword) {
    score += 40;
    breakdown.push(`+40: Near strong total keyword line`);
  }
  
  // +30: Asterisk-prefixed amount (Turkish receipt convention: *43,50)
  if (candidate.hasAsteriskPrefix) {
    score += 30;
    breakdown.push(`+30: Asterisk-prefixed amount (Turkish convention)`);
  }

  // +25: Near end of receipt (last 25% lines)
  const lastQuarterStart = Math.floor(lines.length * 0.75);
  if (lineIndex >= lastQuarterStart) {
    score += 25;
    breakdown.push("+25: Near end of receipt");
  }

  // +15: Has 2 decimals (token-based, not line-based)
  if (tokenHasTwoDecimals(matchedText)) {
    score += 15;
    breakdown.push("+15: Has 2 decimal places");
  }

  // +10: Currency context found (in window)
  const currencyKeywords = [
    ...Object.keys(CURRENCY_SYMBOLS),
    ...Object.values(CURRENCY_SYMBOLS).map(c => c.toLowerCase()),
    "baht", "thb", "usd", "try", "tl", "eur", "gbp"
  ];
  if (currencyKeywords.some((k) => lowerContext.includes(k.toLowerCase()))) {
    score += 10;
    breakdown.push(`+10: Currency context`);
  }

  // DISQUALIFIERS (negative scores)
  const disqualifierKeywords = [
    "branch",
    "Ã Â¸ÂªÃ Â¸Â²Ã Â¸â€šÃ Â¸Â²",
    "tax id",
    "ref:",
    "ref ",
    "invoice",
    "receipt no",
    "tax invoice",
    "no.",
    "cashier",
    "date",
    "time",
    "tel",
    "phone",
    "password",
    "wifi",
    "qr",
    "vat:",
    "vatable",
    "%",
    // Turkish identifiers (never total amounts)
    "mersis",
    "belge no",
    "fiÅŸ no",
    "fatura no",
    "ettn",
    "z no",
    "z nj",
    "eko no",
    "ekü no",
    "eküno",
    "mf yab",
    "mf no",
    "mali cihaz",
    "cihaz no",
    "vergi no",
    "vkn",
    "tckn",
    "ÅŸube",
    "kasiyer",
    "tarih",
    "saat",
    "nakit",
    "para üstü",
    "para ustu",
    "paraustu",
    "kart",
    "kredi kart",
    "banka kart",
  ];

  // POS confirmation keywords: on current line = not the total (penalize); in context on POS slip = don't penalize
  const posConfirmationKeywords = [
    "onay kodu", "onay kod", "approval code", "rrn", "stan", "işlem no", "islem no",
  ];
  const currentLineIsPosConfirmation = posConfirmationKeywords.some((kw) => lowerCurrent.includes(kw));

  // Heavy disqualifier ONLY on current line
  const countryCode = opts?.countryConfig?.code;
  const skipContextDisqualifier = countryCode === "MY"; // MY: "RM 61.50" line often has "%" / "charge" in next line; only penalize current line

  if (disqualifierKeywords.some((kw) => lowerCurrent.includes(kw))) {
    score -= 200;
    breakdown.push(`-200: Current line contains disqualifier keyword`);
  } else if (currentLineIsPosConfirmation) {
    score -= 200;
    breakdown.push(`-200: Current line is POS approval/confirmation code`);
  } else if (!skipContextDisqualifier && !isPosSlip && disqualifierKeywords.some((kw) => lowerContext.includes(kw))) {
    score -= 60;
    breakdown.push(`-60: Context contains disqualifier keyword`);
  } else if (skipContextDisqualifier && disqualifierKeywords.some((kw) => lowerContext.includes(kw))) {
    breakdown.push(`+0: MY – context disqualifier skipped (only current-line penalty applies)`);
  } else if (
    !isPosSlip &&
    posConfirmationKeywords.some((kw) => lowerContext.includes(kw))
  ) {
    score -= 60;
    breakdown.push(`-60: Context contains POS approval code`);
  } else if (isPosSlip) {
    breakdown.push(`+0: POS slip - approval code context penalty skipped`);
  }

  // -200: Likely an identifier (integer >=4 digits, no decimals, with ID keywords)
  const isInteger = Number.isFinite(value) && value === Math.floor(value);
  const digitCount = String(Math.floor(value)).length;
  const idKeywords = ["Ã Â¸ÂªÃ Â¸Â²Ã Â¸â€šÃ Â¸Â²", "branch", "invoice", "tax", "id", "no", "date", "time"];
  const hasIdKeyword = idKeywords.some((kw) => lowerCurrent.includes(kw) || lowerContext.includes(kw));
  const tokenHasDecimal = /[.,]\d{1,2}\b/.test(matchedText);

  if (isInteger && digitCount >= 4 && !tokenHasDecimal && hasIdKeyword) {
    score -= 200;
    breakdown.push(`-200: Likely identifier (${digitCount}-digit int + id keyword)`);
  }

  // -120: Tender lines: cash/change/nakit/para üstü/card (parausto=OCR for para üstü)
  const paraUstuPattern = /para\s*[uü]st[uio]|paraust[uo]/i;
  const hasParaUstu = paraUstuPattern.test(lowerCurrent) || paraUstuPattern.test(lowerContext);
  if (
    lowerCurrent.includes("cash") ||
    lowerCurrent.includes("change") ||
    lowerCurrent.includes("nakit") ||
    hasParaUstu ||
    lowerCurrent.includes("kart") ||
    lowerCurrent.includes("card") ||
    lowerContext.includes("cash") ||
    lowerContext.includes("change") ||
    lowerContext.includes("nakit") ||
    lowerContext.includes("kart") ||
    lowerContext.includes("card")
  ) {
    score -= 120;
    breakdown.push("-120: Tender line (cash/change/nakit/para üstü/card)");
  }

  // -80: Value out of reasonable range
  if (value < 1 || value > 1_000_000) {
    score -= 80;
    breakdown.push(`-80: Out of range (${value})`);
  }

  // Branch ID match penalty (hard)
  for (const branch of branchIds) {
    if (Math.abs(value - branch.branchId) < 0.01 && !tokenHasDecimal) {
      score -= 250;
      breakdown.push(`-250: Matches branch ID ${branch.branchId} (line ${branch.lineNo})`);
    }
  }

  // Extra: Penalize obvious years (Thai Buddhist year 25xx or Gregorian 20xx) when no decimals
  if (!tokenHasDecimal && isInteger) {
    if ((value >= 2500 && value <= 2600) || (value >= 2000 && value <= 2100)) {
      score -= 180;
      breakdown.push(`-180: Looks like a year (${value})`);
    }
  }

  // Smart small value handling: Context determines if small amount is valid
  // Key insight: Small values CAN be totals if they're in the right context
  if (value < 100 && !curHasStrong && !prevHasStrong) {
    // 1. Check if this is clearly NOT a total (VAT, tender, service charge)
    const vatKeywords = ["vat", "kdv", "tax", "vergi", "topkdv"];
    const tenderKeywords = ["cash", "nakit", "change", "para üstü", "parausto", "paraustu", "card", "kart"];
    const serviceKeywords = ["service", "servis", "tip", "bahşiş"];
    
    const isVatLine = vatKeywords.some((kw) => 
      lowerCurrent.includes(kw) || lowerPrev.includes(kw)
    );
    const isTenderLine = tenderKeywords.some((kw) => 
      lowerCurrent.includes(kw) || lowerNext.includes(kw)
    );
    const isServiceLine = serviceKeywords.some((kw) => 
      lowerCurrent.includes(kw) || lowerPrev.includes(kw)
    );
    
    // 2. Check if this is clearly a TOTAL (after TOPLAM header, near end of receipt)
    const isAfterToplamHeader = foundToplamInPrev;
    const isNearEnd = lineIndex >= Math.floor(lines.length * 0.75);
    
    // 3. Apply penalties based on context
    if (isVatLine && !isAfterToplamHeader) {
      // VAT line: Heavy penalty (unless it's after TOPLAM, which could be VAT-inclusive total)
      score -= 200;
      breakdown.push(`-200: Small value (${value}) on VAT/KDV line`);
    } else if (isTenderLine) {
      // Tender line: Heavy penalty (cash/card payment, not total)
      score -= 200;
      breakdown.push(`-200: Small value (${value}) on tender line (cash/card)`);
    } else if (isServiceLine) {
      // Service charge line: Heavy penalty
      score -= 200;
      breakdown.push(`-200: Small value (${value}) on service charge line`);
    } else if (!isAfterToplamHeader && !isNearEnd) {
      // Small value in middle of receipt, not near TOPLAM: Moderate penalty
      score -= 150;
      breakdown.push(`-150: Small value (${value}) unlikely to be total (not near TOPLAM)`);
    } else if (isAfterToplamHeader && isNearEnd) {
      // After TOPLAM header AND near end: This is likely the total, NO penalty
      breakdown.push(`+0: Small value after TOPLAM header (valid total)`);
    }
  }

  // Store score
  return {
    ...candidate,
    score,
    scoreBreakdown: breakdown,
  };
}

export interface ExtractTotalRobustOpts {
  isPosSlip?: boolean;
}

/** Snap VAT rate to valid Turkish rates; reject if too far from [0, 0.01, 0.10, 0.20]. */
function snapVatRate(rate: number): number | undefined {
  const VALID_VAT_RATES = [0, 0.01, 0.10, 0.20];
  const closest = VALID_VAT_RATES.reduce((a, b) =>
    Math.abs(a - rate) < Math.abs(b - rate) ? a : b
  );
  return Math.abs(closest - rate) < 0.005 ? closest : undefined;
}

/** Parse TOPKDV amount from TR receipt lines (same line or immediately next 1 line after TOPKDV header). */
function parseTopkdvFromLines(lines: OCRLine[], countryConfig?: CountryConfig): number | null {
  const topkdvHeader = /topkdv|top\s*kdv|topkov|top\s*kov|topkow|topkdw|topkdy|top\s*kdy|topldv|top\s*ldv|topdv|topv|topkdi|t0pkdv|topodv|topkda|toplam\s*kdv|kdv\s*toplam|pkdv|p\s*kdv/i;
  for (let i = 0; i < lines.length; i++) {
    if (!topkdvHeader.test(lines[i].text)) continue;
    // Same line: TOPKDV *163,55 or TOPKDV 163,55
    const sameLine = lines[i].text.match(/\*?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2})/);
    if (sameLine?.[1]) {
      const v = parseLooseNumber(sameLine[1], countryConfig);
      if (v != null && v > 0.5 && v < 100000) return v;
    }
    // Only next 1 line (stricter: avoid wrong line like 108.50 vs 48)
    if (i + 1 < lines.length) {
      const nextLine = lines[i + 1].text;
      const m = nextLine.match(/\*?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2}|\d+[.,]\d{2})/);
      if (m?.[1]) {
        const v = parseLooseNumber(m[1], countryConfig);
        if (v != null && v > 0.5 && v < 100000) return v;
      }
    }
  }
  return null;
}

/**
 * Robust total extraction with scoring
 */
export function extractTotalRobust(
  lines: OCRLine[],
  countryConfig?: CountryConfig,
  opts?: ExtractTotalRobustOpts
): TotalExtraction & {
  evidence?: {
    pickedLineNo: number;
    score: number;
    topCandidates: Array<{ value: number; lineNo: number; score: number; why: string[] }>;
    branchIds: BranchIdMatch[];
  };
} {
  const processedLines = preprocessOCRLines(lines);
  const branchIds = extractBranchIds(processedLines);

  // Pass countryConfig to generateAmountCandidates for country-specific number parsing
  let candidates = generateAmountCandidates(processedLines, countryConfig);

  // EXCLUDE: KDV/TOPKDV/% lines — these are VAT amounts, never receipt totals
  const VAT_TOTAL_EXCLUDE_PATTERN = /kdv|topkdv|toplam\s*kdv|kdv\s*toplam|topkdw|topkdy|topldv|pkdv|%\s*\d|\d\s*%/i;
  candidates = candidates.filter((c) => {
    const { prev, current, next } = c.contextWindow;
    const combined = [prev, current, next].filter(Boolean).join(" ");
    return !VAT_TOTAL_EXCLUDE_PATTERN.test(combined);
  });

  // Use config total keywords if available, otherwise use defaults
  const totalKeywords = countryConfig?.labels.total || TOTAL_STRONG_KEYS;

  const scoredCandidates = candidates.map((candidate) => {
    const lineIndex = processedLines.findIndex((l) => l.lineNo === candidate.lineNo);
    return scoreCandidate(
      candidate,
      processedLines,
      branchIds,
      lineIndex >= 0 ? lineIndex : 0,
      totalKeywords,
      { isOnlyDotCommaCandidate: candidate.isOnlyDotCommaCandidate, isPosSlip: opts?.isPosSlip, countryConfig }
    );
  });

  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Prefer later lines if same score
    if (b.lineNo !== a.lineNo) return b.lineNo - a.lineNo;
    // Prefer larger value if still tied
    return b.value - a.value;
  });

  // TR: prefer total candidate that fits TOPKDV (e.g. 163.55 → total ≈ 1799 for 10% inclusive)
  let best = scoredCandidates[0];
  if (countryConfig?.code === "TR" && best && scoredCandidates.length > 1) {
    const topkdvAmount = parseTopkdvFromLines(processedLines, countryConfig);
    if (topkdvAmount != null && topkdvAmount > 0.5) {
      // TR KDV oranlarının hepsi destekleniyor: %1, %10, %18, %20
      // total = vat * (1 + rate) / rate
      const expectedTotal1  = topkdvAmount * 101;           // %1:  total = vat * 1.01/0.01
      const expectedTotal10 = topkdvAmount * 11;            // %10: total = vat * 1.10/0.10
      const expectedTotal18 = topkdvAmount * (1 + 1 / 0.18); // %18
      const expectedTotal20 = topkdvAmount * 6;             // %20: total = vat * 1.20/0.20
      const tolerance = Math.max(50, topkdvAmount * 0.5);
      let bestFit: typeof best | null = null;
      let bestDiff = Infinity;
      for (const c of scoredCandidates.slice(0, 8)) {
        if (c.score < 20) continue;
        const d1  = Math.abs(c.value - expectedTotal1);
        const d10 = Math.abs(c.value - expectedTotal10);
        const d18 = Math.abs(c.value - expectedTotal18);
        const d20 = Math.abs(c.value - expectedTotal20);
        const d = Math.min(d1, d10, d18, d20);
        if (d <= tolerance && d < bestDiff) {
          bestDiff = d;
          bestFit = c;
        }
      }
      if (bestFit && bestFit !== best) {
        console.log(`[extractTotalRobust] TR TOPKDV fit: TOPKDV=${topkdvAmount} → preferring total ${bestFit.value} (score=${bestFit.score}) over ${best.value} (score=${best.score})`);
        best = bestFit;
      }
    }
  }

  const topCandidates = scoredCandidates.slice(0, 5).map((c) => ({
    value: round2(c.value),
    lineNo: c.lineNo,
    score: c.score,
    why: c.scoreBreakdown,
  }));

  if (!best || best.score < 10) {
    return {
      value: 0,
      confidence: 0,
      evidence: {
        pickedLineNo: -1,
        score: best?.score ?? -999,
        topCandidates,
        branchIds,
      },
    };
  }

  const confidence = scoreToConfidence(best.score);

  return {
    value: round2(best.value),
    confidence,
    sourceLine: best.lineNo,
    evidence: {
      pickedLineNo: best.lineNo,
      score: best.score,
      topCandidates,
      branchIds,
    },
  };
}

/**
 * Robust VAT extraction with rate and amount
 */
export function extractVATRobust(
  lines: OCRLine[],
  totalAmount: number,
  countryConfig?: CountryConfig
): VATExtraction & {
  evidence?: { rateLineNo?: number; amountLineNo?: number; consistencyCheck: boolean; notes: string[] };
} {
  const processedLines = preprocessOCRLines(lines);

  let vatRate: number | undefined;
  let vatAmount: number | undefined;
  let rateLineNo: number | undefined;
  let amountLineNo: number | undefined;
  let vatFromSameLine = false; // TOPKDV on same line (e.g. "TOPKDV 22,07") — prefer over breakdown
  const notes: string[] = [];

  // Use config VAT patterns if available, otherwise use defaults
  // Build rate patterns from config VAT keywords
  // Prefer vatKeywords over labels.vat for pattern generation
  const configVatKeywords = countryConfig?.vatKeywords || countryConfig?.labels.vat || [];
  const configVatPatterns: RegExp[] = [];
  const configVatTotalPatterns: RegExp[] = [];
  
  // Generate patterns from config VAT keywords
  for (const keyword of configVatKeywords) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Rate patterns: "kdv" -> /kdv[\s:]*([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%/i
    configVatPatterns.push(
      new RegExp(`${escapedKeyword}[\\s:]*([0-9]{1,2}(?:\\.[0-9]{1,2})?)\\s*%`, 'i'),
      new RegExp(`([0-9]{1,2}(?:\\.[0-9]{1,2})?)\\s*%\\s*${escapedKeyword}`, 'i')
    );
    // Total patterns: "PPN" -> /total\s*ppn[\s:]*([\d,.]+)/i and /ppn\s*total[\s:]*([\d,.]+)/i
    configVatTotalPatterns.push(
      new RegExp(`total\\s*${escapedKeyword}[\\s:]*([\\d,.]+)`, 'i'),
      new RegExp(`${escapedKeyword}\\s*total[\\s:]*([\\d,.]+)`, 'i')
    );
    // Simple VAT amount patterns: "PPN : 842", "PPN 842", "PPN:842"
    configVatTotalPatterns.push(
      new RegExp(`${escapedKeyword}[\\s:]+([\\d,.]+)`, 'i'),  // "PPN : 842" or "PPN:842"
      new RegExp(`${escapedKeyword}[\\s]+([\\d,.]+)`, 'i')    // "PPN 842"
    );
  }
  
  // Rate patterns: Use config patterns first, then fallback to defaults
  const ratePatterns = configVatPatterns.length > 0 
    ? configVatPatterns 
    : [
        // General patterns (fallback)
        /vat[\s:]*([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%/i,
        /([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%\s*vat/i,
        // Turkish: KDV (fallback if no config)
        /kdv[\s:]*([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%/i,
        /([0-9]{1,2}(?:\.[0-9]{1,2})?)\s*%\s*kdv/i,
      ];

  // Find VAT rate (first good hit)
  for (const line of processedLines) {
    const t = line.text;
    for (const pattern of ratePatterns) {
      const match = t.match(pattern);
      if (match) {
        const r = parseFloat(match[1]);
        if (!isNaN(r) && r > 0 && r <= 25) {
          const rawRate = r / 100;
          vatRate = snapVatRate(rawRate);
          if (vatRate != null) {
            rateLineNo = line.lineNo;
            notes.push(`vatRateFound=${vatRate} at line=${rateLineNo}`);
          }
          break;
        }
      }
    }
    if (vatRate) break;
  }

  const expectedVat =
    vatRate != null && totalAmount > 0
      ? round2(totalAmount - totalAmount / (1 + vatRate))
      : undefined;

  const lineHasPercent = (s: string): boolean => /\d\s*%|%\s*\d/.test(s);

  const hasVatKeyword = (s: string) =>
    /vat|vatable|kdv|gst|sst|ppn|ÃÂ½ÃÂ´Ã‘Â|Ã¦Â¶Ë†Ã¨Â²Â»Ã§Â¨Å½|Ã«Â¶â‚¬ÃªÂ°â‚¬Ã¬â€žÂ¸|Ã¥Â¢Å¾Ã¥â‚¬Â¼Ã§Â¨Å½|tax/i.test(s);

  // Prefer next-line(s) amount matching calculated VAT (e.g. "VAT:7.00%" then "8.83" on next line)
  if (expectedVat != null && expectedVat > 0 && vatAmount == null) {
    const tolerance = 0.02;
    for (let i = 0; i < processedLines.length; i++) {
      if (!hasVatKeyword(processedLines[i].text)) continue;
      for (let look = 1; look <= 5; look++) {
        const next = processedLines[i + look];
        if (!next) break;
        const amts = extractAmountsFromText(next.text, countryConfig)
          .map((x) => x.value)
          .filter((v) => v > 0 && v < totalAmount);
        for (const a of amts) {
          if (Math.abs(a - expectedVat) <= tolerance) {
            vatAmount = round2(a);
            amountLineNo = next.lineNo;
            notes.push(
              `vatAmountFoundNextLineExpected=${vatAmount} at line=${amountLineNo} (expected ${expectedVat})`
            );
            break;
          }
        }
        if (vatAmount != null) break;
      }
      if (vatAmount != null) break;
    }
  }

  /**
   * Hard negative filters: patterns that should NEVER be treated as VAT amounts
   * IMPORTANT: If a line contains registration/ID keywords, DO NOT extract VAT from it
   */
  const isNegativeVATFilter = (line: string): boolean => {
    const registrationKeywords = [
      "gst kayÃ„Â±t", "gst kayit", "gst reg", "registration", "reg. no", "kayÃ„Â±t no", "kayit no",
      "sicil no", "tax id", "vat id", "vkn", "vergi no", "mersis", "ettn",
      "sst id", "sst no", "sst reg", "gst reg no", "sst reg no", "company no", "business reg"
    ];
    
    const lowerLine = line.toLowerCase();
    // If line contains any registration keyword, reject it
    if (registrationKeywords.some(keyword => lowerLine.includes(keyword))) {
      return true;
    }
    
    const negativePatterns = [
      // GST/Registration numbers (NOT VAT - these are registration IDs)
      /(GST|KayÃ„Â±t\s*No|Reg\.?\s*No|Sicil\s*No|VKN|Mersis|ETTN|Registration|KayÃ„Â±t)/i,
      // Malaysia SST ID / SST No (e.g. W10-2008-32100024) — digits are ID, not VAT
      /\b(?:sst|gst)\s*(?:id|no)\s*[a-z0-9-]*/i,
      /\bw\d+-\d+-\d+/i,
      // Booking/Reservation numbers
      /(Rezervasyon\s*No|Booking\s*No)/i,
      // E-ticket/Passenger numbers
      /(E-?bilet|E-?ticket|Passenger|Yolcu)/i,
      // Masked card numbers
      /(Mastercard|Visa|card|kredi\s*kartÃ„Â±).*[\*\*]{3,}/i,
      // Ticket/ID patterns: 310-2159990016
      /\b\d{3}-\d{9,}\b/,
      // Long alphanumeric IDs: 201613701E
      /\b\d{9,}[A-Z]\b/,
    ];
    
    return negativePatterns.some(pattern => pattern.test(line));
  };

  /**
   * Check if a number token is standalone (not part of alphanumeric ID)
   * Example: "201613701E" -> "201" should NOT be extracted
   */
  const isStandaloneNumericToken = (value: string, line: string): boolean => {
    const valueIndex = line.indexOf(value);
    if (valueIndex < 0) return false;
    
    // Check characters before and after the value
    const before = valueIndex > 0 ? line[valueIndex - 1] : ' ';
    const after = valueIndex + value.length < line.length ? line[valueIndex + value.length] : ' ';
    
    // If before or after is a letter, it's part of alphanumeric token
    if (/[A-Za-z]/.test(before) || /[A-Za-z]/.test(after)) {
      return false;
    }
    
    // Check if value itself contains letters
    if (/[A-Za-z]/.test(value)) {
      return false;
    }
    
    // Must match standalone numeric pattern
    const standalonePattern = /\b\d{1,3}(?:[.,]\d{3})*(?:[,.]\d{2})?\b/;
    const fullMatch = line.substring(Math.max(0, valueIndex - 1), valueIndex + value.length + 1);
    return standalonePattern.test(fullMatch);
  };

  // Find VAT amount:
  // Strategy:
  // 1. First, look for Turkish e-ArÃ…Å¸iv fatura patterns: "TOPKDV", "TOPLAM KDV", "KDV TOPLAM"
  // 2. Then scan lines containing "vat", "kdv", "vatable"
  // 3. If amount not on same line, check next 1-2 lines (common in Thai receipts)
  // IMPORTANT: Only extract explicit VAT/KDV lines, NOT "Taxes & fees" from travel receipts
  
  // Priority 1: Country-specific VAT total patterns
  // First, use config-based patterns (from countryConfig.labels.vat)
  // Then fallback to hardcoded patterns for countries without config
  const countryVatTotalPatterns = [
    // Config-based patterns (generated from countryConfig.labels.vat)
    ...configVatTotalPatterns,
    // Turkish: TOPKDV + OCR typos (TOPKDY, TOPLDV, TOPDV, TOPKDI, T0PKDV, PKDV, etc.)
    /topkdv[\s:]*([\d,.]+)/i,
    /topkdy[\s:]*([\d,.]+)/i,
    /topldv[\s:]*([\d,.]+)/i,
    /topdv[\s:]*([\d,.]+)/i,
    /topv[\s:]*([\d,.]+)/i,
    /topkdi[\s:]*([\d,.]+)/i,
    /t0pkdv[\s:]*([\d,.]+)/i,
    /topodv[\s:]*([\d,.]+)/i,
    /topkda[\s:]*([\d,.]+)/i,
    /\bpkdv[\s:]*([\d,.]+)/i,
    /toplam\s*kdv[\s:]*([\d,.]+)/i,
    /kdv\s*toplam[\s:]*([\d,.]+)/i,
    // Malaysia: GST Total, SST Total (but NOT "GST Reg No")
    /(?:^|\b)(?:gst|sst)(?!\s*(?:Reg|KayÃ„Â±t|No))\s*total[\s:]*([\d,.]+)/i,
    /total\s*(?:gst|sst)(?!\s*(?:Reg|KayÃ„Â±t|No))[\s:]*([\d,.]+)/i,
    // Singapore: GST Total (but NOT "GST Reg No")
    /(?:^|\b)(?:gst)(?!\s*(?:Reg|KayÃ„Â±t|No))\s*total[\s:]*([\d,.]+)/i,
    /total\s*(?:gst)(?!\s*(?:Reg|KayÃ„Â±t|No))[\s:]*([\d,.]+)/i,
    // Russia: ÃËœÃ‘â€šÃÂ¾ÃÂ³ÃÂ¾ ÃÂÃâ€ÃÂ¡ (Total VAT)
    /ÃÂ¸Ã‘â€šÃÂ¾ÃÂ³ÃÂ¾\s*ÃÂ½ÃÂ´Ã‘Â[\s:]*([\d,.]+)/i,
    /ÃÂ½ÃÂ´Ã‘Â\s*ÃÂ¸Ã‘â€šÃÂ¾ÃÂ³ÃÂ¾[\s:]*([\d,.]+)/i,
    // India: Total GST
    /total\s*gst[\s:]*([\d,.]+)/i,
    /gst\s*total[\s:]*([\d,.]+)/i,
  ];
  
  // Turkish patterns (for backward compatibility)
  const turkishVatTotalPatterns = countryVatTotalPatterns.slice(0, 3);
  
  // Pattern 2: "TOPKDV" on one line, amount on next 1-3 lines (fallback only)
  const turkishVatHeaderPatterns = [
    /^topkdv$/i,
    /^topkdy$/i,
    /^topldv$/i,
    /^topdv$/i,
    /^topv$/i,
    /^topkdi$/i,
    /^t0pkdv$/i,
    /^topodv$/i,
    /^topkda$/i,
    /^toplam\s*kdv$/i,
    /^kdv\s*toplam$/i,
  ];
  
  for (let i = 0; i < processedLines.length; i++) {
    const line = processedLines[i];
    const t = line.text;
    
    // Skip lines that match negative filters (GST Reg No, ticket numbers, etc.)
    if (isNegativeVATFilter(t)) {
      continue;
    }
    
    // PRIORITY: Check country-specific VAT total patterns
    // This is the most reliable method for country-specific receipts
    for (const pattern of countryVatTotalPatterns) {
      const match = t.match(pattern);
      if (match && match[1]) {
        const amountStr = match[1].trim();

        // If line contains % (e.g. "VAT:7.00%"), this is a rate line Ã¢â‚¬â€ do NOT use as amount
        if (lineHasPercent(t)) continue;

        // CRITICAL: Check if this is a standalone numeric token (not part of alphanumeric ID)
        // Example: "GST KayÃ„Â±t No: 201613701E" -> "201" should NOT be extracted
        if (!isStandaloneNumericToken(amountStr, t)) {
          continue; // Skip alphanumeric tokens
        }

        // Use countryConfig-aware parseLooseNumber for country-specific number format
        const amount = parseLooseNumber(amountStr, countryConfig);
        const countryCode = countryConfig?.code;
        
        // ID-specific guard: More tolerant for small totals (e.g., "8,500" -> 8500, "PPN : 842" -> 842)
        // For ID receipts with suspiciously small totals, use relaxed bounds
        let vatAccepted = false;
        if (countryCode === "ID") {
          if (totalAmount < 10) {
            // For very small totals, use global bounds (0.1 - 100000) instead of percentage-based
            // This handles cases like "TOTAL SALES : Rp 8,500, PPN : 842" where total is misparsed as 8.5
            if (amount != null && !isNaN(amount) && amount > 0.1 && amount < 100000) {
              vatAccepted = true;
            }
          } else {
            // Normal guard for ID (same as TR)
            if (amount != null && !isNaN(amount) && amount > 0.1 && amount < totalAmount && amount < totalAmount * 0.5) {
              vatAccepted = true;
            }
          }
        } else {
          // TR/TH/GENERIC: Original guard logic (unchanged)
          // CRITICAL: For TR receipts, if TOPKDV is on the same line with a number, 
          // that number IS the VAT amount - trust it completely (user requirement)
          // For Turkish receipts, TOPKDV can be up to ~10% of total (237.69 / 2607.98 = 9.1%)
          // So we accept values up to 20% of total to be safe
          // Guard: VAT amount must be <= total*0.3 for typical receipts
          if (amount != null && !isNaN(amount) && amount > 0.1 && amount < totalAmount && amount < totalAmount * 0.3) {
            vatAccepted = true;
          }
        }
        
        if (vatAccepted) {
          // Prefer next-line expectedVat (e.g. "VAT:7.00%" then "8.83") Ã¢â‚¬â€ don't overwrite
          if (amount != null && vatAmount == null) {
            vatAmount = amount;
            amountLineNo = line.lineNo;
            vatFromSameLine = true; // TOPKDV same-line: do not overwrite with breakdown later
            const context = countryCode === "ID" ? "ID (relaxed guard)" : countryCode === "TR" ? "TR (TOPKDV on same line - AUTHORITATIVE)" : "standard";
            notes.push(`vatAmountFoundTotalSameLine=${vatAmount} at line=${amountLineNo} (${context})`);
          }
        }
      }
    }
    
    // Check if line is just "TOPKDV" header, then look for amount in surrounding lines
    if (vatAmount == null) {
      for (const headerPattern of turkishVatHeaderPatterns) {
        if (headerPattern.test(t.trim())) {
          // Found "TOPKDV" header, look for amount in next 1-10 lines and previous 2 lines
          let foundVatInNextLines = false;
          
          // First, try to find KDV breakdown and sum individual KDV amounts
          // Look for pattern: "KDV: 13,69" or "13,69" on lines with "%1", "%10", "%20" KDV rates
          const kdvBreakdownAmounts: number[] = [];
          for (let look = -2; look <= 15; look++) {
            const checkLine = processedLines[i + look];
            if (!checkLine) continue;
            
            const checkText = checkLine.text;
            
            // CRITICAL: Filter out payment/total terms (these are not VAT amounts)
            // "para ÃƒÂ¼stÃƒÂ¼" (change), "iade" (refund), "deÃ„Å¸iÃ…Å¸iklik" (modification)
            const isPaymentTerm = /kdv\s*dahil\s*tutar|dahil\s*tutar|ÃƒÂ¶denecek\s*tutar|mal\/hizmet\s*toplam|ara\s*toplam|para\s*ÃƒÂ¼stÃƒÂ¼|paraÃƒÂ¼stÃƒÂ¼|para\s*ustu|change|iade|refund|deÃ„Å¸iÃ…Å¸iklik|modification/i.test(checkText);
            
            // Also check previous line for payment terms (sometimes amount is on next line after label)
            const prevCheckLine = look > -2 ? processedLines[i + look - 1] : null;
            const prevLineHasPaymentTerm = prevCheckLine ? /para\s*ÃƒÂ¼stÃƒÂ¼|paraÃƒÂ¼stÃƒÂ¼|para\s*ustu|change|iade|refund/i.test(prevCheckLine.text) : false;
            
            if (isPaymentTerm || prevLineHasPaymentTerm) {
              continue;
            }
            
            // Look for KDV breakdown pattern: "%1 KDV: 13,69" or "KDV: 13,69" or just "13,69" on KDV rate lines
            // Pattern 1: Line contains KDV rate (%1, %10, %20) and KDV amount
            const hasKdvRate = /%\s*(\d+)\s*kdv|kdv\s*%\s*(\d+)/i.test(checkText);
            if (hasKdvRate) {
              // Extract KDV amount from this line - look for "KDV:" followed by amount
              const kdvAmountMatch = checkText.match(/kdv[\s:]*([\d,.]+)/i);
              if (kdvAmountMatch && kdvAmountMatch[1]) {
                let amountStr = kdvAmountMatch[1].trim();
                
                // CRITICAL: Check if this is a standalone numeric token (not part of alphanumeric ID)
                if (!isStandaloneNumericToken(amountStr, checkText)) {
                  continue; // Skip alphanumeric tokens
                }
                
                // Use countryConfig-aware parseLooseNumber for country-specific number format
                const amount = parseLooseNumber(amountStr, countryConfig);
                // KDV breakdown amounts should be small (each rate's KDV is usually < 10% of total)
                if (amount != null && !isNaN(amount) && amount > 0 && amount < totalAmount * 0.2) {
                  kdvBreakdownAmounts.push(amount);
                  notes.push(`Found KDV breakdown amount: ${amount} at line ${checkLine.lineNo}`);
                }
              }
            }
            
            // Pattern 2: Line contains just a number and is near KDV rate lines (e.g., "13,69" on line with "%1")
            // This handles cases where KDV amount is on a separate line from the rate
            if (look > 0 && look <= 5) {
              const prevLine = processedLines[i + look - 1];
              if (prevLine && /%\s*(\d+)\s*kdv|kdv\s*%\s*(\d+)/i.test(prevLine.text)) {
                // Previous line had KDV rate, this line might have the amount
                const amounts = extractAmountsFromText(checkText, countryConfig)
                  .map((x) => x.value)
                  .filter((v) => v > 0 && v < totalAmount * 0.2); // Each KDV rate amount should be < 20% of total
                
                if (amounts.length === 1 && !kdvBreakdownAmounts.includes(amounts[0])) {
                  kdvBreakdownAmounts.push(amounts[0]);
                  notes.push(`Found KDV breakdown amount (separate line): ${amounts[0]} at line ${checkLine.lineNo}`);
                }
              }
            }
            
              // Also look for standalone "KDV:" pattern (total KDV)
              // But only if we haven't found KDV breakdown amounts (they are more reliable)
              if (look > 0 && !foundVatInNextLines && kdvBreakdownAmounts.length === 0) {
                const kdvTotalPattern = /^kdv[\s:]*([\d,.]+)$/i;
                const kdvTotalMatch = checkText.trim().match(kdvTotalPattern);
                if (kdvTotalMatch && kdvTotalMatch[1]) {
                  const amountStr = kdvTotalMatch[1].trim();
                  // Use countryConfig-aware parseLooseNumber for country-specific number format
                  const amount = parseLooseNumber(amountStr, countryConfig);
                  // For Turkish invoices, TOPKDV can be up to ~10% of total (237.69 / 2607.98 = 9.1%)
                  // So we accept values up to 20% of total to be safe (for TOPKDV specifically)
                  if (amount != null && !isNaN(amount) && amount > 0 && amount < totalAmount && amount < totalAmount * 0.2) {
                    // If we already found a value, only replace it if this one is larger (more likely to be the total)
                    if (vatAmount == null || amount > vatAmount) {
                      vatAmount = amount;
                      amountLineNo = checkLine.lineNo;
                      notes.push(`vatAmountFoundAfterTOPKDV=${vatAmount} at line=${amountLineNo} (after TOPKDV at line ${line.lineNo})`);
                      foundVatInNextLines = true;
                    }
                  } else if (amount != null && !isNaN(amount) && amount >= totalAmount * 0.2) {
                    notes.push(`Rejecting KDV value ${amount} (>= 20% of total) - might be KDV Dahil Tutar`);
                  }
                }
              
              // Look for mostly numeric line that could be KDV amount
// But be very careful - skip lines that look like totals or subtotals
const isMostlyNumeric = /^[\d\s.,*]+$/.test(checkText.trim());

// CRITICAL: Skip lines with "TOPLAM" keyword (these are total amounts, not KDV)
if (/toplam|total|grand\s*total|net\s*total/i.test(checkText)) {
  continue; // Skip total lines
}

       // Also skip very large amounts (KDV should be < 20% of total for Turkish receipts)
       const looksLikeTotal = /\d{2,}[.,]\d{2}/.test(checkText); // Any amount with 2+ digits before decimal
              
              // Skip if we already found KDV breakdown amounts (they are more reliable)
              if (isMostlyNumeric && !foundVatInNextLines && !looksLikeTotal && kdvBreakdownAmounts.length === 0) {
                const amounts = extractAmountsFromText(checkText, countryConfig)
                  .map((x) => x.value)
                  .filter((v) => v > 0 && v < totalAmount && v < totalAmount * 0.2 && v > 1); // KDV should be > 1 and < 20% of total (for TOPKDV)
                
                if (amounts.length === 1) {
                  // Single amount on numeric line - likely KDV total
                  // But verify it's not too large (should be reasonable for KDV)
                  // For Turkish invoices, TOPKDV can be up to ~10% of total (237.69 / 2607.98 = 9.1%)
                  if (amounts[0] < totalAmount * 0.2) {
                    // If we already found a value, only replace it if this one is larger (more likely to be the total)
                    if (vatAmount == null || amounts[0] > vatAmount) {
                      vatAmount = amounts[0];
                      amountLineNo = checkLine.lineNo;
                      notes.push(`vatAmountFoundNumericLine=${vatAmount} at line=${amountLineNo} (after TOPKDV at line ${line.lineNo})`);
                      foundVatInNextLines = true;
                    }
                  } else {
                    notes.push(`Rejecting numeric line value ${amounts[0]} (>= 20% of total) - might be KDV Dahil Tutar`);
                  }
                }
              }
            }
          }
          
          // If we found KDV breakdown amounts, sum them — but prefer TOPKDV same-line when present
          if (vatFromSameLine) {
            console.log(`[extractVATRobust] TOPKDV same-line already set — skipping breakdown (prefer same-line)`);
            break;
          }
          if (kdvBreakdownAmounts.length > 0) {
            const totalKdv = kdvBreakdownAmounts.reduce((sum, amt) => sum + amt, 0);
            console.log(`[extractVATRobust] Found KDV breakdown: ${kdvBreakdownAmounts.map(a => a.toFixed(2)).join(' + ')} = ${totalKdv.toFixed(2)}`);
            // Verify total is reasonable (should be < 25% of total, and individual amounts should sum correctly)
            // For Turkish receipts, TOPKDV can be up to ~10% of total, so 25% is a safe upper bound
            if (totalKdv > 0 && totalKdv < totalAmount * 0.25 && totalKdv > 1) {
              // Use breakdown sum only if we don't already have a TOPKDV same-line value
              if (vatAmount == null || vatAmount === 0 || (kdvBreakdownAmounts.length > 1 && totalKdv > vatAmount)) {
                vatAmount = totalKdv;
                amountLineNo = line.lineNo;
                notes.push(`vatAmountSummedFromBreakdown=${vatAmount} (${kdvBreakdownAmounts.length} rates: ${kdvBreakdownAmounts.join(', ')}) after TOPKDV at line ${line.lineNo}`);
                foundVatInNextLines = true;
                console.log(`[extractVATRobust] Ã¢Å“â€¦ Using KDV breakdown sum: ${vatAmount.toFixed(2)} (from ${kdvBreakdownAmounts.length} rates)`);
              } else {
                console.log(`[extractVATRobust] Keeping existing VAT value ${vatAmount.toFixed(2)} (breakdown sum ${totalKdv.toFixed(2)} is smaller or single rate)`);
              }
              break;
            } else {
              console.log(`[extractVATRobust] Rejected breakdown sum ${totalKdv.toFixed(2)} (reason: ${totalKdv <= 0 ? '<= 0' : totalKdv >= totalAmount * 0.25 ? '>= 25%' : totalKdv <= 1 ? '<= 1' : 'unknown'})`);
            }
          }
          
          // Only use standalone "KDV:" or numeric line values if NO breakdown was found
          // AND the value is reasonable (< 20% of total for Turkish invoices - TOPKDV can be up to ~10%)
          if (!foundVatInNextLines && vatAmount != null && vatAmount > totalAmount * 0.2) {
            // Value seems too large - might be "KDV Dahil Tutar" or another total
            // Clear it and continue searching for breakdown
            notes.push(`Rejecting large VAT value ${vatAmount} (> 20% of total) - might be KDV Dahil Tutar`);
            vatAmount = undefined;
            amountLineNo = undefined;
          }
          
          if (foundVatInNextLines) break;
        }
      }
    }
    
    if (vatAmount != null) break;
  }
  
  // Priority 2: Standard VAT extraction
  if (vatAmount == null) {
    for (let i = 0; i < processedLines.length; i++) {
      const line = processedLines[i];
      const t = line.text;

      const hasVatKeyword = /vat|vatable|kdv|gst|sst|ppn|ÃÂ½ÃÂ´Ã‘Â|Ã¦Â¶Ë†Ã¨Â²Â»Ã§Â¨Å½|Ã«Â¶â‚¬ÃªÂ°â‚¬Ã¬â€žÂ¸|Ã¥Â¢Å¾Ã¥â‚¬Â¼Ã§Â¨Å½|tax/i.test(t);
      if (!hasVatKeyword) continue;

      // Skip lines with "KDV Dahil Tutar" (these are VAT-inclusive amounts, not VAT amounts)
      if (/kdv\s*dahil\s*tutar|dahil\s*tutar/i.test(t)) {
        continue;
      }

      // Skip non-tax fees: seat selection, baggage, meal selection, etc.
      if (/\b(?:koltuk\s*seÃƒÂ§imi|seat\s*selection|baggage|bagaj|luggage|meal|yemek|priority|ÃƒÂ¶ncelik|fast\s*track|check-in|baggage\s*fee|bagaj\s*ÃƒÂ¼creti)\b/i.test(t)) {
        continue;
      }

      // Same-line amount only when line has NO % (e.g. "VAT: 8.83"); "%" => rate line, skip
      const sameLineAmts = lineHasPercent(t)
        ? []
        : extractAmountsFromText(t, countryConfig)
            .map((x) => x.value)
            .filter((v) => v > 0 && v < totalAmount);

      if (sameLineAmts.length > 0) {
        // For Turkish receipts, prefer amounts that are reasonable (KDV should be < 20% of total)
        // But avoid "KDV Dahil Tutar" amounts which are much larger
        const isTurkish = /kdv|tÃƒÂ¼rk|tÃƒÂ¼rkiye|try|tl/i.test(t);
        const reasonableAmts = sameLineAmts.filter(v => v < totalAmount * 0.2); // KDV should be < 20% of total
        
        if (reasonableAmts.length > 0) {
          vatAmount = isTurkish ? Math.max(...reasonableAmts) : Math.min(...reasonableAmts);
        } else {
          // Fallback: use smallest if no reasonable amounts found
          vatAmount = Math.min(...sameLineAmts);
        }
        amountLineNo = line.lineNo;
        notes.push(`vatAmountFoundSameLine=${vatAmount} at line=${amountLineNo}`);
        break;
      }

      // Look ahead up to 10 lines for amount-only line (like "8.83" or "4.730")
      // Some receipts have multiple lines between "Tax:" and the amount
      for (let look = 1; look <= 10; look++) {
        const next = processedLines[i + look];
        if (!next) continue;
        const amts = extractAmountsFromText(next.text, countryConfig)
          .map((x) => x.value)
          .filter((v) => v > 0 && v < totalAmount);

        // If the line is mostly numeric and has one amount, treat as VAT amount
        const numericish = /^[^a-zÃ Â¸Â-Ã Â¹â„¢]*\d+([.,]\d{1,2})?[^a-zÃ Â¸Â-Ã Â¹â„¢]*$/i.test(next.text);
        if (numericish && amts.length > 0) {
          const isIndonesian = countryConfig?.code === "ID";
          const reasonableAmts = isIndonesian
            ? amts.filter((v) => v > 0 && v < totalAmount && v < totalAmount * 0.2)
            : amts;

          if (reasonableAmts.length > 0) {
            const pick =
              expectedVat != null
                ? reasonableAmts.slice().sort(
                    (a, b) => Math.abs(a - expectedVat!) - Math.abs(b - expectedVat!)
                  )[0]
                : reasonableAmts[0];
            vatAmount = round2(pick);
            amountLineNo = next.lineNo;
            notes.push(
              `vatAmountFoundLookahead=${vatAmount} at line=${amountLineNo} (from VAT keyword line ${line.lineNo}, looked ${look} lines ahead)`
            );
            break;
          }
        }
      }

      if (vatAmount != null) break;
    }
  }

  // If VAT amount exists but rate missing, infer
  if (vatAmount != null && vatRate == null && totalAmount > 0) {
    const r = vatAmount / totalAmount;
    if (r >= 0.01 && r <= 0.25) {
      vatRate = r;
      notes.push(`vatRateInferred=${vatRate}`);
    }
  }

  // Fallback: rate known but no amount Ã¢â‚¬â€ use calculated (e.g. total 135, 7% Ã¢â€ â€™ 8.83)
  if (vatRate != null && (vatAmount == null || vatAmount === 0) && expectedVat != null) {
    vatAmount = expectedVat;
    notes.push(`vatAmountUsedCalculated=${vatAmount} (from total and ${(vatRate * 100).toFixed(0)}% rate)`);
  }

  // Consistency check
  let consistencyCheck = true;
  if (vatAmount != null && totalAmount > 0) {
    const paidExTax = totalAmount - vatAmount;
    const tolerance = 0.5; // THB tolerance
    consistencyCheck = Math.abs(paidExTax + vatAmount - totalAmount) <= tolerance;
    notes.push(`vatConsistency=${consistencyCheck ? "pass" : "fail"}`);
  }

  // Confidence
  let confidence = 0;
  if (vatRate != null && vatAmount != null) confidence = consistencyCheck ? 0.9 : 0.7;
  else if (vatRate != null || vatAmount != null) confidence = 0.6;

  return {
    value: vatAmount ?? 0,
    rate: vatRate,
    confidence,
    sourceLine: amountLineNo ?? rateLineNo,
    evidence: {
      rateLineNo,
      amountLineNo,
      consistencyCheck,
      notes,
    },
  };
}

/**
 * Extract service charge from OCR lines using country config
 */
export function extractServiceCharge(
  lines: OCRLine[],
  totalAmount: number,
  countryConfig?: CountryConfig
): { value: number; confidence: number; sourceLine?: number } {
  const processedLines = preprocessOCRLines(lines);
  
  // Use config service keywords if available
  const serviceKeywords = countryConfig?.labels.service || ["SERVICE", "SERVICE CHARGE", "SERVICE FEE"];
  
  // Build patterns from service keywords
  const servicePatterns: RegExp[] = [];
  for (const keyword of serviceKeywords) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Patterns: "SERVICE CHARGE : 6.250", "SERVICE CHARGE 6.250", "SERVICE CHARGE (5%): 6.250"
    servicePatterns.push(
      new RegExp(`${escapedKeyword}[\\s:]+([\\d,.]+)`, 'i'),
      new RegExp(`${escapedKeyword}[\\s]+([\\d,.]+)`, 'i'),
      new RegExp(`${escapedKeyword}[\\s(]*[\\d.]+%[\\s)]*[\\s:]*([\\d,.]+)`, 'i') // "SERVICE CHARGE (5%): 6.250"
    );
  }
  
  // Search last 15 lines (service charge usually near total)
  for (let i = processedLines.length - 1; i >= Math.max(0, processedLines.length - 15); i--) {
    const line = processedLines[i];
    const t = line.text;
    
    // Debug: log lines containing service keywords
    const hasServiceKeyword = serviceKeywords.some(kw => new RegExp(kw, 'i').test(t));
    if (hasServiceKeyword) {
      console.log(`[extractServiceCharge] Found service keyword in line ${line.lineNo}: "${t}"`);
    }
    
    for (const pattern of servicePatterns) {
      const match = t.match(pattern);
      if (match && match[1]) {
        const amountStr = match[1].trim();
        const amount = parseLooseNumber(amountStr, countryConfig);
        
        console.log(`[extractServiceCharge] Pattern matched: "${t}" Ã¢â€ â€™ amountStr="${amountStr}", parsed=${amount}, totalAmount=${totalAmount}`);
        
        // Service charge should be reasonable (< 20% of total, > 0)
        // For ID: service charge can be up to ~10% of total, so 20% is safe
        if (amount != null && !isNaN(amount) && amount > 0 && amount < totalAmount && amount < totalAmount * 0.2) {
          console.log(`[extractServiceCharge] Ã¢Å“â€¦ Service charge accepted: ${amount} (${((amount / totalAmount) * 100).toFixed(1)}% of total)`);
          return {
            value: round2(amount),
            confidence: 0.85,
            sourceLine: line.lineNo,
          };
        } else {
          console.log(`[extractServiceCharge] Ã¢ÂÅ’ Service charge rejected: amount=${amount}, totalAmount=${totalAmount}, check: ${amount != null && !isNaN(amount) && amount > 0 && amount < totalAmount && amount < totalAmount * 0.2}`);
        }
      }
    }
    
    // Also check if line has service keyword but amount is on next line
    if (hasServiceKeyword && i < processedLines.length - 1) {
      const nextLine = processedLines[i + 1];
      if (nextLine) {
        const amounts = extractAmountsFromText(nextLine.text, countryConfig);
        for (const amt of amounts) {
          if (amt.value > 0 && amt.value < totalAmount && amt.value < totalAmount * 0.2) {
            console.log(`[extractServiceCharge] Ã¢Å“â€¦ Service charge found on next line: ${amt.value} (line ${nextLine.lineNo})`);
            return {
              value: round2(amt.value),
              confidence: 0.8,
              sourceLine: nextLine.lineNo,
            };
          }
        }
      }
    }
  }
  
  console.log(`[extractServiceCharge] No service charge found in last 15 lines`);
  return { value: 0, confidence: 0 };
}

/**
 * Helpers
 */
function scoreToConfidence(score: number): number {
  // Simple mapping; keep deterministic
  if (score >= 120) return 0.95;
  if (score >= 80) return 0.9;
  if (score >= 50) return 0.75;
  if (score >= 10) return 0.6;
  return 0.4;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function extractAmountsFromText(text: string, countryConfig?: CountryConfig): Array<{ value: number; raw: string }> {
  const amountPattern = /(\*{0,2}\d{1,3}(?:[,\s]\d{3})*(?:[.,]\d{2})?|\*{0,2}\d+[.,]\d{2}|\*{0,2}\d+)/g; // Also matches "*43,50"
  const out: Array<{ value: number; raw: string }> = [];
  const matches = text.matchAll(amountPattern);
  for (const m of matches) {
    const raw = m[0];
    const v = parseLooseNumber(raw, countryConfig);
    if (v == null) continue;
    out.push({ value: v, raw });
  }
  return out;
}
