/**
 * Vietnam (VN) country configuration
 * Contains all Vietnam-specific patterns and settings for receipt parsing
 * Notes: VAT: 10% standard (with 8% reduced categories), Language uses đ or VND
 */

import type { CountryConfig } from "./base";

export const VN_CONFIG: CountryConfig = {
  code: "VN",
  detection: {
    countryIndicators: [
      /\bVietnam\b/i,
      /\bViet Nam\b/i,
      /\bVN\b/
    ],
    currencyIndicators: [
      /đ\b/,
      /\bVND\b/i,
      /\b₫/
    ],
    taxIdIndicators: [
      /\bMST\b/,
      /\bTax Code\b/i
    ]
  },
  currency: {
    code: "VND",
    symbol: "₫",
    keywords: ["₫", "VND", "đ"]
  },
  dateTime: {
    datePatterns: [
      /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/,
      /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/
    ],
    timePatterns: [
      /\b(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\b/
    ]
  },
  numberFormat: {
    decimalSeparators: [","],
    thousandSeparators: ["."]
  },
  labels: {
    total: ["TỔNG CỘNG", "TOTAL", "AMOUNT DUE"],
    vat: ["VAT", "THUẾ GTGT", "GTGT", "VAT 10%"],
    subtotal: ["TẠM TÍNH", "SUBTOTAL"],
    service: ["PHỤC VỤ", "SERVICE CHARGE"],
    discount: ["GIẢM GIÁ", "DISCOUNT"],
    tenderCash: ["TIỀN MẶT", "CASH"],
    tenderCard: ["THẺ", "CARD", "VISA", "MASTERCARD"],
    change: ["TIỀN THỪA", "CHANGE"],
    merchantId: ["MST"],
    branchId: ["CHI NHÁNH", "BRANCH"]
  },
  vatKeywords: ["VAT", "THUẾ GTGT", "GTGT", "VAT 10%"],
  tax: {
    model: "vat",
    defaultRate: 0.10,
    separateLine: true
  },
  layoutHints: {
    rightAlignedTotals: true,
    allowQrCodes: true
  },
  screenshotIndicators: [
    "MoMo",
    "ZaloPay",
    "VNPay",
    "ShopeePay",
    "GrabPay"
  ]
};

export default VN_CONFIG;
