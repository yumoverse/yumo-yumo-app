/**
 * Category-based breakdown items
 * Different categories show different cost items
 */

export interface BreakdownItem {
  label: string;
  description?: string;
  bucket: "store" | "supply" | "retail" | "government";
}

export interface CategoryBreakdown {
  store: BreakdownItem[];
  supply: BreakdownItem[];
  retail: BreakdownItem[];
  government: BreakdownItem[];
}

const categoryBreakdowns: Record<string, CategoryBreakdown> = {
  grocery: {
    store: [
      { label: "Store Rent", description: "Store location costs", bucket: "store" },
      { label: "Staff Costs", description: "Wages and salaries", bucket: "store" },
      { label: "Utilities", description: "Electricity, heating, water", bucket: "store" },
      { label: "Cleaning & Maintenance", description: "Store upkeep", bucket: "store" },
      { label: "Shrink & Losses", description: "Spoilage, theft, damage", bucket: "store" },
      { label: "Licenses & Local Fees", description: "Operating permits", bucket: "store" },
    ],
    supply: [
      { label: "Local Transport", description: "Local logistics", bucket: "supply" },
      { label: "Storage / Cold Chain", description: "Warehouse and refrigeration", bucket: "supply" },
    ],
    retail: [
      { label: "Retail Margin", description: "Store's profit margin", bucket: "retail" },
    ],
    government: [],
  },
  produce: {
    store: [
      { label: "Store Rent", description: "Store location costs", bucket: "store" },
      { label: "Staff Costs", description: "Wages and salaries", bucket: "store" },
      { label: "Utilities", description: "Electricity, heating, water", bucket: "store" },
      { label: "Shrink & Losses", description: "Spoilage, theft, damage", bucket: "store" },
    ],
    supply: [
      { label: "Local Transport", description: "Local logistics", bucket: "supply" },
      { label: "Storage / Cold Chain", description: "Warehouse and refrigeration", bucket: "supply" },
    ],
    retail: [
      { label: "Retail Margin", description: "Store's profit margin", bucket: "retail" },
    ],
    government: [],
  },
  butcher: {
    store: [
      { label: "Store Rent", description: "Store location costs", bucket: "store" },
      { label: "Staff Costs", description: "Wages and salaries", bucket: "store" },
      { label: "Utilities", description: "Electricity, heating, water", bucket: "store" },
      { label: "Shrink & Losses", description: "Spoilage, theft, damage", bucket: "store" },
    ],
    supply: [
      { label: "Local Transport", description: "Local logistics", bucket: "supply" },
      { label: "Storage / Cold Chain", description: "Warehouse and refrigeration", bucket: "supply" },
    ],
    retail: [
      { label: "Retail Margin", description: "Store's profit margin", bucket: "retail" },
    ],
    government: [],
  },
  restaurant: {
    store: [
      { label: "Shop Rent", description: "Store location costs", bucket: "store" },
      { label: "Staff Costs", description: "Wages and salaries", bucket: "store" },
      { label: "Utilities", description: "Electricity, heating, water", bucket: "store" },
      { label: "Licensing", description: "Operating permits", bucket: "store" },
    ],
    supply: [
      { label: "Ingredient Sourcing", description: "Local ingredient sourcing", bucket: "supply" },
    ],
    retail: [
      { label: "Restaurant Margin", description: "Restaurant profit margin", bucket: "retail" },
    ],
    government: [],
  },
  cafe: {
    store: [
      { label: "Shop Rent", description: "Store location costs", bucket: "store" },
      { label: "Staff Costs", description: "Wages and salaries", bucket: "store" },
      { label: "Utilities", description: "Electricity, heating, water", bucket: "store" },
      { label: "Licensing", description: "Operating permits", bucket: "store" },
    ],
    supply: [
      { label: "Ingredient Sourcing", description: "Local ingredient sourcing", bucket: "supply" },
    ],
    retail: [
      { label: "Cafe Margin", description: "Cafe profit margin", bucket: "retail" },
    ],
    government: [],
  },
  fashion: {
    store: [
      { label: "Shop Rent", description: "Store location costs", bucket: "store" },
      { label: "Staff Costs", description: "Wages and salaries", bucket: "store" },
    ],
    supply: [
      { label: "Import & Customs", description: "Import and customs", bucket: "supply" },
      { label: "Distribution", description: "Distribution network", bucket: "supply" },
    ],
    retail: [
      { label: "Brand Margin", description: "Brand margin", bucket: "retail" },
      { label: "Marketing & Promotion", description: "Marketing and promotion", bucket: "retail" },
      { label: "Returns & Waste", description: "Returns and waste", bucket: "retail" },
    ],
    government: [],
  },
  apparel: {
    store: [
      { label: "Shop Rent", description: "Store location costs", bucket: "store" },
      { label: "Staff Costs", description: "Wages and salaries", bucket: "store" },
    ],
    supply: [
      { label: "Import & Customs", description: "Import and customs", bucket: "supply" },
      { label: "Distribution", description: "Distribution network", bucket: "supply" },
    ],
    retail: [
      { label: "Brand Margin", description: "Brand margin", bucket: "retail" },
      { label: "Marketing & Promotion", description: "Marketing and promotion", bucket: "retail" },
      { label: "Returns & Waste", description: "Returns and waste", bucket: "retail" },
    ],
    government: [],
  },
  electronics: {
    store: [],
    supply: [
      { label: "Import & Customs", description: "Import and customs", bucket: "supply" },
      { label: "Distribution", description: "Distribution network", bucket: "supply" },
      { label: "Warranty & Returns", description: "Warranty and returns", bucket: "supply" },
    ],
    retail: [
      { label: "Retail Margin", description: "Store's profit margin", bucket: "retail" },
    ],
    government: [],
  },
  pharmacy: {
    store: [
      { label: "Shop Rent", description: "Store location costs", bucket: "store" },
      { label: "Staff (Licensed)", description: "Licensed staff wages", bucket: "store" },
    ],
    supply: [
      { label: "Distribution", description: "Distribution network", bucket: "supply" },
      { label: "Storage", description: "Special storage requirements", bucket: "supply" },
    ],
    retail: [
      { label: "Regulated Margin", description: "Regulated margin (low)", bucket: "retail" },
    ],
    government: [],
  },
  fuel: {
    store: [
      { label: "Station Operation Costs", description: "Station operation costs", bucket: "store" },
    ],
    supply: [
      { label: "Distribution", description: "Distribution network", bucket: "supply" },
    ],
    retail: [],
    government: [],
  },
  hotel: {
    store: [
      { label: "Property Rent", description: "Property rent", bucket: "store" },
      { label: "Staff Costs", description: "Wages and salaries", bucket: "store" },
      { label: "Utilities", description: "Electricity, heating, water", bucket: "store" },
    ],
    supply: [
      { label: "Booking Platform Cut", description: "Booking platform fees", bucket: "supply" },
      { label: "Supplies", description: "Consumables", bucket: "supply" },
    ],
    retail: [
      { label: "Hotel Margin", description: "Hotel profit margin", bucket: "retail" },
    ],
    government: [],
  },
  utilities: {
    store: [
      { label: "Distribution & Grid", description: "Network and distribution costs", bucket: "store" },
      { label: "Metering & Billing", description: "Metering and billing operations", bucket: "store" },
    ],
    supply: [
      { label: "Supply", description: "Energy/water supply", bucket: "supply" },
    ],
    retail: [
      { label: "Provider Margin", description: "Utility provider margin", bucket: "retail" },
    ],
    government: [],
  },
  other: {
    store: [
      { label: "Shop Rent", description: "Store location costs", bucket: "store" },
      { label: "Staff Costs", description: "Wages and salaries", bucket: "store" },
    ],
    supply: [
      { label: "Distribution", description: "Distribution network", bucket: "supply" },
    ],
    retail: [
      { label: "Retail Margin", description: "Store's profit margin", bucket: "retail" },
    ],
    government: [],
  },
};

