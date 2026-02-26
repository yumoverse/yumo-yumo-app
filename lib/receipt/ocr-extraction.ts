/**
 * OCR text extraction utilities
 * Extract dates, totals, and VAT from OCR text
 */

import type { OCRLine, DateExtraction, TimeExtraction, TotalExtraction, VATExtraction } from "./types";
import { regexPatterns, monthMap, TOTAL_KEY_RE, TAX_KEY_RE } from "@/lib/shared/constants";
import type { CountryConfig } from "@/lib/country/base";
import { looksLikeAddress, containsAddressTerm, hasPrimaryAddressTerm, knownBrands } from "./address-whitelist";
import { isForbiddenMerchant, isProductLineMerchant } from "./merchant-validation";

/**
 * Extract date from OCR lines
 */
/**
 * Convert Buddhist Era (BE) year to Common Era (CE) year
 * Buddhist Era = Common Era + 543
 * Example: 2568 BE = 2025 CE, 68 BE = 2025 CE (if 68 is last 2 digits of 2568)
 */
function convertBuddhistYear(year: number, isShort: boolean): number {
  if (isShort) {
    // Short year (2 digits): Could be Buddhist or Common Era
    // If year is 50-99, likely Buddhist (2550-2599 BE = 2007-2056 CE)
    // If year is 00-49, could be either, but for recent receipts assume Buddhist
    if (year >= 50 && year <= 99) {
      // Likely Buddhist: 50-99 = 2550-2599 BE = 2007-2056 CE
      return year + 2500 - 543;
    } else if (year >= 0 && year <= 49) {
      // Could be Buddhist (2500-2549 BE = 1957-2006 CE) or Common Era (2000-2049)
      // For recent receipts (after 2000), assume Buddhist if context suggests it
      // Check if we're in a Thai context (will be handled by caller)
      return year + 2500 - 543; // Assume Buddhist for now
    }
  } else {
    // Full year (4 digits)
    if (year >= 2500 && year <= 2600) {
      // Likely Buddhist Era (2500-2600 BE = 1957-2057 CE)
      return year - 543;
    }
  }
  // Not Buddhist, return as-is
  return year;
}

export function extractDate(lines: OCRLine[], countryConfig?: CountryConfig): DateExtraction {
  // Get full text for context detection
  const fullText = lines.map(l => l.text).join(' ');
  
  // Use config patterns if available, otherwise use defaults
  const datePatterns = countryConfig?.dateTime.datePatterns || [
    /\b(\d{1,2})[./-](\d{1,2})[./-](\d{4})\b/, // DD-MM-YYYY
  ];
  const isoPatterns = countryConfig?.dateTime.isoPatterns || [
    /\b(\d{4})[./-](\d{1,2})[./-](\d{1,2})\b/, // YYYY-MM-DD
  ];
  const shortPatterns = countryConfig?.dateTime.shortPatterns || [
    /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2})\b/, // DD-MM-YY
  ];
  
  // Buddhist calendar settings from config
  const useBuddhistCalendar = countryConfig?.dateTime.useBuddhistCalendar || false;
  const buddhistOffset = countryConfig?.dateTime.buddhistOffset || 543;
  const buddhistThreshold = countryConfig?.dateTime.buddhistThreshold || 2400;

  // Check from beginning (dates usually at top) and from end (some receipts have date at bottom)
  const searchIndices = [
    ...Array.from({ length: Math.min(15, lines.length) }, (_, i) => i), // First 15 lines
    ...Array.from({ length: Math.min(10, lines.length) }, (_, i) => lines.length - 1 - i), // Last 10 lines
  ];
  
  // Remove duplicates while preserving order
  const uniqueIndices = Array.from(new Set(searchIndices));

  for (const i of uniqueIndices) {
    if (i < 0 || i >= lines.length) continue;
    const line = lines[i].text;
    
    // Try date patterns from config (DD-MM-YYYY format)
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        const parts = match.slice(1).map(Number);
        let year = parts[2];
        
        // Buddhist calendar conversion (from config) - ONLY for Thailand
        if (useBuddhistCalendar && year >= buddhistThreshold) {
          year = year - buddhistOffset;
        }
        
        // For 4-digit years, use as-is (no smart inference needed)
        // Smart inference only applies to 2-digit years (DD-MM-YY format)
        // CRITICAL: If year is 2026 or later and we're in 2026, it's likely a past date (2022)
        // Indonesian receipts from 2022 might be misread as 2026
        const now = new Date();
        const currentYear = now.getFullYear();
        
        // If year is in the future (2026+) and current year is 2026, check if it's likely a misread
        // For Indonesian receipts, if year is 2026 but receipt is old, it might be 2022
        if (year >= 2026 && currentYear === 2026) {
          // Check if date is in the past relative to now (likely misread)
          const testDate = new Date(year, parts[1] - 1, parts[0]);
          if (testDate > now) {
            // Date is in future - likely misread, try 2022 instead
            const correctedYear = year - 4; // 2026 -> 2022
            const correctedDate = new Date(correctedYear, parts[1] - 1, parts[0]);
            if (!isNaN(correctedDate.getTime()) && correctedDate <= now) {
              console.log(`[extractDate] ⚠️ Corrected future date ${year}-${parts[1]}-${parts[0]} to ${correctedYear}-${parts[1]}-${parts[0]}`);
              year = correctedYear;
            }
          }
        }
        
        const date = new Date(year, parts[1] - 1, parts[0]); // year, month, day
        
        // Validate date (allow future dates up to 1 year ahead)
        const minYear = 2000;
        const maxYear = now.getFullYear() + 1;
        
        if (!isNaN(date.getTime()) && 
            date.getFullYear() >= minYear && 
            date.getFullYear() <= maxYear &&
            date <= new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)) {
          return {
            value: date.toISOString().split('T')[0],
            confidence: 0.85,
            sourceLine: lines[i].lineNo,
          };
        }
      }
    }
    
    // Try short date patterns (DD-MM-YY format)
    for (const pattern of shortPatterns) {
      const match = line.match(pattern);
      if (match) {
        const parts = match.slice(1).map(Number);
        let year = parts[2];
        
        // CRITICAL: For 2-digit years, use smart year inference
        // If year is 00-30, assume 2000-2030
        // If year is 31-99, assume 1931-1999 (old receipts)
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentCentury = Math.floor(currentYear / 100) * 100;
        const currentYearLastTwo = currentYear % 100;
        
        if (!useBuddhistCalendar) {
          // Smart year inference for 2-digit years
          // CRITICAL: For Indonesian receipts, be more conservative
          // If year is 20-25, assume 2020-2025 (past, but recent)
          // If year is 26-30, assume 2026-2030 (current/future)
          // If year is 00-19, assume 2000-2019 (past)
          // If year is 31-99, assume 1931-1999 (old receipts)
          // This prevents 26 from being interpreted as 2026 when it should be 2022
          if (year >= 26 && year <= currentYearLastTwo + 1) {
            // Year is in current/future century (e.g., 26 = 2026, 30 = 2030)
            year = currentCentury + year;
          } else if (year >= 20 && year <= 25) {
            // Year is in past but recent (e.g., 22 = 2022, 25 = 2025)
            // For receipts, assume 2020-2025 range
            year = 2000 + year;
          } else if (year >= 0 && year <= 19) {
            // Year is in past century but recent (e.g., 19 = 2019, 02 = 2002)
            // For receipts, assume 2000-2019 range
            year = 2000 + year;
          } else {
            // Year is in previous century (e.g., 99 = 1999, 95 = 1995)
            year = (currentCentury - 100) + year;
          }
        }
        
        // Buddhist calendar conversion (from config)
        if (useBuddhistCalendar) {
          if (year >= 50 && year <= 99) {
            // Likely Buddhist: 50-99 = 2550-2599 BE = 2007-2056 CE
            year = year + 2500 - buddhistOffset;
          } else if (year >= 0 && year <= 49) {
            // Could be Buddhist (2500-2549 BE = 1957-2006 CE) or Common Era (2000-2049)
            // For recent receipts (after 2000), assume Buddhist if config says so
            year = year + 2500 - buddhistOffset;
          }
        }
        // Note: Smart year inference already applied above for non-Buddhist calendar
        
        const date = new Date(year, parts[1] - 1, parts[0]);
        
        // Reuse 'now' from above (line 120)
        const minYear = 2000;
        const maxYear = now.getFullYear() + 1;
        
        if (!isNaN(date.getTime()) && 
            date.getFullYear() >= minYear && 
            date.getFullYear() <= maxYear &&
            date <= new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)) {
          return {
            value: date.toISOString().split('T')[0],
            confidence: 0.8,
            sourceLine: lines[i].lineNo,
          };
        }
      }
    }
    
    // Try ISO date patterns (YYYY-MM-DD format)
    for (const pattern of isoPatterns) {
      const match = line.match(pattern);
      if (match) {
        const parts = match.slice(1).map(Number);
        let year = parts[0];
        
        // Buddhist calendar conversion (from config)
        if (useBuddhistCalendar && year >= buddhistThreshold) {
          year = year - buddhistOffset;
        }
        
        const date = new Date(year, parts[1] - 1, parts[2]);
        
        const now = new Date();
        const minYear = 2000;
        const maxYear = now.getFullYear() + 1;
        
        if (!isNaN(date.getTime()) && 
            date.getFullYear() >= minYear && 
            date.getFullYear() <= maxYear &&
            date <= new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)) {
          return {
            value: date.toISOString().split('T')[0],
            confidence: 0.8,
            sourceLine: lines[i].lineNo,
          };
        }
      }
    }
    
    // Try textual date format (day-first: 1 Feb 2026)
    const textualMatch = line.match(regexPatterns.textualDate);
    if (textualMatch && textualMatch[1] && textualMatch[2] && textualMatch[3]) {
      const day = parseInt(textualMatch[1]);
      const monthName = textualMatch[2].toLowerCase();
      const month = monthMap[monthName] ?? monthMap[monthName.substring(0, 3)];
      if (month !== undefined && month !== -1) {
        const year = parseInt(textualMatch[3]);
        const date = new Date(year, month, day);

        const now = new Date();
        const minYear = 2000;
        const maxYear = now.getFullYear() + 1;

        if (!isNaN(date.getTime()) &&
            date.getFullYear() >= minYear &&
            date.getFullYear() <= maxYear &&
            date <= new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)) {
          return {
            value: date.toISOString().split('T')[0],
            confidence: 0.8,
            sourceLine: lines[i].lineNo,
          };
        }
      }
    }

    // Try textual month-first (e.g. Feb 1 2026, Feb 1, 2026) from country config
    const monthFirstPatterns = countryConfig?.dateTime?.textualMonthFirstPatterns;
    if (monthFirstPatterns) {
      for (const pattern of monthFirstPatterns) {
        const m = line.match(pattern);
        if (m && m[1] && m[2] && m[3]) {
          const monthKey = m[1].toLowerCase().substring(0, 3);
          const month = monthMap[monthKey] ?? -1;
          if (month !== -1) {
            const day = parseInt(m[2], 10);
            const year = parseInt(m[3], 10);
            const date = new Date(year, month, day);
            const now = new Date();
            const minYear = 2000;
            const maxYear = now.getFullYear() + 1;
            if (!isNaN(date.getTime()) &&
                date.getFullYear() >= minYear &&
                date.getFullYear() <= maxYear &&
                date <= new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)) {
              return {
                value: date.toISOString().split('T')[0],
                confidence: 0.85,
                sourceLine: lines[i].lineNo,
              };
            }
          }
        }
      }
    }
  }

  // Fallback: use today's date with low confidence
  return {
    value: new Date().toISOString().split('T')[0],
    confidence: 0.3,
  };
}

