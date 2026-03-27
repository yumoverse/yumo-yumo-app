export {
  extractCanonicalFromVision,
  parseGeminiLineItemsFromReceiptData,
  parseStructuredLineItemsFromReceiptData,
  allocateLinePricesWhenMissing,
} from "./extract-canonical";
export { resolveCanonicalObservations } from "./resolve-canonical-product";
export type {
  ExtractCanonicalContext,
  GeminiStructuredLineItem,
  GeminiStructuredLineUnitType,
  VisionResponseLike,
} from "./extract-canonical";
export {
  computeLineHiddenCosts,
  fetchProductionCostWeights,
  fetchEconomicIndexMultipliers,
  fetchTaxonomyBulk,
} from "./line-hidden-cost";
export type {
  ComputeLineHiddenCostInput,
  LineHiddenCostResult,
  ProductionCostWeightsRow,
  EconomicIndexMultipliers,
  TaxonomyRow,
} from "./line-hidden-cost";
export type { HiddenCostModelType } from "@/lib/mining/types";
export type { CanonicalPayload, CanonicalObservation, CanonicalMerchant } from "../canonical-types";