/**
 * Get breakdown items for a category
 */
export function getCategoryBreakdown(category?: string | null): CategoryBreakdown {
  if (!category) {
    return categoryBreakdowns.other;
  }

  const normalized = category.toLowerCase().trim();
  return categoryBreakdowns[normalized] || categoryBreakdowns.other;
}

/**
 * Weighted allocation per category
 * Different categories allocate costs differently across items
 */
interface ItemWeights {
  [label: string]: number;
}

const categoryWeights: Record<string, { store: ItemWeights; supply: ItemWeights; retail: ItemWeights }> = {
  healthcare: {
    store: { 
      "Facility Rent": 0.20, 
      "Medical Staff": 0.35, 
      "Support Staff": 0.15, 
      "Medical Equipment": 0.12, 
      "Utilities": 0.08, 
      "Cleaning & Sanitation": 0.06,
      "Licensing & Accreditation": 0.04 
    },
    supply: { 
      "Medical Supplies": 0.55, 
      "Pharmaceuticals": 0.45 
    },
    retail: { 
      "Healthcare Margin": 0.70, 
      "Insurance Processing": 0.30 
    },
  },
  medical: {
    store: { 
      "Facility Rent": 0.20, 
      "Medical Staff": 0.35, 
      "Support Staff": 0.15, 
      "Medical Equipment": 0.12, 
      "Utilities": 0.08, 
      "Cleaning & Sanitation": 0.06,
      "Licensing & Accreditation": 0.04 
    },
    supply: { 
      "Medical Supplies": 0.55, 
      "Pharmaceuticals": 0.45 
    },
    retail: { 
      "Healthcare Margin": 0.70, 
      "Insurance Processing": 0.30 
    },
  },
  grocery: {
    store: { "Store Rent": 0.25, "Staff Costs": 0.30, "Utilities": 0.15, "Cleaning & Maintenance": 0.10, "Shrink & Losses": 0.12, "Licenses & Local Fees": 0.08 },
    supply: { "Local Transport": 0.50, "Storage / Cold Chain": 0.50 },
    retail: { "Retail Margin": 1.0 },
  },
  produce: {
    store: { "Store Rent": 0.30, "Staff Costs": 0.35, "Utilities": 0.20, "Shrink & Losses": 0.15 },
    supply: { "Local Transport": 0.50, "Storage / Cold Chain": 0.50 },
    retail: { "Retail Margin": 1.0 },
  },
  butcher: {
    store: { "Store Rent": 0.30, "Staff Costs": 0.40, "Utilities": 0.20, "Shrink & Losses": 0.10 },
    supply: { "Local Transport": 0.50, "Storage / Cold Chain": 0.50 },
    retail: { "Retail Margin": 1.0 },
  },
  restaurant: {
    store: { "Shop Rent": 0.35, "Staff Costs": 0.40, "Utilities": 0.15, "Licensing": 0.10 },
    supply: { "Ingredient Sourcing": 1.0 },
    retail: { "Restaurant Margin": 1.0 },
  },
  cafe: {
    store: { "Shop Rent": 0.35, "Staff Costs": 0.40, "Utilities": 0.15, "Licensing": 0.10 },
    supply: { "Ingredient Sourcing": 1.0 },
    retail: { "Cafe Margin": 1.0 },
  },
  fashion: {
    store: { "Shop Rent": 0.50, "Staff Costs": 0.50 },
    supply: { "Import & Customs": 0.50, "Distribution": 0.50 },
    retail: { "Brand Margin": 0.40, "Marketing & Promotion": 0.35, "Returns & Waste": 0.25 },
  },
  apparel: {
    store: { "Shop Rent": 0.50, "Staff Costs": 0.50 },
    supply: { "Import & Customs": 0.50, "Distribution": 0.50 },
    retail: { "Brand Margin": 0.40, "Marketing & Promotion": 0.35, "Returns & Waste": 0.25 },
  },
  electronics: {
    store: {},
    supply: { "Import & Customs": 0.40, "Distribution": 0.35, "Warranty & Returns": 0.25 },
    retail: { "Retail Margin": 1.0 },
  },
  pharmacy: {
    store: { "Shop Rent": 0.50, "Staff (Licensed)": 0.50 },
    supply: { "Distribution": 0.50, "Storage": 0.50 },
    retail: { "Regulated Margin": 1.0 },
  },
  fuel: {
    store: { "Station Operation Costs": 1.0 },
    supply: { "Distribution": 1.0 },
    retail: {},
  },
  hotel: {
    store: { "Property Rent": 0.40, "Staff Costs": 0.40, "Utilities": 0.20 },
    supply: { "Booking Platform Cut": 0.60, "Supplies": 0.40 },
    retail: { "Hotel Margin": 1.0 },
  },
  utilities: {
    store: { "Distribution & Grid": 0.60, "Metering & Billing": 0.40 },
    supply: { "Supply": 1.0 },
    retail: { "Provider Margin": 1.0 },
  },
  other: {
    store: { "Shop Rent": 0.50, "Staff Costs": 0.50 },
    supply: { "Distribution": 1.0 },
    retail: { "Retail Margin": 1.0 },
  },
};