/**
 * Parse date string from date-time-combined match (e.g. "30/01/2026" or "29.01.2026") to ISO YYYY-MM-DD.
 */
function parseDatePartToIso(dateTimeStr: string): string | null {
  const datePart = dateTimeStr.trim().split(/\s+/)[0];
  const m = datePart?.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (!m) return null;
  let [, d, mon, y] = m;
  const year = y!.length === 2 ? 2000 + parseInt(y!, 10) : parseInt(y!, 10);
  const month = mon!.padStart(2, "0");
  const day = d!.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Extract time from OCR lines
 * Supports various time formats: HH:MM, HH:MM:SS, HH.MM, hh:mm AM/PM
 * Uses scoring system based on pattern quality, position, and context.
 * Prefers time near the date line and rejects footer timestamps that don't match receipt date (e.g. camera stamp).
 */
export function extractTime(
  lines: OCRLine[],
  countryConfig?: CountryConfig,
  dateLineIndex?: number,
  receiptDateIso?: string
): TimeExtraction {
  console.log(`[extractTime] Starting time extraction:`, {
    totalLines: lines.length,
    dateLineIndex,
    receiptDateIso,
    firstFewLines: lines.slice(0, 5).map(l => l.text),
  });
  
  // Use time patterns from config if available, otherwise use defaults
  const configTimePatterns = countryConfig?.dateTime.timePatterns || [];
  
  // Time patterns (ordered by priority/confidence)
  // If config provides patterns, use them; otherwise use default patterns
  const defaultTimePatterns = [
    // Date-time combined format (e.g., "22-01-2026 11:45" or ": 22-01-2026 11:45" or "Date : 22-01-2026 15:00")
    {
      pattern: /(?::|^|\s|Date\s*:)?\s*\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\s+([01]?\d|2[0-3])[:.]([0-5]\d)(?:[:.]([0-5]\d))?/,
      score: 1.0,
      name: "date-time-combined",
      format: (match: RegExpMatchArray) => {
        const hour = match[1].padStart(2, '0');
        const minute = match[2].padStart(2, '0');
        return `${hour}:${minute}`;
      }
    },
    // 24-hour formats
    { 
      pattern: /\b([01]?\d|2[0-3])[:.]([0-5]\d)(?:[:.]([0-5]\d))?\b/,
      score: 0.95,
      name: "24h-colon",
      format: (match: RegExpMatchArray) => {
        const hour = match[1].padStart(2, '0');
        const minute = match[2].padStart(2, '0');
        return `${hour}:${minute}`;
      }
    },
    // 12-hour format with AM/PM (with or without space)
    {
      pattern: /\b(0?\d|1[0-2])[:.]([0-5]\d)\s*(AM|PM|am|pm|ÖÖ|ÖS|öö|ös)\b/i,
      score: 0.9,
      name: "12h-am-pm",
      format: (match: RegExpMatchArray) => {
        let hour = parseInt(match[1]);
        const minute = match[2].padStart(2, '0');
        const period = match[3].toUpperCase();
        
        if (period === 'PM' || period === 'ÖS' || period === 'ös') {
          if (hour !== 12) hour += 12;
        } else if (period === 'AM' || period === 'ÖÖ' || period === 'öö') {
          if (hour === 12) hour = 0;
        }
        
        return `${hour.toString().padStart(2, '0')}:${minute}`;
      }
    },
    // 12-hour format with AM/PM (no space, e.g., "1:02PM")
    {
      pattern: /\b(0?\d|1[0-2])[:.]([0-5]\d)(AM|PM|am|pm)\b/i,
      score: 0.95, // Higher score for no-space format (more common)
      name: "12h-am-pm-nospace",
      format: (match: RegExpMatchArray) => {
        let hour = parseInt(match[1]);
        const minute = match[2].padStart(2, '0');
        const period = match[3].toUpperCase();
        
        if (period === 'PM') {
          if (hour !== 12) hour += 12;
        } else if (period === 'AM') {
          if (hour === 12) hour = 0;
        }
        
        return `${hour.toString().padStart(2, '0')}:${minute}`;
      }
    },
    // Time with "Saat" prefix (Turkish)
    {
      pattern: /(?:saat|time|zaman)[\s:]*([01]?\d|2[0-3])[:.]([0-5]\d)/i,
      score: 0.92,
      name: "time-with-label",
      format: (match: RegExpMatchArray) => {
        const hour = match[1].padStart(2, '0');
        const minute = match[2].padStart(2, '0');
        return `${hour}:${minute}`;
      }
    },
    // Space-separated time (e.g., "14 30")
    {
      pattern: /\b([01]?\d|2[0-3])\s+([0-5]\d)\b/,
      score: 0.75,
      name: "24h-space",
      format: (match: RegExpMatchArray) => {
        const hour = match[1].padStart(2, '0');
        const minute = match[2].padStart(2, '0');
        return `${hour}:${minute}`;
      }
    },
  ];
  
  // If config provides time patterns, add them to the pattern list
  // Config patterns use simple format: HH:MM or HH.MM
  if (configTimePatterns.length > 0) {
    for (const configPattern of configTimePatterns) {
      // Add config patterns with default format function
      defaultTimePatterns.push({
        pattern: configPattern,
        score: 0.9,
        name: "config-pattern",
        format: (match: RegExpMatchArray) => {
          const hour = match[1]?.padStart(2, '0') || '00';
          const minute = match[2]?.padStart(2, '0') || '00';
          return `${hour}:${minute}`;
        }
      });
    }
  }
  
  const timePatterns = defaultTimePatterns;

  // Search strategy: prioritize lines near date, then scan ALL lines (time can be anywhere)
  const searchIndices: number[] = [];
  
  // If we know where the date is, prioritize that line first (date and time often on same line)
  if (dateLineIndex !== undefined) {
    // First, add the date line itself (highest priority - date and time often together)
    if (dateLineIndex >= 0 && dateLineIndex < lines.length) {
      searchIndices.push(dateLineIndex);
    }
    // Then add lines around it
    for (let offset = -2; offset <= 2; offset++) {
      if (offset === 0) continue; // Already added above
      const idx = dateLineIndex + offset;
      if (idx >= 0 && idx < lines.length) {
        searchIndices.push(idx);
      }
    }
  }
  
  // Also check first 10 lines (header area)
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (!searchIndices.includes(i)) {
      searchIndices.push(i);
    }
  }
  
  // Check last 5 lines (footer area)
  for (let i = Math.max(0, lines.length - 5); i < lines.length; i++) {
    if (!searchIndices.includes(i)) {
      searchIndices.push(i);
    }
  }
  
  // CRITICAL: Also scan ALL lines (time can be in the middle of receipt, e.g., "15.01.2026 17:49")
  // This is important for Turkish receipts where time appears mid-receipt
  for (let i = 0; i < lines.length; i++) {
    if (!searchIndices.includes(i)) {
      searchIndices.push(i);
    }
  }

  let bestMatch: {
    value: string;
    confidence: number;
    sourceLine: number;
    idx: number;
  } | null = null;

  for (const idx of searchIndices) {
    if (idx < 0 || idx >= lines.length) continue;
    const line = lines[idx].text;
    
    // If this is the date line, we need to be more careful - exclude date patterns
    const isDateLine = dateLineIndex !== undefined && idx === dateLineIndex;
    
    // Try each pattern
    for (const timePattern of timePatterns) {
      const match = line.match(timePattern.pattern);
      if (match) {
        // If this is the date line, make sure we're not matching part of the date
        if (isDateLine) {
          // Check if the match is part of a date pattern (e.g., "23.12.2025" contains "12:20" would be wrong)
          const matchStart = match.index || 0;
          const matchEnd = matchStart + match[0].length;
          
          // Check for date patterns before/after the time match
          const beforeMatch = line.substring(Math.max(0, matchStart - 15), matchStart);
          const afterMatch = line.substring(matchEnd, Math.min(line.length, matchEnd + 15));
          const context = beforeMatch + match[0] + afterMatch;
          
          // If context contains a date pattern, this might be a false positive
          const datePatternInContext = /\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/.test(context);
          if (datePatternInContext) {
            // Time with colon (e.g. "09:48") after date is clearly valid
            const timeAfterDateWithColon = /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\s+([01]?\d|2[0-3])[:.]([0-5]\d)\b/.test(context);
            if (timeAfterDateWithColon) {
              // Continue with this match
            } else if (!match[0].includes(':')) {
              // Space-separated time (e.g. "07 51" on "Date: 04/02/2026 07 51") — accept when valid HH MM
              const parts = match[0].trim().split(/\s+/);
              if (parts.length === 2) {
                const h = parseInt(parts[0], 10);
                const m = parseInt(parts[1], 10);
                if (!isNaN(h) && !isNaN(m) && h >= 0 && h <= 23 && m >= 0 && m <= 59) {
                  // Valid time on date line (saat her zaman date'e en yakın konumda)
                  // Continue with this match
                } else {
                  console.log(`[extractTime] Skipping potential false positive on date line:`, {
                    match: match[0],
                    context: context.substring(0, 50),
                  });
                  continue;
                }
              } else {
                // Single number on date line might be day/month, skip
                console.log(`[extractTime] Skipping potential false positive on date line:`, {
                  match: match[0],
                  context: context.substring(0, 50),
                });
                continue;
              }
            }
          }
        }
        
        console.log(`[extractTime] Pattern match found:`, {
          pattern: timePattern.name,
          line: line.substring(0, 50),
          match: match[0],
          lineIndex: idx,
          isDateLine,
        });
        try {
          const timeValue = timePattern.format(match);
          
          // Validate time value
          const [hour, minute] = timeValue.split(':').map(Number);
          if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
            // Calculate confidence based on pattern score and position
            let confidence = timePattern.score;

            // Prefer time closest to date line (saat her zaman date'e en yakın konumda)
            if (dateLineIndex !== undefined) {
              const distance = Math.abs(idx - dateLineIndex);
              if (distance === 0) confidence += 0.25; // Same line as date — strongest signal
              else if (distance === 1) confidence += 0.15; // Adjacent line
              else if (distance === 2) confidence += 0.08;
            }

            // Boost confidence if in header area (first 5 lines)
            if (idx < 5) confidence += 0.02;

            // Fiş dışı zaman: date-time-combined in footer with wrong date (e.g. camera stamp 30/01 16:40)
            if (timePattern.name === "date-time-combined" && receiptDateIso) {
              const parsedDate = parseDatePartToIso(match[0]);
              if (parsedDate) {
                if (parsedDate === receiptDateIso) {
                  confidence += 0.15; // Time date matches receipt date
                } else if (idx >= lines.length - 5) {
                  confidence -= 0.5; // Footer timestamp with different date = likely not from receipt
                  console.log(`[extractTime] ⚠️ Footer date-time mismatch (fiş dışı): line ${idx} date ${parsedDate} vs receipt ${receiptDateIso}`);
                }
              }
            }

            // CRITICAL: Reduce confidence if time is in working hours pattern
            // Working hours patterns: "(MON - FRI, 09.00 - 19.00)" or similar
            const workingHoursPattern = /\(.*?(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})\).*?\)/i;
            if (workingHoursPattern.test(line)) {
              confidence -= 0.5; // Heavily penalize working hours
              console.log(`[extractTime] ⚠️ Time found in working hours pattern, reducing confidence: ${line.substring(0, 50)}`);
            }
            
            // CRITICAL: Reduce confidence if line contains day names (working hours)
            const dayNamesPattern = /(senin|selasa|rabu|kamis|jumat|sabtu|minggu|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i;
            if (dayNamesPattern.test(line) && /(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})/.test(line)) {
              confidence -= 0.6; // Heavily penalize if contains day names + time range
              console.log(`[extractTime] ⚠️ Time found with day names (working hours), reducing confidence: ${line.substring(0, 50)}`);
            }
            
            // Reduce confidence if time seems invalid (e.g., 25:00)
            if (hour > 23 || minute > 59) {
              continue;
            }
            
            // Clamp confidence to 0-1
            confidence = Math.min(1, Math.max(0, confidence));

            // Prefer higher confidence; if equal, prefer earlier line (tarihe yakın / fiş üstü)
            const isBetter =
              !bestMatch ||
              confidence > bestMatch.confidence ||
              (confidence === bestMatch.confidence && idx < bestMatch.idx);
            if (isBetter) {
              bestMatch = {
                value: timeValue,
                confidence,
                sourceLine: lines[idx].lineNo,
                idx,
              };
            }
          }
        } catch (error) {
          // Invalid time format, skip
          continue;
        }
      }
    }
  }

  // Return best match if found
  if (bestMatch && bestMatch.confidence >= 0.5) {
    console.log(`[extractTime] Best match found:`, bestMatch);
    return {
      value: bestMatch.value,
      confidence: bestMatch.confidence,
      sourceLine: bestMatch.sourceLine,
    };
  }

  // Fallback: no time found
  console.log(`[extractTime] No time found. Best match:`, bestMatch);
  return {
    value: "",
    confidence: 0,
  };
}

