/**
 * United States (US) country configuration
 * Contains all US-specific patterns and settings for receipt parsing
 * Notes: No VAT, only Sales Tax. Sales tax varies by state.
 */

import type { CountryConfig } from "./base";

export const US_CONFIG: CountryConfig = {
  code: "US",
  detection: {
    countryIndicators: [
      /\bUSA\b/i,
      /\bUnited States\b/i,
      /\bUS\b/
    ],
    currencyIndicators: [
      /\$\s?\d/,
      /\bUSD\b/i
    ],
    taxIdIndicators: [
      /\bEIN\b/i
    ]
  },
  currency: {
    code: "USD",
    symbol: "$",
    keywords: ["$", "USD"]
  },
  dateTime: {
    datePatterns: [
      // MM/DD/YYYY or MM-DD-YYYY
      /\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/,
      // YYYY-MM-DD
      /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/
    ],
    timePatterns: [
      // 12h + 24h
      /\b(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s?(AM|PM|am|pm)?\b/
    ]
  },
  numberFormat: {
    decimalSeparators: ["."],
    thousandSeparators: [","]
  },
  labels: {
    total: ["TOTAL", "AMOUNT DUE", "AMOUNT", "GRAND TOTAL"],
    vat: ["SALES TAX", "TAX"], // no VAT, just generic
    subtotal: ["SUBTOTAL", "SUB TOTAL"],
    service: ["SERVICE CHARGE", "SERVICE FEE", "GRATUITY"],
    discount: ["DISCOUNT", "COUPON", "PROMO"],
    tenderCash: ["CASH"],
    tenderCard: ["CARD", "CREDIT", "DEBIT", "VISA", "MASTERCARD", "AMEX"],
    change: ["CHANGE"],
    merchantId: ["EIN"],
    branchId: ["STORE", "LOCATION"]
  },
  vatKeywords: ["SALES TAX", "TAX"],
  tax: {
    model: "sales_tax",
    separateLine: true
  },
  layoutHints: {
    rightAlignedTotals: true,
    allowQrCodes: false
  },
  screenshotIndicators: [
    "Apple Pay",
    "Google Wallet",
    "Square Receipt",
    "ToastTab"
  ]
};

export default US_CONFIG;