/**
 * Map cost amounts to breakdown items with weighted allocation
 * Returns items compatible with HiddenCostBreakdownItem
 */
/**
 * Add random variation to make amounts more realistic
 * Applies ±5-15% variation to each item while maintaining total
 */
/**
 * Apply consistent distribution to breakdown items
 * No variation - items are distributed exactly according to weights
 * This ensures the same receipt always produces the same breakdown
 */
function applyConsistentDistribution(
  items: Array<{ label: string; amount: number; description?: string; bucket?: "store" | "supply" | "retail" | "government"; estimated?: boolean }>,
  totalAmount: number
): Array<{ label: string; amount: number; description?: string; bucket?: "store" | "supply" | "retail" | "government"; estimated?: boolean }> {
  if (items.length === 0) return items;
  
  // No variation - return items as-is, ensuring total matches exactly
  const currentTotal = items.reduce((sum, item) => sum + item.amount, 0);
  
  // If totals don't match (due to rounding), normalize proportionally
  if (Math.abs(currentTotal - totalAmount) > 0.01) {
    const normalizationFactor = currentTotal > 0 ? totalAmount / currentTotal : 1;
    return items.map((item) => ({
      ...item,
      amount: item.amount * normalizationFactor,
    }));
  }
  
  return items;
}

export function mapCostsToItems(
  breakdown: CategoryBreakdown,
  importSystemCost: number,
  retailHiddenCost: number,
  retailBrandCost: number,
  vatAmount?: number,
  serviceCharge?: number,
  category?: string | null,
  receiptId?: string // Receipt ID for deterministic variation seed
): Array<{ label: string; amount: number; description?: string; bucket?: "store" | "supply" | "retail" | "government"; estimated?: boolean }> {
  const items: Array<{ label: string; amount: number; description?: string; bucket?: "store" | "supply" | "retail" | "government"; estimated?: boolean }> = [];

  // Get weights for this category
  const normalizedCategory = category?.toLowerCase().trim() || "other";
  const weights = categoryWeights[normalizedCategory] || categoryWeights.other;

  // Store & Operations items (weighted) - from retailHiddenCost
  const storeItems: Array<{ label: string; amount: number; description?: string; bucket?: "store" | "supply" | "retail" | "government"; estimated?: boolean }> = [];
  if (breakdown.store.length > 0 && retailHiddenCost > 0) {
    const totalStoreWeight = breakdown.store.reduce((sum, item) => {
      return sum + (weights.store[item.label] || 1 / breakdown.store.length);
    }, 0);

    breakdown.store.forEach((item) => {
      const weight = weights.store[item.label] || (1 / breakdown.store.length);
      const normalizedWeight = totalStoreWeight > 0 ? weight / totalStoreWeight : (1 / breakdown.store.length);
      const amount = retailHiddenCost * normalizedWeight;
      storeItems.push({ 
        label: item.label, 
        amount, 
        description: item.description,
        bucket: item.bucket || "store",
        estimated: true 
      });
    });
    
    // Apply consistent distribution to store items (no variation for user trust)
    const storeTotal = storeItems.reduce((sum, item) => sum + item.amount, 0);
    const consistentStoreItems = applyConsistentDistribution(storeItems, storeTotal);
    items.push(...consistentStoreItems);
  }

  // Supply Chain items (weighted) - from importSystemCost
  const supplyItems: Array<{ label: string; amount: number; description?: string; bucket?: "store" | "supply" | "retail" | "government"; estimated?: boolean }> = [];
  if (breakdown.supply.length > 0 && importSystemCost > 0) {
    const totalSupplyWeight = breakdown.supply.reduce((sum, item) => {
      return sum + (weights.supply[item.label] || 1 / breakdown.supply.length);
    }, 0);

    breakdown.supply.forEach((item) => {
      const weight = weights.supply[item.label] || (1 / breakdown.supply.length);
      const normalizedWeight = totalSupplyWeight > 0 ? weight / totalSupplyWeight : (1 / breakdown.supply.length);
      const amount = importSystemCost * normalizedWeight;
      supplyItems.push({ 
        label: item.label, 
        amount, 
        description: item.description,
        bucket: item.bucket || "supply",
        estimated: true 
      });
    });
    
    // Apply consistent distribution to supply items (no variation for user trust)
    const supplyTotal = supplyItems.reduce((sum, item) => sum + item.amount, 0);
    const consistentSupplyItems = applyConsistentDistribution(supplyItems, supplyTotal);
    items.push(...consistentSupplyItems);
  }

  // Retail & Brand Layer items (weighted) - from retailBrandCost
  const retailItems: Array<{ label: string; amount: number; description?: string; bucket?: "store" | "supply" | "retail" | "government"; estimated?: boolean }> = [];
  if (breakdown.retail.length > 0 && retailBrandCost > 0) {
    const totalRetailWeight = breakdown.retail.reduce((sum, item) => {
      return sum + (weights.retail[item.label] || 1 / breakdown.retail.length);
    }, 0);

    breakdown.retail.forEach((item) => {
      const weight = weights.retail[item.label] || (1 / breakdown.retail.length);
      const normalizedWeight = totalRetailWeight > 0 ? weight / totalRetailWeight : (1 / breakdown.retail.length);
      const amount = retailBrandCost * normalizedWeight;
      retailItems.push({ 
        label: item.label, 
        amount, 
        description: item.description,
        bucket: item.bucket || "retail",
        estimated: true 
      });
    });
    
    // Apply consistent distribution to retail items (no variation for user trust)
    const retailTotal = retailItems.reduce((sum, item) => sum + item.amount, 0);
    const consistentRetailItems = applyConsistentDistribution(retailItems, retailTotal);
    items.push(...consistentRetailItems);
  }

  // Government items (VAT, service charge) - not estimated, shown on receipt
  if (vatAmount && vatAmount > 0) {
    items.push({
      label: "VAT (on receipt)",
      description: "Value added tax",
      bucket: "government",
      amount: vatAmount,
      estimated: false,
    });
  }

  if (serviceCharge && serviceCharge > 0) {
    items.push({
      label: "Service Charge (on receipt)",
      description: "Service fee",
      bucket: "government",
      amount: serviceCharge,
      estimated: false,
    });
  }

  return items;
}