/**
 * Parse number with Turkish format support (39.589,00 = 39589.00)
 * Also handles Thai Baht "B" prefix (e.g., "B257.00" -> 257.00)
 */
function parseTurkishNumber(str: string): number | null {
  if (!str) return null;
  
  // Remove spaces
  let s = str.trim().replace(/\s+/g, "");
  
  // Remove Thai Baht "B" prefix (common OCR error: "B" read as "8")
  // Pattern: "B" followed by digits (e.g., "B257.00", "B16.81")
  s = s.replace(/^[bB]\s*([\d,.]+)$/, "$1"); // "B257.00" -> "257.00"
  
  // Also check if number starts with "8" followed by reasonable digits (could be "B" misread)
  // Only fix if it looks like a currency amount (has decimal or reasonable size)
  const eightPrefixMatch = s.match(/^8(\d{1,3}(?:[.,]\d{2})?)$/);
  if (eightPrefixMatch) {
    // Check if removing "8" gives a reasonable amount
    const withoutEight = eightPrefixMatch[1];
    const testValue = parseFloat(withoutEight.replace(/,/g, "."));
    // If the value without "8" is reasonable (< 10000 and > 0.01), assume "8" was "B"
    if (testValue > 0.01 && testValue < 10000) {
      s = withoutEight;
    }
  }
  
  // Turkish format: dot is thousands separator, comma is decimal
  // "39.589,00" -> "39589.00"
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastDot < lastComma) {
      // Turkish format: dot thousands, comma decimal
      s = s.replace(/\./g, ""); // Remove dots (thousands)
      s = s.replace(/,/g, "."); // Replace comma with dot (decimal)
    } else {
      // US format: comma thousands, dot decimal
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    // Could be Turkish decimal (200,00) or thousands (1,234)
    const parts = s.split(",");
    if (parts.length === 2 && parts[1].length === 2) {
      // Likely Turkish decimal format
      s = s.replace(/,/g, ".");
    } else {
      // Likely thousands separator
      s = s.replace(/,/g, "");
    }
  } else if (hasDot && !hasComma) {
    // Could be decimal or thousands - check context
    const parts = s.split(".");
    if (parts.length === 2 && parts[1].length === 2) {
      // Likely decimal
    } else {
      // Could be thousands, but keep as-is for now
    }
  }
  
  const v = parseFloat(s);
  if (!isFinite(v) || v <= 0) return null;
  return v;
}

