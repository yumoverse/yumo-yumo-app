/**
 * Convert ReceiptAnalysis (from API) to Receipt (for UI)
 * This allows the mine page to use real OCR data
 */

import type { ReceiptAnalysis } from "./types";
import type { Receipt, HiddenCost, Reward, OCRLine, TotalCandidate } from "@/lib/mock/types";
import type { FraudDetectionResult } from "@/lib/fraud/fraud-detection";

export function convertReceiptAnalysisToReceipt(analysis: ReceiptAnalysis, imageUrl?: string): Receipt {
  const blobUrl = (analysis as any).blobUrl as string | undefined;
  const resolvedImageUrl = imageUrl ?? blobUrl;
  // Convert OCR lines
  const ocrLines: OCRLine[] = (analysis.ocr?.lines || []).map((line) => ({
    lineNo: line.lineNo,
    text: line.text,
  }));

  // Convert total candidate
  const pickedTotalCandidate: TotalCandidate = {
    value: analysis.extraction?.total?.value || 0,
    score: analysis.extraction?.total?.confidence || 0,
    fromLine: analysis.extraction?.total?.sourceLine || 0,
    reasons: analysis.flags?.reasons || [],
  };

  // Check if this is a flight receipt (has hiddenTotal field)
  const isFlight = !!(analysis.hiddenCost as any)?.hiddenTotal;
  
  // Convert hidden cost - handle missing breakdown items
  // For flights: filter out "Base Transport Value" and "Supply Chain & Journey" items
  const allBreakdownItems = (analysis.hiddenCost?.breakdown?.items || []);
  const breakdownItems = allBreakdownItems
    .filter(item => {
      // For flights: exclude Base Transport Value and Supply Chain & Journey items
      if (isFlight) {
        const label = item.label.toLowerCase();
        return !label.includes("base transport") && 
               !label.includes("fuel & energy") &&
               item.bucket !== "supply"; // Exclude supply bucket (Supply Chain & Journey)
      }
      return true; // For non-flights, include all items
    })
    .map(item => ({
      label: item.label,
      amount: item.amount,
      description: item.description,
      bucket: item.bucket, // Use bucket from API (already set by mapCostsToItems)
      estimated: item.estimated !== false, // Default to true unless explicitly false
    }));

  // For flights: calculate retailBrand from breakdownCore components (retail bucket items)
  let retailBrand = analysis.hiddenCost?.breakdown?.retailHiddenCost || 0;
  if (isFlight && breakdownItems.length > 0) {
    // Sum retail bucket items (Retail & Brand, Distribution, Operator Margin, Risk & Compliance)
    retailBrand = breakdownItems
      .filter(item => item.bucket === "retail")
      .reduce((sum, item) => sum + item.amount, 0);
  }
  
  // Normalize negative productValue: if negative, set to 0 and store absolute value as systemSubsidy
  const originalProductValue = analysis.hiddenCost?.referencePrice || 0;
  const productValue = originalProductValue < 0 ? 0 : originalProductValue;
  const systemSubsidy = originalProductValue < 0 ? Math.abs(originalProductValue) : undefined;
  
  const hiddenCost: HiddenCost = {
    importSystem: isFlight ? 0 : (analysis.hiddenCost?.breakdown?.importSystemCost || 0), // Flights don't have import system cost
    retailBrand,
    state: isFlight
      ? (analysis.pricing?.stateLayerTax || 0) // Use stateLayerTax for flights (from flightHiddenCost.stateLayer)
      : (analysis.pricing?.vatAmount || 0),
    productValue, // Normalized: 0 if originally negative
    ...(systemSubsidy !== undefined && systemSubsidy > 0 ? { systemSubsidy } : {}), // Only include if > 0
    // For flights: use hiddenTotal (includes stateLayer + hiddenCore)
    // For non-flights: use hiddenCostCore
    totalHidden: isFlight 
      ? ((analysis.hiddenCost as any)?.hiddenTotal || analysis.hiddenCost?.hiddenCostCore || 0)
      : (analysis.hiddenCost?.hiddenCostCore || 0),
    breakdownItems,
  };

  // Convert reward (aYUMO + rYUMO from receipt_rewards or analyze response)
  const reward: Reward = {
    amount: analysis.reward?.final ?? analysis.rewards?.ayumo_amount ?? 0,
    symbol: analysis.reward?.token || "aYUMO",
    claimable: analysis.status === "verified" || analysis.status === "saved",
    ryumo: analysis.rewards?.ryumo_bonus_amount ?? analysis.reward?.ryumo ?? undefined,
  };

  // Convert status
  const status: "PENDING" | "VERIFIED" | "REJECTED" | "analyzed" | "scanned" = 
    analysis.status === "verified" || analysis.status === "saved" ? "VERIFIED" :
    analysis.status === "rejected" ? "REJECTED" :
    analysis.status === "analyzed" ? "analyzed" :
    analysis.status === "scanned" ? "scanned" :
    "PENDING";

  return {
    id: analysis.receiptId,
    merchantName: analysis.merchant?.name || "Unknown Merchant",
    merchantPlaceId: analysis.merchant?.placeId,
    country: analysis.merchant?.country || "TH",
    currency: analysis.pricing?.currency || "THB",
    date: analysis.extraction?.date?.value || new Date().toISOString().split("T")[0],
    total: analysis.pricing?.totalPaid || 0,
    totalPaid: analysis.pricing?.totalPaid || 0, // Alias for compatibility
    vat: analysis.pricing?.vatAmount || 0,
    paidExTax: analysis.pricing?.paidExTax || 0,
    status,
    confidence: Math.round((analysis.extraction?.total?.confidence || 0) * 100),
    hiddenCost,
    reward,
    reasons: analysis.flags?.reasons || [],
    ocrLines,
    pickedTotalCandidate,
    duplicateCheck: {
      isDuplicate: analysis.verification?.isDuplicate || false,
      matchedReceiptId: analysis.verification?.duplicateReceiptId,
      duplicateType: analysis.verification?.duplicateType,
      duplicateUsername: analysis.verification?.duplicateUsername,
    },
    imageUrl: resolvedImageUrl,
    createdAt: analysis.createdAt || new Date().toISOString(),
    category: analysis.merchant?.category,
    utilityType: analysis.merchant?.utilityType,
    time: analysis.extraction?.time?.value,
    ocrRawText: analysis.ocr?.rawText, // Add OCR raw text for admin viewing
    username: analysis.username, // Add username for admin viewing
    displayName: (analysis as any).displayName, // Görünen ad (user_profiles.display_name)
    merchantChannel: analysis.merchant?.channel || "other", // Add merchant channel (fallback to "other")
    // Fraud detection information (for admin display)
    fraudInfo: analysis.fraud ? {
      fraudScore: analysis.fraud.fraudScore,
      riskLevel: analysis.fraud.riskLevel,
      isValid: analysis.fraud.isValid,
      rejectionReasons: analysis.fraud.rejectionReasons || [],
      warnings: analysis.fraud.warnings || [],
      checks: analysis.fraud.checks ? {
        hasExif: analysis.fraud.checks.hasExif,
        hasDate: analysis.fraud.checks.hasDate,
        hasTime: analysis.fraud.checks.hasTime,
        merchantVerified: analysis.fraud.checks.merchantVerified,
        hasInfrastructure: analysis.fraud.checks.hasInfrastructure,
        hasHandwritingSignals: analysis.fraud.checks.hasHandwritingSignals,
        isScreenshot: analysis.fraud.checks.isScreenshot,
        ocrConfidence: analysis.fraud.checks.ocrConfidence,
      } : undefined,
    } : undefined,
    riskScore: analysis.riskScore ?? null,
    // Margin violation info (for friendly reminder to all users)
    marginViolation: (analysis as any).marginViolation || undefined,
    // Rejection info (for admin display - shows all rejection reasons that were bypassed)
    rejectionInfo: (analysis as any).rejectionInfo || undefined,
    // Pipeline log for admin evidence (terminal-style logs)
    pipelineLog: (analysis as any).pipelineLog,
    blobFilename: (analysis as any).blobFilename,
    qualityHonor: analysis.qualityHonor
      ? {
          level: analysis.qualityHonor.level,
          honorDelta: analysis.qualityHonor.honorDelta,
          rewardPct: analysis.qualityHonor.rewardPct,
          honorBonusApplied: analysis.qualityHonor.honorBonusApplied,
          reasons: analysis.qualityHonor.reasons,
          qualityScore: analysis.qualityHonor.qualityScore,
          securityReasons: analysis.qualityHonor.securityReasons,
        }
      : undefined,
  };
}

