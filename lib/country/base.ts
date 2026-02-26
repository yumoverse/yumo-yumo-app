/**
 * Country configuration base interface
 * Defines the structure for country-specific receipt parsing configurations
 */

export interface CountryConfig {
  code: "TR" | "TH" | "ID" | "GENERIC" | "TW" | "AE" | "IN" | "US" | "CA" | "MX" | "BR" | "PH" | "VN" | "SG" | "MY" | "ZA" | "NG" | "RU" | "UA" | "KZ" | "CN";

  detection: {
    countryIndicators: RegExp[];
    currencyIndicators: RegExp[];
    taxIdIndicators?: RegExp[];
  };

  currency: {
    code: string;           // "TRY" | "THB"
    symbol: string;         // "₺"  | "฿"
    keywords: string[];     // ["TL","TRY","₺"] | ["THB","฿"]
  };

  dateTime: {
    datePatterns: RegExp[];       // DD/MM/YYYY etc
    isoPatterns?: RegExp[];        // YYYY-MM-DD etc
    shortPatterns?: RegExp[];      // DD/MM/YY etc
    timePatterns: RegExp[];       // HH:MM, HH.MM, HH-MM
    /** Textual month-first (e.g. Feb 1 2026, Feb 1, 2026); capture groups: (monthName, day, year) */
    textualMonthFirstPatterns?: RegExp[];

    // Buddhist year support (TH only)
    useBuddhistCalendar?: boolean;
    buddhistOffset?: number;      // 543 for TH
    buddhistThreshold?: number;   // >= 2400 → treat as BE

    // ROC calendar support (TW only)
    rocCalendar?: {
      enabled: boolean;
      convert: (y: number) => number; // ROC year to Gregorian
    };

    // Hijri calendar support (AE only)
    hijriPatterns?: RegExp[];
    hijriConversion?: {
      enabled: boolean;
      approxConvertToGregorian: (hy: number) => number;
    };
  };

  numberFormat: {
    decimalSeparators: string[];
    thousandSeparators: string[];
    parseFunction?: (text: string) => number | null;
    compactNumbering?: {
      enabled: boolean;
      patterns: RegExp[];
      convert: (value: number, unit: string) => number;
    };
  };

  labels: {
    total: string[];
    vat: string[];
    subtotal: string[];
    service: string[];
    discount: string[];
    tenderCash: string[];
    tenderCard: string[];
    change: string[];
    merchantId: string[];
    branchId: string[];
    invoiceCode?: string[];
    invoiceNumber?: string[];
    upi?: string[];
  };

  // VAT keywords for pattern generation (used in VAT extraction)
  // These are used to generate patterns like "PPN : 842" or "PPN 842"
  vatKeywords: string[];

  // VAT configuration
  vat?: {
    defaultRate: number;
    separateLine: boolean;
  };

  // GST configuration (India)
  gst?: {
    model: "dual";
    components: string[];
    extractComponents: boolean;
  };

  // Tax configuration (for US, CA, MX, BR, PH, VN, SG, MY, ZA, KZ, CN)
  tax?: {
    model: "vat" | "sales_tax" | "multi_component" | "gst" | "sst" | "vat_optional" | "vat_required";
    defaultRate?: number;
    separateLine?: boolean;
    components?: string[];
    extractComponents?: boolean;
    allowNoVat?: boolean;
  };

  layoutHints?: {
    rightAlignedTotals?: boolean;
    maxBottomLines?: number;
    allowQrCodes?: boolean;
    qrInvoiceDetection?: boolean;
  };

  // Screenshot indicators for digital wallet receipts
  screenshotIndicators?: string[];

  // Digital receipt configuration (for NG, KZ, CN and similar)
  digitalReceipts?: {
    acceptedVendors: string[];
    allowNonScreenshotEmail?: boolean;
    requireTransactionId?: boolean;
  };

  // Payment channels (for CN and similar)
  paymentChannels?: {
    alipay?: RegExp[];
    wechat?: RegExp[];
    unionpay?: RegExp[];
    [key: string]: RegExp[] | undefined;
  };

  // Invoice types (for CN Fapiao and similar)
  invoiceTypes?: string[];
}