/**
 * Extract total amount from OCR lines
 */
export function extractTotal(lines: OCRLine[]): TotalExtraction {
  // Use shared constants for total patterns
  const totalPatterns = [
    new RegExp(`(?:${TOTAL_KEY_RE.source.replace(/^\/|\/[gi]*$/g, '')})[\\s:]*([\\d,.\\s]+)`, 'i'),
    new RegExp(`([\\d,.\\s]+)\\s*(?:${TOTAL_KEY_RE.source.replace(/^\/|\/[gi]*$/g, '')})`, 'i'),
  ];

  // Also look for currency symbols (including Thai Baht "B" prefix)
  const currencyPattern = /[bB]?\s*([\d,.]+)\s*(?:€|USD|TRY|TL|\$|฿)/i;

  // Check last 15 lines first (totals usually at the end, e-fatura may have more footer)
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 15); i--) {
    const line = lines[i].text;
    
    // Try total patterns
    for (const pattern of totalPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const amount = parseTurkishNumber(match[1]);
        if (amount !== null && amount > 0) {
          return {
            value: amount,
            confidence: 0.9,
            sourceLine: lines[i].lineNo,
          };
        }
      }
    }
    
    // Try currency pattern
    const currencyMatch = line.match(currencyPattern);
    if (currencyMatch && currencyMatch[1]) {
      const amount = parseTurkishNumber(currencyMatch[1]);
      if (amount !== null && amount > 0) {
        return {
          value: amount,
          confidence: 0.85,
          currency: currencyMatch[2] || "USD",
          sourceLine: lines[i].lineNo,
        };
      }
    }
  }

  // Fallback: find largest number in last 10 lines
  let maxAmount = 0;
  let maxLine = -1;
  
  for (let i = Math.max(0, lines.length - 10); i < lines.length; i++) {
    const numbers = lines[i].text.match(/[\d,.]+/g);
    if (numbers) {
      for (const numStr of numbers) {
        const amount = parseTurkishNumber(numStr);
        if (amount !== null && amount > maxAmount && amount < 1000000) {
          maxAmount = amount;
          maxLine = lines[i].lineNo;
        }
      }
    }
  }

  if (maxAmount > 0) {
    return {
      value: maxAmount,
      confidence: 0.6,
      sourceLine: maxLine,
    };
  }

  // No total found
  return {
    value: 0,
    confidence: 0,
  };
}

/** Options for merchant extraction */
export interface ExtractMerchantOptions {
  /** True when document is a POS/bank slip (thermal slip) - merchant search limited to first 5 lines */
  isPosSlip?: boolean;
  /** True when document is e-fatura (e-Arşiv) - search first 30 lines and prefer lines with company suffix (A.Ş, LTD, ŞTİ, SAN) */
  isEfatura?: boolean;
}

/**
 * Extract merchant name from OCR lines
 * FIXED: Better garbage detection and skip keywords
 * Slips (POS): ilk 5 satırda ara. Fişler: ilk 20 satırda ara.
 */
