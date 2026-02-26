/**
 * Dynamic breakdown allocation using Dirichlet sampling
 */

import type { SuperCategory } from "./categoryMap";
import { getBreakdownItems } from "./breakdownDictionary";
import { sampleDirichlet, applyConstraints, SeededRNG } from "./dirichlet";
import type { ReceiptSummary } from "@/lib/insights/types";
import { generateTravelBreakdown, type TravelBreakdownInputs } from "./travelBreakdown";
import { generateHospitalityBreakdown, type HospitalityBreakdownInputs } from "./hospitalityBreakdown";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface BreakdownItem {
  label: string;
  description: string;
  layerKey: "store_ops" | "supply_chain" | "retail_brand" | "state";
  estimate: number;
  low: number;
  high: number;
  pctOfHiddenCostCore: number;
  confidence: ConfidenceLevel;
  reasons: string[];
}

export interface BreakdownResult {
  layers: {
    "Store & Operations": BreakdownItem[];
    "Supply Chain & Journey": BreakdownItem[];
    "Retail & Brand Layer": BreakdownItem[];
    "State Layer (On Receipt)": BreakdownItem[];
  };
  summary: string;
}

/**
 * Allocate hidden cost core into breakdown items
 */
export function allocateBreakdown(
  hiddenCostCore: number,
  superCategory: SuperCategory,
  context: {
    receiptId: string;
    date: string;
    merchantId?: string;
    merchantName: string;
    country: string;
    merchantVolatility?: number;
    categoryTrend?: number;
  },
  vatAmount?: number,
  vatOnReceipt?: boolean, // true if VAT is explicitly shown on receipt, false if estimated/calculated
  travelInputs?: TravelBreakdownInputs, // Optional travel-specific inputs
  hospitalityInputs?: HospitalityBreakdownInputs // Optional hospitality-specific inputs
): BreakdownResult {
  // Handle travel_mobility category with specialized breakdown
  if (superCategory === "travel_mobility" && travelInputs) {
    const travelResult = generateTravelBreakdown(travelInputs);
    
    // For travel, use travel breakdown's hiddenCostCore (overrides the passed hiddenCostCore)
    // This ensures consistency: hiddenCostCore = paidExTax - baseTransportValue
    const travelHiddenCostCore = travelResult.hiddenCostCore;
    
    // Convert travel breakdown to BreakdownResult format
    const convertTravelBucket = (bucket: typeof travelResult.baseTransportValue, layerKey: BreakdownItem["layerKey"]): BreakdownItem => {
      // Calculate percentage of hiddenCostCore (not paidTotal) for hidden cost items
      // State layer items use percentOfPaidTotal
      const pct = layerKey === "state" 
        ? bucket.percentOfPaidTotal 
        : (travelHiddenCostCore > 0 ? (bucket.amount / travelHiddenCostCore) * 100 : 0);
      
      return {
        label: bucket.label,
        description: "",
        layerKey,
        estimate: bucket.amount,
        low: bucket.amount * (bucket.estimated ? 0.85 : 1.0),
        high: bucket.amount * (bucket.estimated ? 1.15 : 1.0),
        pctOfHiddenCostCore: Math.round(pct * 10) / 10,
        confidence: bucket.estimated ? "medium" : "high",
        reasons: bucket.reasons,
      };
    };

    return {
      layers: {
        "Store & Operations": [
          convertTravelBucket(travelResult.operationalAndInfrastructure, "store_ops"),
        ],
        "Supply Chain & Journey": [
          convertTravelBucket(travelResult.baseTransportValue, "supply_chain"),
          convertTravelBucket(travelResult.fuelAndEnergy, "supply_chain"),
        ],
        "Retail & Brand Layer": [
          convertTravelBucket(travelResult.operatorMargin, "retail_brand"),
          convertTravelBucket(travelResult.distributionAndSales, "retail_brand"),
          convertTravelBucket(travelResult.riskAndCompliance, "retail_brand"),
        ],
        "State Layer (On Receipt)": travelResult.stateLayerOnTicket.amount > 0 ? [
          convertTravelBucket(travelResult.stateLayerOnTicket, "state"),
        ] : [],
      },
      summary: "Travel breakdown with dynamic adjustments based on distance, operator type, and channel.",
    };
  }

  // Handle hospitality_lodging category with specialized breakdown
  if (superCategory === "hospitality_lodging" && hospitalityInputs) {
    const hospitalityResult = generateHospitalityBreakdown(hospitalityInputs);
    
    // For hospitality, use hospitality breakdown's hiddenCostCore (overrides the passed hiddenCostCore)
    // This ensures consistency: hiddenCostCore = paidExTax - baseStayValue
    const hospitalityHiddenCostCore = hospitalityResult.hiddenCostCore;
    
    // Convert hospitality breakdown to BreakdownResult format
    const convertHospitalityBucket = (bucket: typeof hospitalityResult.baseStayValue, layerKey: BreakdownItem["layerKey"]): BreakdownItem => {
      // Calculate percentage of hiddenCostCore (not paidTotal) for hidden cost items
      // State layer items use percentOfPaidTotal
      const pct = layerKey === "state" 
        ? bucket.percentOfPaidTotal 
        : (hospitalityHiddenCostCore > 0 ? (bucket.amount / hospitalityHiddenCostCore) * 100 : 0);
      
      return {
        label: bucket.label,
        description: "",
        layerKey,
        estimate: bucket.amount,
        low: bucket.amount * (bucket.estimated ? 0.85 : 1.0),
        high: bucket.amount * (bucket.estimated ? 1.15 : 1.0),
        pctOfHiddenCostCore: Math.round(pct * 10) / 10,
        confidence: bucket.estimated ? "medium" : "high",
        reasons: bucket.reasons,
      };
    };

    return {
      layers: {
        "Store & Operations": [
          convertHospitalityBucket(hospitalityResult.propertyAndFacilities, "store_ops"),
          convertHospitalityBucket(hospitalityResult.staffAndService, "store_ops"),
          convertHospitalityBucket(hospitalityResult.utilitiesAndMaintenance, "store_ops"),
          convertHospitalityBucket(hospitalityResult.housekeepingAndLaundry, "store_ops"),
        ],
        "Supply Chain & Journey": [
          convertHospitalityBucket(hospitalityResult.baseStayValue, "supply_chain"),
          convertHospitalityBucket(hospitalityResult.amenitiesAndConsumables, "supply_chain"),
        ],
        "Retail & Brand Layer": [
          convertHospitalityBucket(hospitalityResult.distributionAndOTACommission, "retail_brand"),
          convertHospitalityBucket(hospitalityResult.paymentAndFXFees, "retail_brand"),
          convertHospitalityBucket(hospitalityResult.brandMarketingLoyalty, "retail_brand"),
          convertHospitalityBucket(hospitalityResult.operatorMargin, "retail_brand"),
        ],
        "State Layer (On Receipt)": [
          convertHospitalityBucket(hospitalityResult.stateLayerOnInvoice, "state"),
        ],
      },
      summary: "Hospitality breakdown with dynamic adjustments based on subtype, channel, stay length, and season.",
    };
  }

  const items = getBreakdownItems(superCategory);
  const seed = `${context.receiptId}-${context.date}-${context.merchantId || context.merchantName}`;

  // Build alpha vector
  let alphas = items.map(item => item.alphaBase);

  // Adjust alphas based on signals
  if (context.merchantVolatility && context.merchantVolatility > 0.15) {
    // High volatility -> increase dispersion (lower concentration)
    alphas = alphas.map(alpha => alpha * 0.85);
  }

  if (context.categoryTrend && context.categoryTrend > 0.05) {
    // Positive trend -> shift slightly towards supply_chain and store_ops
    alphas = alphas.map((alpha, i) => {
      const item = items[i];
      if (item.layerKey === "supply_chain" || item.layerKey === "store_ops") {
        return alpha * 1.1;
      }
      return alpha;
    });
  }

  // Sample Dirichlet weights
  let weights = sampleDirichlet(alphas, seed);

  // Apply soft constraints
  const minShares = items.map(item => item.minShare ?? 0);
  const maxShares = items.map(item => item.maxShare ?? 1);
  weights = applyConstraints(weights, minShares, maxShares);

  // Convert to amounts
  const amounts = weights.map(w => w * hiddenCostCore);

  // Fix rounding and ensure sum equals hiddenCostCore
  const total = amounts.reduce((a, b) => a + b, 0);
  const diff = hiddenCostCore - total;
  
  // Distribute rounding error deterministically
  if (Math.abs(diff) > 0.01) {
    const adjustment = diff / amounts.length;
    for (let i = 0; i < amounts.length; i++) {
      amounts[i] += adjustment;
    }
  }

  // Ensure no repeated identical amounts (within 0.01 tolerance)
  const roundedAmounts = amounts.map(a => Math.round(a * 100) / 100);
  const uniqueAmounts = new Set(roundedAmounts);
  
  if (uniqueAmounts.size < roundedAmounts.length) {
    // Collisions detected - distribute +0.01/-0.01 deterministically
    const rng = new SeededRNG(seed + "-adjust");
    for (let i = 0; i < amounts.length; i++) {
      const rounded = roundedAmounts[i];
      const count = roundedAmounts.filter(a => Math.abs(a - rounded) < 0.01).length;
      if (count > 1) {
        // Add small deterministic adjustment
        const adjustment = (rng.next() - 0.5) * 0.02; // ±0.01
        amounts[i] += adjustment;
      }
    }
    
    // Re-normalize to ensure sum
    const newTotal = amounts.reduce((a, b) => a + b, 0);
    if (newTotal > 0) {
      const scale = hiddenCostCore / newTotal;
      for (let i = 0; i < amounts.length; i++) {
        amounts[i] *= scale;
      }
    }
  }

  // Calculate volatility coefficient for uncertainty ranges
  const volatilityCoeff = Math.min(0.35, Math.max(0.10, (context.merchantVolatility || 0.15) * 2));

  // If VAT is not on receipt (estimated), it should be included in hidden cost total
  // Calculate adjusted total for percentage calculations
  let adjustedHiddenCostCore = hiddenCostCore;
  if (vatAmount && vatAmount > 0 && !vatOnReceipt) {
    adjustedHiddenCostCore = hiddenCostCore + vatAmount;
  }

  // Build breakdown items with ranges
  // Use adjustedHiddenCostCore if VAT was added, otherwise use original hiddenCostCore
  const totalForPct = adjustedHiddenCostCore;
  const breakdownItems: BreakdownItem[] = items.map((item, i) => {
    const estimate = Math.max(0, amounts[i]);
    const low = Math.max(0, estimate * (1 - volatilityCoeff));
    const high = estimate * (1 + volatilityCoeff);
    const pct = totalForPct > 0 ? (estimate / totalForPct) * 100 : 0;

    // Determine confidence
    let confidence: ConfidenceLevel = "medium";
    if (volatilityCoeff < 0.15) {
      confidence = "high";
    } else if (volatilityCoeff > 0.25) {
      confidence = "low";
    }

    return {
      label: item.label,
      description: item.description,
      layerKey: item.layerKey,
      estimate: Math.round(estimate * 100) / 100,
      low: Math.round(low * 100) / 100,
      high: Math.round(high * 100) / 100,
      pctOfHiddenCostCore: Math.round(pct * 10) / 10,
      confidence,
      reasons: [
        `alpha=${item.alphaBase.toFixed(2)}`,
        `volatility=${volatilityCoeff.toFixed(2)}`,
      ],
    };
  });

  // If VAT is not on receipt (estimated/calculated), add it to hidden cost breakdown
  if (vatAmount && vatAmount > 0 && !vatOnReceipt) {
    // Add VAT as a hidden cost item (government bucket)
    const vatItem: BreakdownItem = {
      label: "VAT (Estimated)",
      description: "Estimated value added tax (not shown on receipt)",
      layerKey: "state", // Still use state layerKey for consistency, but it will be in hidden cost
      estimate: vatAmount,
      low: vatAmount * 0.9, // ±10% uncertainty for estimated VAT
      high: vatAmount * 1.1,
      pctOfHiddenCostCore: hiddenCostCore > 0 ? (vatAmount / (hiddenCostCore + vatAmount)) * 100 : 0,
      confidence: "medium",
      reasons: ["estimated.vat", "not.on.receipt"],
    };
    breakdownItems.push(vatItem);
    
    // Adjust hiddenCostCore to include estimated VAT
    // Note: This is handled at the caller level, we just add the item here
  }

  // Group by layer
  const storeOps = breakdownItems.filter(item => item.layerKey === "store_ops");
  const supplyChain = breakdownItems.filter(item => item.layerKey === "supply_chain");
  const retailBrand = breakdownItems.filter(item => item.layerKey === "retail_brand");
  
  // State layer (VAT from receipt, informational only - NOT part of hidden cost)
  const stateLayer: BreakdownItem[] = [];
  if (vatAmount && vatAmount > 0 && vatOnReceipt) {
    stateLayer.push({
      label: "VAT (on receipt)",
      description: "Value added tax shown on receipt",
      layerKey: "state",
      estimate: vatAmount,
      low: vatAmount,
      high: vatAmount,
      pctOfHiddenCostCore: 0, // Not part of hidden cost core
      confidence: "high",
      reasons: ["from.receipt"],
    });
  }

  // Generate summary
  const summary = "This estimate uses recent merchant/category trends and volatility. Numbers can change over time.";

  return {
    layers: {
      "Store & Operations": storeOps,
      "Supply Chain & Journey": supplyChain,
      "Retail & Brand Layer": retailBrand,
      "State Layer (On Receipt)": stateLayer,
    },
    summary,
  };
}

