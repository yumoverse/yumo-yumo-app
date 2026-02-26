/**
 * Insights data model types
 */

export type ConfidenceLevel = "verified" | "low" | "rejected";

export interface ReceiptSummary {
  id: string;
  merchantName: string;
  country: string;
  currency: string;
  date: string; // ISO date string (YYYY-MM-DD)
  time?: string; // Time string (HH:MM format, optional)
  totalPaid: number;
  taxAmount?: number;
  paidExTax: number;
  hiddenCostCore: number;
  importSystemCost: number;
  retailHiddenCost: number;
  productValue: number;
  confidence: ConfidenceLevel;
  category?: string;
}

export interface TimeSeriesPoint {
  date: string; // ISO date string
  spend: number;
  hiddenCostCore: number;
  productValue: number;
  taxAmount: number;
}

export interface MerchantStats {
  merchantName: string;
  receiptCount: number;
  totalHiddenCostCore: number;
  avgHiddenPercent: number;
  totalSpend: number;
  transparencyScore?: number;
}

export interface CategoryStats {
  category: string;
  receiptCount: number;
  totalHiddenCostCore: number;
  avgHiddenPercent: number;
}

export interface TrustCounts {
  verified: number;
  low: number;
  rejected: number;
  total: number;
}

export interface InsightsAggregate {
  // Totals
  totalSpend: number;
  totalPaidExTax: number;
  totalHiddenCostCore: number;
  totalProductValue: number;
  totalTaxAmount: number;
  totalImportSystemCost: number;
  totalRetailHiddenCost: number;
  
  // Rates
  hiddenCostCoreRate: number; // percentage
  confidenceCoverage: number; // percentage of verified receipts
  
  // Time series
  timeSeries: TimeSeriesPoint[];
  
  // Aggregates
  merchantStats: MerchantStats[];
  categoryStats: CategoryStats[];
  
  // Trust
  trustCounts: TrustCounts;
  
  // Baselines (for transparency scoring)
  categoryBaselines: Record<string, number>; // category -> avg hidden %
  countryBaselines: Record<string, number>; // country -> avg hidden %
}

export interface InsightsFilters {
  timeRange?: "7d" | "30d" | "90d" | "all";
  country?: string;
  currency?: string;
  category?: string;
  merchant?: string;
}