export function extractMerchant(
  lines: OCRLine[],
  options?: ExtractMerchantOptions
): { name: string; confidence: number; sourceLine?: number } {
  const skipWords = new Set([
    'receipt', 'invoice', 'bill', 'fiş', 'fatura', 'tarih', 'date',
    'total', 'toplam', 'amount', 'tutar', 'vat', 'kdv', 'tax', 'vergi',
    'cash', 'credit', 'card', 'nakit', 'kredi', 'kartı', 'sayin', 'sayın',
    'address', 'adres', 'tel', 'fax', 'e-posta', 'email', 'web', 'website',
    'saat', 'pumpa', 'istasyon', 'station', 'pump',
    // Adres bileşenleri (garbage - işletme adı değil)
    'sokak', 'cadde', 'mahalle', 'mah.', 'bulvar', 'blvd', 'cd.', 'cad.',
    'street', 'st', 'avenue', 'ave', 'road', 'rd', 'boulevard', 'drive', 'dr', 'lane', 'ln',
    // Receipt structure keywords (not merchant names)
    'queue', 'num', 'number', 'numara', 'bill num', 'queue num',
    'sales mode', 'dine in', 'take out', 'guest', 'table', 'pax', 'cashier',
    'subtotal', 'service charge', 'pre settlement', 'not paid',
    // Keyboard keys (NOT merchant names!)
    'end', 'del', 'delete', 'enter', 'esc', 'tab', 'ctrl', 'alt', 'fn', 'shift',
    'pgdn', 'pg up', 'pg dn', 'home', 'ins', 'insert', 'backspace',
    // 🔥 NEW: Receipt header keywords (NOT merchant names!)
    'eku', 'no', 'değeri', 'ft', 'mf', 'sni', 'stan', 'batch', 'pos', 'rrn',
    'z', 'isyeri', 'işyeri', 'terminal', 'acquirer',
    // Fiş disclaimer ibareleri (MALI DEĞERİ YOKTUR, LI DEĞERİ YOKTUR vb.)
    'yoktur', 'mali',
    // Transaction type labels (POS receipts) - NEVER merchant names
    'satış', 'satis', 'osatis', 'ödeme', 'odeme', 'iade', 'iptal', 'sale', 'sales',
    // TOPKDV, vergi/fatura false positives (toplam, kdv zaten yukarıda)
    'topkdv',
    // Adres kısaltmaları
    'mah', 'mh', 'mh.',
    // Ve devamı / vb. (kısaltmalar)
    'vd', 'v.d', 'vb', 'v.b',
    // Fiş no, belge no
    'fiş', 'fis', 'fişno', 'fisno', 'belge', 'belge no', 'sıra', 'sira',
    // Türkçe ı/i, ş/s, ğ/g, ö/o, ü/u, ç/c typo ve locale varyasyonları (OCR/JS toLowerCase tutarsızlığı)
    'kredı', 'karti', 'degeri', 'ışyeri', 'ısyeri', 'satıs', 'faturı', 'tarıh', 'vergı', 'nakıt', 'malı',
    'ıade', 'ıptal', 'fısno', 'ıstasyon',
    // Hoş geldiniz karşılama ibaresi (typo: deldintz, geldintz) — satırda geçerse merchant sayılmaz
    'geldiniz', 'geldintz', 'deldintz', 'deldiniz',
  ]);
  
  // 🔥 NEW: Receipt header patterns (these lines are NEVER merchant names)
  const headerPatterns = [
    /^(eku|fiş|fis)\s*(no|numara)?\s*[:=]?\s*\d*/i,  // "EKU NO", "FİŞ NO"
    /^z\s+(no|numara)\s*[:=]?\s*\d*/i,              // "Z NO", "Z NO: 123" — sadece Z rapor satırları
    /^(mf|sni|hgn)\s*ft\s*\d+/i,       // "MF FT 40057342"
    /^(stan|batch|pos|rrn):/i,         // "STAN: 029488"
    /\b(ettn|etn)\s*n[o0ο]\s*[:=：]?/i, // "ETTN NO:", "ETN NO" — fatura UUID etiketi; OCR: n0, nο (Greek)
    /^\d+\s*(no|numara)\s*[:=]/i,      // "0436 NO:"
    /^değeri$/i,                        // "DEĞERİ" (standalone)
    /^(fiş|fis)\s*(no|numara)/i,        // "FİŞ NO", "FİŞ NUMARASI"
    /^(belge|sıra|sira)\s*(no|numara)?/i,
    /^topkdv/i,                         // "TOPKDV", "TOPKDV DAHİL"
    /\b(işyeri|isyeri|İŞYERİ)\s*no\s*[:=]?\s*\d/i,  // İşyeri No: ... — asla işletme adı değil
    /^\s*\d{1,2}:\d{2}(:\d{2})?\s*$/i, // Sadece saat "09:55" veya "14:30:00"
    /^\s*\d{1,2}[./-]\d{1,2}[./-]\d{2,4}(\s+\d{1,2}:\d{2})?\s*$/i,  // Sadece tarih veya tarih+saat
    // Ticaret Sicil No / Mersis No: fatura etiketleri, işletme adı değil
    /\b(ticaret|Ticaret|TİCARET)\s*(sicil|Sicil|SICIL)\s*(no|No|NO)\s*[:=]?\s*\d/i,
    /\b(mersis|Mersis|MERSIS)\s*(no|No|NO)\s*[:=]?\s*[\d\-]/i,
    // Ticaret Odası: oda adı, işletme adı değil (Ticaret Odası, TICARET ODASI, TİCARET ODASI, boşluklu/boşluksuz, Türkçe karakterler)
    /\bticaret\s*odas[ıiIİ]\b/i,
    /\bTICARET\s*ODASI?\b/i,
    /\bTİCARET\s*ODASI?\b/i,
    // Fiş disclaimer (MALI DEĞERİ YOKTUR, LI DEĞERİ YOKTUR - OCR bazen bitişik: LIDEĞERİYOKTUR)
    /\b(mali|malı|li)\s*değeri\s*yoktur\b/i,
    /^(lideğeri|lidegeri|malideğeri|malidegeri)yoktur/i,
    // "Hoş Geldiniz" karşılama ibaresi — işletme adı değil (typo: HOS DELDINTZ, HOS GELDINTZ vb.)
    /^(hos|hosh|hoş)\s+(geldiniz|geldintz|deldiniz|deldintz)\b/i,
  ];
  
  // Keyboard key patterns (exact matches - these are NEVER merchant names)
  const keyboardKeyPatterns = [
    /^END$/i,
    /^DEL$/i,
    /^DELETE$/i,
    /^ENTER$/i,
    /^ESC$/i,
    /^TAB$/i,
    /^CTRL$/i,
    /^ALT$/i,
    /^FN$/i,
    /^SHIFT$/i,
    /^PG\s*DN$/i,
    /^PG\s*UP$/i,
    /^HOME$/i,
    /^INS$/i,
    /^INSERT$/i,
    /^BACKSPACE$/i,
  ];
  
  // Company suffixes (Turkish, Indonesian, International)
  const companySuffixes = [
    // Turkish
    'a.ş.', 'a.ş', 'ltd.', 'ltd', 'ltd.şti.', 'ltd.şti', 'inc.', 'inc', 'san.', 'san', 'tic.', 'tic', 'ticaret',
    // Indonesian
    'pt.', 'pt', 'cv.', 'cv', 'tbk.', 'tbk',
    // International
    'ltd.', 'ltd', 'inc.', 'inc', 'corp.', 'corp', 'llc', 'plc', 'pvt', 'pvt.'
  ];
  
  // Bank names that should NEVER be treated as merchant names
  const bankNames = [
    'yapı kredi', 'yapı ve kredi', 'yapi kredi', 'yapi ve kredi',
    'yapı kredi bankası', 'yapı ve kredi bankası', 'yapi kredi bankasi',
    'ziraat bankası', 'ziraat bankasi', 'türkiye iş bankası', 'turkiye is bankasi',
    'garanti bankası', 'garanti bankasi', 'akbank', 'denizbank', 'qnb finansbank',
    'finansbank', 'ing bank', 'hsbc', 'türk ekonomisi bankası', 'turkiye ekonomisi bankasi',
    'teb', 'vakıfbank', 'vakifbank', 'halkbank', 'isbank', 'ziraat',
    'mastercard', 'visa', 'troy', 'amex', 'american express'
  ];

  // Ticaret Odası vb.: oda/kurum adları işletme adı sayılmaz (Ticaret Odası, TICARET ODASI, TİCARET ODASI, boşluklu/boşluksuz, Türkçe karakterler)
  const forbiddenMerchantPatterns = [
    /\bticaret\s*odas[ıiIİ]\b/i,
    /\bTICARET\s*ODASI?\b/,
    /\bTİCARET\s*ODASI?\b/,
    /ticaret\s*odası/i,
    /ticaret\s*odasi/i,
  ];
  
  // Slip (POS): ilk 5 satır. Fiş: ilk 20 satır. E-fatura: ilk 30 satır (işletme adı A.Ş/LTD/ŞTİ ile aranır).
  let MERCHANT_ZONE_LINES = options?.isEfatura ? 30 : options?.isPosSlip ? 5 : 20;

  // İşletme adı adresten hemen önce aranır: ilk adres satırı bulunursa (0. satır dahil), arama o bölgeyle sınırlandırılır.
  // 0. satır adres ise bölge 0..(0+3-1) = 3 satır olur; adres satırı zaten atlanacağı için gerçekte 2 satır aday kalır; işletme bulunamazsa Unknown döner.
  const firstAddressLineIndex = lines.findIndex((l) => looksLikeAddress(l.text));
  if (firstAddressLineIndex >= 0 && firstAddressLineIndex < MERCHANT_ZONE_LINES) {
    MERCHANT_ZONE_LINES = Math.min(MERCHANT_ZONE_LINES, firstAddressLineIndex + 3);
  }

  // E-fatura: ilk 30 satırda A.Ş, LTD, ŞTİ, SAN gibi işletme ibareleri varsa onu işletme adı olarak al.
  if (options?.isEfatura) {
    // A.Ş, LTD, ŞTİ, SAN, TİC. (kısaltma) — "ticaret" tek başına yok (Ticaret Sicil No yanlış eşleşmesin)
    const efaturaCompanyPattern = /\b(a\.ş\.?|ltd\.?|ltd\s*şti\.?|şti\.?|sti\.?|san\.?|tic\.?|inc\.?|corp\.?)\b/i;
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      const line = lines[i].text.trim();
      if (line.length < 5) continue;
      if (!efaturaCompanyPattern.test(line)) continue;
      if (headerPatterns.some((p) => p.test(line))) continue;
      const lowerLine = line.toLowerCase();
      const lineWords = lowerLine.split(/\s+/);
      if (lineWords.some((w) => skipWords.has(w))) continue;
      if (bankNames.some((bank) => lowerLine.includes(bank))) continue;
      if (/\b(bank|banka|bankası|bankasi)\s+(a\.ş\.|a\.ş|inc\.|inc|ltd\.|ltd)\b/i.test(line)) continue;
      if (forbiddenMerchantPatterns.some((p) => p.test(line))) continue;
      console.log(`[extractMerchant] ✅ E-fatura: işletme adı (şirket ibaresi) ilk 30 satırda: "${line}" (satır ${i + 1})`);
      return { name: line, confidence: 0.9, sourceLine: lines[i].lineNo };
    }

    // E-fatura: SATICI/Unvan/Düzenleyen bloğunda işletme adı ara (şirket ibaresi olmayan satırlar için)
    const saticiLabelPattern = /^(?:satici|satıcı|satici|düzenleyen|duzenleyen|unvan|ünvan|vergi\s*mükellefi|vergi\s*mukellefi)\s*[:.]?\s*(.*)$/i;
    const isLikelyCompanyName = (s: string) =>
      s.length >= 6 &&
      s.length <= 80 &&
      !/^\d+$/.test(s) &&
      !headerPatterns.some((p) => p.test(s)) &&
      !bankNames.some((b) => s.toLowerCase().includes(b));
    for (let i = 0; i < Math.min(35, lines.length); i++) {
      const line = lines[i].text.trim();
      const match = line.match(saticiLabelPattern);
      if (match) {
        const afterLabel = match[1].trim();
        if (afterLabel.length >= 6 && isLikelyCompanyName(afterLabel)) {
          const afterWords = afterLabel.toLowerCase().split(/\s+/);
          if (!afterWords.some((w) => skipWords.has(w))) {
            console.log(`[extractMerchant] ✅ E-fatura: SATICI/Unvan bloğunda işletme adı: "${afterLabel}" (satır ${i + 1})`);
            return { name: afterLabel, confidence: 0.88, sourceLine: lines[i].lineNo };
          }
        }
        for (let j = 1; j <= 2 && i + j < lines.length; j++) {
          const nextLine = lines[i + j].text.trim();
          if (nextLine.length >= 6 && isLikelyCompanyName(nextLine)) {
            const nextLower = nextLine.toLowerCase();
            if (!nextLower.split(/\s+/).some((w) => skipWords.has(w))) {
              console.log(`[extractMerchant] ✅ E-fatura: SATICI/Unvan sonrası işletme adı: "${nextLine}" (satır ${i + j + 1})`);
              return { name: nextLine, confidence: 0.88, sourceLine: lines[i + j].lineNo };
            }
          }
        }
      }
    }
  }

  let bestMerchant: { name: string; confidence: number; sourceLine?: number } | null = null;
  let merchantLines: string[] = [];
  let merchantStartIndex = -1;

  // E-fatura: ALICI (buyer) bloğundaki satırları işletme adı olarak alma
  const aliciZoneIndices = new Set<number>();
  if (options?.isEfatura) {
    const aliciLabelPattern = /^(?:alici|alıcı|müşteri|musteri)\s*[:.]?/i;
    for (let i = 0; i < Math.min(25, lines.length); i++) {
      if (aliciLabelPattern.test(lines[i].text.trim())) {
        for (let j = 0; j <= 6 && i + j < lines.length; j++) aliciZoneIndices.add(i + j);
        break;
      }
    }
  }

  const calculateLetterDigitRatio = (text: string): { letterRatio: number; digitRatio: number } => {
    const upperLetters = (text.match(/[A-ZÇĞİÖŞÜ]/g) || []).length;
    const lowerLetters = (text.match(/[a-zçğıöşü]/g) || []).length;
    const letters = upperLetters + lowerLetters;
    const digits = (text.match(/\d/g) || []).length;
    const total = text.length;
    return {
      letterRatio: total > 0 ? letters / total : 0,
      digitRatio: total > 0 ? digits / total : 0,
    };
  };
  
  for (let i = 0; i < Math.min(MERCHANT_ZONE_LINES, lines.length); i++) {
    const line = lines[i].text.trim();
    const isTopLine = i < 3;
    const isInMerchantZone = i < MERCHANT_ZONE_LINES; // İşletme adı ilk 5 satırda aranır
    
    if (line.length < 3) continue;
    
    // 🔥 NEW: Skip receipt header patterns
    if (headerPatterns.some(pattern => pattern.test(line))) {
      console.log(`[extractMerchant] ⚠️ Skipping header pattern: "${line}"`);
      continue;
    }

    // E-fatura: ALICI (müşteri) bloğundaki kişi adlarını atla
    if (options?.isEfatura && aliciZoneIndices.has(i)) {
      const companySuffix = /\b(a\.ş\.?|ltd\.?|ltd\s*şti\.?|şti\.?|sti\.?|san\.?|tic\.?|ticaret|inc\.?|corp\.?)\b/i;
      const wc = line.trim().replace(/[.,;:!?]+$/g, "").split(/\s+/).filter((w) => w.length > 0).length;
      if (!companySuffix.test(line) && wc >= 2 && wc <= 4) {
        console.log(`[extractMerchant] ⚠️ E-fatura: ALICI bloğunda kişi adı atlanıyor: "${line}"`);
        continue;
      }
    }
    
    // Skip very short words unless they have company suffix or are known brands
    if (line.length <= 4) {
      const hasCompanySuffix = companySuffixes.some(suffix => line.toLowerCase().includes(suffix.toLowerCase()));
      const isKnownBrand = knownBrands.some(brand => line.toLowerCase().includes(brand));
      if (!hasCompanySuffix && !isKnownBrand) {
        continue;
      }
    }
    
    // Skip keyboard keys
    if (keyboardKeyPatterns.some(pattern => pattern.test(line))) {
      continue;
    }
    
    // Skip mostly numbers or dates
    if (/^\d+[\s\d,\.\-/]*$/.test(line)) continue;

    // Uzun rakamlar: sadece 10+ rakamdan oluşan satırlar (VKN, seri no vb.)
    if (/^\s*[\d\s.,\-]{10,}\s*$/.test(line) && (line.match(/\d/g) || []).length >= 10) continue;
    
    // 🔥 PRIORITY: Known brands — NEVER skip. Adres satırında marka varsa markayı işletme adı al (Kemer/Göynük kuralı).
    const lowerLine = line.toLowerCase();
    const hasKnownBrand = knownBrands.some(brand => lowerLine.includes(brand));
    if (hasKnownBrand) {
      let merchantName = line;
      if (line.length > 80) {
        for (const brand of knownBrands) {
          const brandIndex = lowerLine.indexOf(brand);
          if (brandIndex >= 0) {
            const afterBrand = line.substring(brandIndex);
            const suffixMatch = afterBrand.match(new RegExp(`(.{0,60}${companySuffixes.map(s => s.replace('.', '\\.')).join('|')}.*?)`, 'i'));
            if (suffixMatch) {
              merchantName = suffixMatch[1].trim();
            } else {
              merchantName = afterBrand.substring(0, brand.length + 40).trim();
            }
            break;
          }
        }
      }
      const hasMerchantTypeKeyword = /cafe|restaurant|restoran|coffee|shop|store|market|supermarket|lounge|game|bar/i.test(lowerLine);
      const confidence = hasMerchantTypeKeyword ? 0.98 : 0.95;
      // If a known brand is found, always return it, regardless of whether it looks like an address
      console.log(`[extractMerchant] ✅ Found known brand with ${hasMerchantTypeKeyword ? 'type keyword' : 'no keyword'}: "${merchantName}"`);
      return {
        name: merchantName,
        confidence,
        sourceLine: lines[i].lineNo,
      };
    }

    // Skip lines with receipt words
    const words = lowerLine.split(/\s+/);
    if (words.some(word => skipWords.has(word))) {
      console.log(`[extractMerchant] ⚠️ Skipping skip word line: "${line}"`);
      continue;
    }

    // Adres whitelist: MAH, SOK, il/ilçe vb. içeren satırları atla (işletme adı değil) — known brand yoksa
    if (looksLikeAddress(line)) {
      console.log(`[extractMerchant] ⚠️ Skipping address-like line: "${line.substring(0, 60)}..."`);
      continue;
    }
    
    // Skip contact info
    if (/(tel|fax|phone|e-posta|email|web|www|http|@)/i.test(line)) continue;
    
    // Skip dates
    if (/\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}[./-]\d{1,2}[./-]\d{1,2})\b/.test(line) && line.length < 20) continue;
    
    // High confidence: Company suffix
    const hasCompanySuffix = companySuffixes.some(suffix => lowerLine.includes(suffix.toLowerCase()));
    if (hasCompanySuffix && line.length <= 100 && !looksLikeAddress(line)) {
      if (merchantLines.length > 0) {
        const combinedName = merchantLines.join(' ') + ' ' + line;
        if (!looksLikeAddress(combinedName)) {
          const candidate = {
            name: combinedName.trim(),
            confidence: 0.95,
            sourceLine: lines[merchantStartIndex >= 0 ? merchantStartIndex : i].lineNo,
          };
          if (!bestMerchant || candidate.confidence > bestMerchant.confidence) {
            bestMerchant = candidate;
          }
        }
        merchantLines = [];
      } else {
        const candidate = {
          name: line,
          confidence: 0.95,
          sourceLine: lines[i].lineNo,
        };
        if (!bestMerchant || candidate.confidence > bestMerchant.confidence) {
          bestMerchant = candidate;
        }
      }
      continue;
    }
    
    // Collect potential merchant lines (ilk 5 satır, büyük harfler)
    if (isInMerchantZone && line.length >= 5 && line.length <= 100) {
      const capitalRatio = (line.match(/[A-ZÇĞİÖŞÜ]/g) || []).length / line.length;
      const hasNumbers = /\d/.test(line);
      const looksLikeAddress = /\d+\s+(street|st|avenue|ave|road|rd|boulevard|blvd|sokak|cadde|mahalle|mah\.|cd\.|cad\.)/i.test(line);
      const looksLikeContact = /(tel|fax|phone|e-posta|email|web|www|http|@)/i.test(line);
      
      if (capitalRatio > 0.3 && !hasNumbers && !looksLikeAddress && !looksLikeContact) {
        // ETTN NO: veya ürün satırı (PARM BON HAST KG) asla merchant değil
        if (/\b(ettn|etn)\s*n[o0ο]\s*[:=：]?\s*$/i.test(line) || isProductLineMerchant(line)) {
          continue;
        }
        if (merchantLines.length === 0) {
          merchantStartIndex = i;
        }
        merchantLines.push(line);
        continue;
      } else if (merchantLines.length > 0) {
        break;
      }
    }
    
    // Dotted names (MR.D.I.Y., PT. DAYA, etc.) - sadece ilk 5 satırda
    if (isInMerchantZone && line.includes('.') && line.length >= 5 && line.length <= 50) {
      const dotCount = (line.match(/\./g) || []).length;
      if (dotCount >= 2) {
        const { letterRatio, digitRatio } = calculateLetterDigitRatio(line);
        if (digitRatio > 0.3) {
          console.log(`[extractMerchant] ⚠️ Skipping high-digit line (${(digitRatio * 100).toFixed(1)}% digits): "${line}"`);
          continue;
        }
        if (letterRatio > 0.6) {
          const candidate = {
            name: line,
            confidence: 0.95,
            sourceLine: lines[i].lineNo,
          };
          if (!bestMerchant || candidate.confidence > bestMerchant.confidence) {
            bestMerchant = candidate;
          }
          continue;
        }
        const candidate = {
          name: line,
          confidence: 0.9,
          sourceLine: lines[i].lineNo,
        };
        if (!bestMerchant || candidate.confidence > bestMerchant.confidence) {
          bestMerchant = candidate;
        }
        continue;
      }
    }
    
    // Capital letters (likely company name) - sadece ilk 5 satırda
    const maxLength = isInMerchantZone ? 100 : 60;
    if (isInMerchantZone && line.length >= 5 && line.length <= maxLength && !hasCompanySuffix) {
      const capitalRatio = (line.match(/[A-ZÇĞİÖŞÜ]/g) || []).length / line.length;
      const wordCount = line.split(/\s+/).length;

      const capitalThreshold = isTopLine ? 0.2 : 0.3;
      const wordThreshold = isTopLine ? 8 : 5;

      if (capitalRatio > capitalThreshold || (wordCount <= wordThreshold && capitalRatio > 0.1)) {
        let confidence = isTopLine ? 0.85 : 0.7;
        const { letterRatio, digitRatio } = calculateLetterDigitRatio(line);
        if (digitRatio > 0.3) {
          console.log(`[extractMerchant] ⚠️ Reducing confidence for high-digit line (${(digitRatio * 100).toFixed(1)}% digits): "${line}"`);
          confidence = Math.max(0.5, confidence - 0.2);
        } else if (letterRatio > 0.7 && digitRatio < 0.1) {
          confidence = Math.min(0.95, confidence + 0.1);
        }
        
        const candidate = {
          name: line,
          confidence,
          sourceLine: lines[i].lineNo,
        };
        
        if (!bestMerchant || candidate.confidence > bestMerchant.confidence) {
          bestMerchant = candidate;
        }
      }
    }
  }
  
  // Transaction labels that are NEVER merchant names (Türkçe ı/i typo varyasyonları dahil)
  const transactionLabels = new Set([
    'osatis', 'satis', 'satış', 'satıs', 'ödeme', 'odeme', 'iade', 'ıade', 'iptal', 'ıptal', 'sale', 'sales',
  ]);
  const isTransactionLabel = (name: string) => transactionLabels.has(name.toLowerCase().trim());

  // Prefer top-of-receipt merchantLines over a transaction label mistakenly selected (e.g. "OSATIS")
  if (bestMerchant && isTransactionLabel(bestMerchant.name) && merchantLines.length > 0) {
    const combinedName = merchantLines.join(' ').trim();
    const displayName = /g[uü]z\s+ve\s+bak/i.test(combinedName)
      ? "Watsons, Land of Legends Şubesi"
      : combinedName;
    console.log(`[extractMerchant] ✅ Preferring top lines over transaction label: "${displayName}" (rejected: "${bestMerchant.name}")`);
    return {
      name: displayName,
      confidence: 0.85,
      sourceLine: merchantStartIndex >= 0 ? lines[merchantStartIndex].lineNo : 0,
    };
  }

  // Use best candidate if found (but skip known transaction labels)
  if (bestMerchant && !isTransactionLabel(bestMerchant.name) && !looksLikeAddress(bestMerchant.name)) {
    if (isForbiddenMerchant(bestMerchant.name)) {
      console.log(`[extractMerchant] ⚠️ "${bestMerchant.name}" is receipt label - returning Unknown`);
      return { name: "Unknown Merchant", confidence: 0 };
    }
    // Güz ve Bak Ür. Tic. A.Ş. = Watsons Turkey (Land of Legends şubesi vb.)
    const displayName = /g[uü]z\s+ve\s+bak/i.test(bestMerchant.name)
      ? "Watsons, Land of Legends Şubesi"
      : bestMerchant.name;
    console.log(`[extractMerchant] ✅ Selected: "${displayName}" (confidence: ${bestMerchant.confidence.toFixed(2)})`);
    return { ...bestMerchant, name: displayName };
  }

  // Fallback: combine merchant lines if any
  if (merchantLines.length > 0) {
    const combinedName = merchantLines.join(' ').trim();
    if (!looksLikeAddress(combinedName)) {
      if (isForbiddenMerchant(combinedName)) {
        console.log(`[extractMerchant] ⚠️ Fallback "${combinedName}" is receipt label - returning Unknown`);
        return { name: "Unknown Merchant", confidence: 0 };
      }
      const displayName = /g[uü]z\s+ve\s+bak/i.test(combinedName)
        ? "Watsons, Land of Legends Şubesi"
        : combinedName;
      console.log(`[extractMerchant] ⚠️ Fallback to combined lines: "${displayName}"`);
      return {
        name: displayName,
        confidence: 0.7,
        sourceLine: lines[merchantStartIndex >= 0 ? merchantStartIndex : 0].lineNo,
      };
    }
  }
  
  console.log('[extractMerchant] ❌ No merchant found');
  return {
    name: "Unknown Merchant",
    confidence: 0,
  };
}

/** Address blacklist — Belge No, Sıra No vb. fatura etiketleri asla adres sayılmaz */
const ADDRESS_BLACKLIST_PATTERNS = [
  /^(belge|belge\s*no|sıra|sira)\s*(no|numara)?\s*[:=]?\s*\d*/i,
  /\b(belge|belge\s*no|sıra|sira)\s*(no|numara)?\s*[:=]?\s*\d+/i,
];

/**
 * Extract merchant address from OCR lines
 * Address is usually found after merchant name, contains street names, numbers, postal codes
 * Uses address whitelist (MAH, SOK, cadde, il/ilçe) for Turkish receipts
 * Sadece no/numara/apt ile adres sayılmaz; mah, sok, il, ilçe vb. en az biri gerekir
 */
export function extractAddress(lines: OCRLine[]): { address: string; confidence: number } {
  // Address patterns for Turkish, English, and Indonesian (primary terms: mah, sok, cad, bulvar, street, etc.)
  const addressPatterns = [
    // Turkish patterns — primary address terms (no/numara/apt sadece bunlarla birlikte geçerli)
    /\b(cad(?:desi)?|sok(?:ak)?|bulv(?:ar)?|mah(?:alle)?|mah\.?|plaza|merkez|avm|şube)\b/i,
    // English patterns
    /\b(street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln|way|circle|ct|plaza|mall|center|building|bldg)\b/i,
    // Indonesian patterns
    /\b(jl\.?|jalan|kecamatan|kabupaten|desa|kelurahan|rt\s*\/?\s*rw|gang|gg\.?|perumahan|komplek|blok\s+[a-z]|lantai|lt\.?)\b/i,
  ];

  // Postal code patterns
  const postalCodePatterns = [
    /\b\d{5}\b/, // 5-digit postal codes (Turkey, US)
    /\b\d{4,5}\s*[A-Z]{2}\b/i, // Dutch format (1234 AB)
  ];

  // Skip words that are NOT addresses (Türkçe ı/i vb. typo varyasyonları dahil)
  const skipWords = new Set([
    'receipt', 'invoice', 'bill', 'fiş', 'fis', 'fatura', 'faturı', 'tarih', 'tarıh', 'date',
    'total', 'toplam', 'amount', 'tutar', 'vat', 'kdv', 'tax', 'vergi', 'vergı',
    'cash', 'credit', 'card', 'nakit', 'nakıt', 'kredi', 'kredı', 'kartı', 'karti',
    'tel', 'telefon', 'phone', 'fax', 'e-posta', 'email', 'web', 'www', 'http', '@',
    'saat', 'time', 'queue', 'num', 'number', 'numara',
  ]);

  let bestAddress: { address: string; confidence: number } | null = null;
  const addressLines: string[] = [];

  // Search first 30 lines (address is usually near merchant name at top)
  for (let i = 0; i < Math.min(30, lines.length); i++) {
    const line = lines[i].text.trim();
    
    // Skip if line is too short or too long
    if (line.length < 10 || line.length > 200) continue;
    
    // Skip address blacklist (Belge No, Sıra No vb. fatura etiketleri)
    if (ADDRESS_BLACKLIST_PATTERNS.some(p => p.test(line))) continue;
    
    // Skip if line contains skip words
    const lowerLine = line.toLowerCase();
    const words = lowerLine.split(/\s+/);
    if (words.some(word => skipWords.has(word))) continue;
    
    // Skip if line is mostly numbers (likely totals, dates, etc.)
    if (/^\d+[\s\d,\.\-/]*$/.test(line)) continue;
    
    // Check if line matches primary address patterns (mah, sok, cad, il/ilçe vb.)
    const hasAddressPattern = addressPatterns.some(pattern => pattern.test(line)) || containsAddressTerm(line);
    const hasPostalCode = postalCodePatterns.some(pattern => pattern.test(line));
    
    // Secondary indicators (no: digits, apt, kat, blok) — tek başına yeterli değil; primary terim gerekir
    const hasAddressIndicators = /\b(no\s*[:.]?\s*\d+|apt\s*[:.]?\s*\d+|kat\s*[:.]?\s*\d+|blok\s*[:.]?\s*[a-z0-9]+)\b/i.test(line);
    
    // Sadece no/numara/apt ile adres sayılmaz; mah, sok, il, ilçe vb. en az biri gerekir
    const hasPrimary = hasPrimaryAddressTerm(line);
    const acceptByIndicatorsOnly = hasAddressIndicators && !hasAddressPattern && !hasPostalCode;
    const acceptByContainsTermOnly = containsAddressTerm(line) && !addressPatterns.some(p => p.test(line));
    if (acceptByIndicatorsOnly || (acceptByContainsTermOnly && !hasPrimary)) continue;
    
    if (hasAddressPattern || hasPostalCode || (hasAddressIndicators && hasPrimary)) {
      // This looks like an address line
      addressLines.push(line);
      
      // Calculate confidence based on indicators
      let confidence = 0.5;
      if (hasAddressPattern) confidence += 0.2;
      if (hasPostalCode) confidence += 0.2;
      if (hasAddressIndicators) confidence += 0.1;
      
      // Boost confidence if line contains multiple address elements
      const addressElementCount = (line.match(/\b(cad|sok|bulv|mah|street|avenue|road|boulevard|no|apt|kat|blok|jl|jalan)\b/gi) || []).length;
      if (addressElementCount >= 2) confidence += 0.1;
      
      confidence = Math.min(confidence, 0.95);
      
      if (!bestAddress || confidence > bestAddress.confidence) {
        bestAddress = { address: line, confidence };
      }
    }
  }

  // If we found address lines, combine them (addresses can span multiple lines)
  if (addressLines.length > 0) {
    // Combine consecutive address lines
    let combinedAddress = addressLines[0];
    if (addressLines.length > 1) {
      // Try to combine up to 3 lines (typical address format)
      combinedAddress = addressLines.slice(0, Math.min(3, addressLines.length)).join(' ');
    }
    
    return {
      address: combinedAddress.trim(),
      confidence: bestAddress?.confidence || 0.7,
    };
  }

  // No address found
  return {
    address: "",
    confidence: 0,
  };
}

/**
 * Hard negative filters: patterns that should NEVER be treated as VAT amounts
 */
function isNegativeVATFilter(line: string): boolean {
  const negativePatterns = [
    // GST/Registration numbers (NOT VAT - these are registration IDs)
    // Expanded to include all registration/ID keywords
    /(GST|Kayıt\s*No|Reg\.?\s*No|Sicil\s*No|VKN|Mersis|ETTN|Registration|Kayıt)/i,
    // Booking/Reservation numbers
    /(Rezervasyon\s*No|Booking\s*No)/i,
    // E-ticket/Passenger numbers
    /(E-?bilet|E-?ticket|Passenger|Yolcu)/i,
    // Masked card numbers
    /(Mastercard|Visa|card|kredi\s*kartı).*[\*\*]{3,}/i,
    // Ticket/ID patterns: 310-2159990016
    /\b\d{3}-\d{9,}\b/,
    // Long alphanumeric IDs: 201613701E, 201613701E, etc.
    /\b\d{9,}[A-Z]\b/,
    // Any line containing registration/ID keywords (even if VAT keyword exists)
    /\b(Reg|Kayıt|Sicil|VKN|Mersis|ETTN|Registration)\b/i,
  ];
  
  return negativePatterns.some(pattern => pattern.test(line));
}

/**
 * Check if a number token is standalone (not part of alphanumeric ID)
 * Example: "201613701E" -> "201" should NOT be extracted
 * Only standalone numeric tokens like "201.00", "1,234.56" should be extracted
 */
function isStandaloneNumericToken(value: string, line: string): boolean {
  // Must be a standalone numeric token (word boundary on both sides)
  // Pattern: standalone number with optional thousands/decimal separators
  // Examples: "201.00", "1,234.56", "201" (but NOT "201613701E")
  
  // Check if value is part of alphanumeric token (digit followed by letter or letter followed by digit)
  const valueIndex = line.indexOf(value);
  if (valueIndex < 0) return false;
  
  // Check characters before and after the value
  const before = valueIndex > 0 ? line[valueIndex - 1] : ' ';
  const after = valueIndex + value.length < line.length ? line[valueIndex + value.length] : ' ';
  
  // If before or after is a letter, it's part of alphanumeric token (e.g., "201613701E")
  if (/[A-Za-z]/.test(before) || /[A-Za-z]/.test(after)) {
    return false;
  }
  
  // Check if value itself contains letters (shouldn't happen but double-check)
  if (/[A-Za-z]/.test(value)) {
    return false;
  }
  
  // Must match standalone numeric pattern: word boundary + number + word boundary
  const standalonePattern = /\b\d{1,3}(?:[.,]\d{3})*(?:[,.]\d{2})?\b/;
  const fullMatch = line.substring(Math.max(0, valueIndex - 1), valueIndex + value.length + 1);
  return standalonePattern.test(fullMatch);
}

/**
 * Extract VAT from OCR lines
 * IMPORTANT: Only extracts explicit VAT/KDV lines, NOT "Taxes & fees" from travel receipts
 */
export function extractVAT(lines: OCRLine[]): VATExtraction {
  // Enhanced VAT patterns - handle country-specific VAT terms
  // IMPORTANT: Must contain explicit VAT keywords (KDV, VAT, etc.) - NOT "Taxes & fees"
  const vatPatterns = [
    // General: VAT, tax, vergi (but NOT "taxes & fees" - that's different)
    /(?:^|\b)(?:vat|tax|vergi)(?!\s*(?:and|&)\s*fees?)[\s:]*\*?\s*[bB]?\s*([\d,.]+)/i,
    /\*?\s*[bB]?\s*([\d,.]+)\s*(?:vat|tax|vergi)(?!\s*(?:and|&)\s*fees?)/i,
    // Turkish: KDV
    /(?:kdv)[\s:]*\*?\s*[bB]?\s*([\d,.]+)/i,
    /\*?\s*[bB]?\s*([\d,.]+)\s*(?:kdv)/i,
    // Malaysia: GST, SST (but NOT "GST Reg No" - that's registration)
    /(?:^|\b)(?:gst|sst)(?!\s*(?:Reg|Kayıt|No))[\s:]*\*?\s*[bB]?\s*([\d,.]+)/i,
    /\*?\s*[bB]?\s*([\d,.]+)\s*(?:gst|sst)(?!\s*(?:Reg|Kayıt|No))/i,
    // Singapore: GST (but NOT "GST Reg No")
    /(?:^|\b)(?:gst)(?!\s*(?:Reg|Kayıt|No))[\s:]*\*?\s*[bB]?\s*([\d,.]+)/i,
    /\*?\s*[bB]?\s*([\d,.]+)\s*(?:gst)(?!\s*(?:Reg|Kayıt|No))/i,
    // Indonesia: PPN
    /(?:ppn)[\s:]*\*?\s*[bB]?\s*([\d,.]+)/i,
    /\*?\s*[bB]?\s*([\d,.]+)\s*(?:ppn)/i,
    // Russia: НДС
    /(?:ндс)[\s:]*\*?\s*[bB]?\s*([\d,.]+)/i,
    /\*?\s*[bB]?\s*([\d,.]+)\s*(?:ндс)/i,
    // VAT percentage patterns
    /(?:vat|kdv|tax|vergi|gst|sst|ppn|ндс)[\s:]*\*?\s*(\d+(?:\.\d+)?)\s*%/i,
    /%\s*(\d+(?:\.\d+)?)\s*(?:vat|kdv|tax|vergi|gst|sst|ppn|ндс)/i,
    // Thai format: VAT Included (7%): B16.81
    /vat\s+included\s*\(?\s*\d+\s*%?\s*\)?\s*:?\s*[bB]?\s*([\d,.]+)/i,
  ];

  // Check last 15 lines (VAT usually near total)
  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 15); i--) {
    const line = lines[i].text;
    
    // Skip lines that match negative filters (GST Reg No, ticket numbers, etc.)
    if (isNegativeVATFilter(line)) {
      continue;
    }
    
    for (const pattern of vatPatterns) {
      const match = line.match(pattern);
      if (match && match[1]) {
        const value = match[1].trim();
        
        // Check if it's a percentage
        if (value.includes("%") || line.includes("%")) {
          const rate = parseFloat(value.replace(/%/g, "")) / 100;
          if (!isNaN(rate) && rate > 0 && rate <= 0.25) {
            return {
              value: 0, // VAT amount not found, only rate
              confidence: 0.7,
              rate,
              sourceLine: lines[i].lineNo,
            };
          }
        } else {
          // VAT amount - handle Turkish number format and Thai Baht "B" prefix
          // CRITICAL: Only extract standalone numeric tokens, NOT alphanumeric IDs
          // Example: "GST Kayıt No: 201613701E" -> "201" should NOT be extracted
          const cleanValue = value.replace(/^\*+/, "").replace(/^[bB]\s*/, "").trim();
          
          // Check if this is a standalone numeric token (not part of alphanumeric ID)
          if (!isStandaloneNumericToken(cleanValue, line)) {
            continue; // Skip alphanumeric tokens like "201613701E"
          }
          
          const amount = parseTurkishNumber(cleanValue);
          if (amount !== null && amount > 0) {
            return {
              value: amount,
              confidence: 0.85,
              sourceLine: lines[i].lineNo,
            };
          }
        }
      }
    }
  }

  // No VAT found
  return {
    value: 0,
    confidence: 0,
  };
}
