import type { ReceiptContext } from "@/app/api/receipt/analyze/types";
import type { ExtractionValidationResult, HiddenCostBreakdownItem } from "@/lib/receipt/types";

type BuildAnalyzeResponseArgs = {
  context: ReceiptContext;
  receiptStatus: "analyzed" | "pending" | "rejected";
  extractionValidationSnap?: ExtractionValidationResult;
  postProcessStateOut?: string;
  extractionFlagsRejected: boolean;
  paidExTax: number;
  hiddenCostCore: number;
  hiddenRate: number;
  referencePrice: number;
  rewardAmount: number;
  ryumoAmount: number;
  importSystemRate: number;
  retailHiddenRate: number;
  importSystemCost: number;
  retailHiddenCost: number;
  breakdownItems: HiddenCostBreakdownItem[];
  logBuffer: string[];
};

export function buildAnalyzeResponse({
  context,
  receiptStatus,
  extractionValidationSnap,
  postProcessStateOut,
  extractionFlagsRejected,
  paidExTax,
  hiddenCostCore,
  hiddenRate,
  referencePrice,
  rewardAmount,
  ryumoAmount,
  importSystemRate,
  retailHiddenRate,
  importSystemCost,
  retailHiddenCost,
  breakdownItems,
  logBuffer,
}: BuildAnalyzeResponseArgs) {
  return {
    receiptId: context.receiptId,
    status: receiptStatus,
    merchant: {
      name: (context as any).merchantMatch?.displayName ?? context.merchantName,
      placeId: context.merchantPlaceId,
      category: (context as any).merchantMatch?.category ?? context.category ?? "other",
      utilityType: context.utilityType ?? undefined,
      country: context.detectedCountry || "TR",
      channel: context.hiddenCostBreakdown?.merchant.channel,
      signals: context.hiddenCostBreakdown?.merchant.signals,
      merchantId: (context as any).merchantMatch?.merchantId ?? undefined,
      tier: (context as any).merchantMatch?.tier ?? undefined,
    },
    extraction: {
      date: { value: context.date || new Date().toISOString().split("T")[0], confidence: 0.8 },
      time: context.time ? { value: context.time, confidence: 0.8 } : undefined,
      total: { value: context.totalPaid, confidence: 0.8 },
      vat: { value: context.vatAmount, rate: context.vatRate, confidence: 0.8 },
      serviceCharge: context.serviceCharge ? { value: context.serviceCharge, confidence: 0.8 } : undefined,
    },
    pricing: {
      totalPaid: context.totalPaid,
      paidExTax,
      vatAmount: context.vatAmount,
      vatRate: context.vatRate,
      serviceCharge: context.serviceCharge || 0,
      paidPriceExTax: paidExTax,
      stateLayerTax: context.vatAmount,
      importSystemRate,
      retailHiddenRate,
      currency: context.currency,
      symbol: context.currencySymbol,
    },
    hiddenCost: {
      referencePrice,
      hiddenCostCore,
      breakdown: {
        importSystemCost: importSystemCost || hiddenCostCore * 0.35,
        retailHiddenCost: retailHiddenCost || hiddenCostCore * 0.65,
        items: breakdownItems,
      },
      totalHidden: hiddenCostCore,
      hiddenRate,
      layers: context.hiddenCostBreakdown ? {
        platformEcosystem: context.hiddenCostBreakdown.layers.platformEcosystem,
        storeOperations: context.hiddenCostBreakdown.layers.storeOperations,
        supplyChain: context.hiddenCostBreakdown.layers.supplyChain,
        retailBrand: context.hiddenCostBreakdown.layers.retailBrand,
        stateLayer: context.hiddenCostBreakdown.layers.stateLayer,
      } : undefined,
      shipping: context.hiddenCostBreakdown?.shipping,
    },
    reward: {
      conversionRate: 1,
      raw: rewardAmount,
      final: rewardAmount,
      ryumo: ryumoAmount,
      token: "aYUMO",
      capsApplied: [],
      verifiedThankYou: !!(context as any).verifiedThankYou,
    },
    flags: {
      needsLLM: false,
      reasons: [],
      docType: "receipt",
      ...(extractionFlagsRejected ? { rejected: true as const } : {}),
    },
    ocr: {
      lines: context.ocrLines,
      rawText: context.fullText,
    },
    verification: {
      hash: context.hash || "",
      isDuplicate: !!(context as any).earlyDuplicateInfo || !!(context as any).reviewExistingReceiptId,
      duplicateReceiptId: (context as any).earlyDuplicateInfo?.existingReceiptId || (context as any).reviewExistingReceiptId,
      duplicateType: (context as any).earlyDuplicateInfo?.duplicateType || ((context as any).reviewExistingReceiptId ? "content" : undefined),
      duplicateUsername: (context as any).earlyDuplicateInfo?.existingUsername || (context as any).reviewExistingUsername,
      confidenceScore: 0.8,
      merchantVerified: !!context.placesResult,
      passedGating: true,
    },
    receiptHash: context.hash || null,
    imagePhash: context.finalPerceptualHash || context.perceptualHash || null,
    contentHash: context.contentHash || null,
    fraud: (context as any).fraudSignals ? {
      fraudScore: (context as any).fraudSignals.fraudScore,
      riskLevel: (context as any).fraudSignals.riskLevel,
      isValid: (context as any).fraudSignals.isValid,
      rejectionReasons: (context as any).fraudSignals.rejectionReasons || [],
      warnings: (context as any).fraudSignals.warnings || [],
      checks: (context as any).fraudSignals.checks || {},
    } : undefined,
    riskScore: (context as any).fraudSignals?.fraudScore || null,
    qualityHonor: (context as any).qualityHonorResult
      ? {
          level: (context as any).qualityHonorResult.level,
          honorDelta: (context as any).qualityHonorResult.honorDelta,
          rewardPct: (context as any).qualityHonorResult.rewardPct,
          honorBonusApplied: (context as any).qualityHonorResult.honorBonusApplied,
          reasons: (context as any).qualityHonorResult.reasons,
          securityReasons: (context as any).qualityHonorResult.securityReasons,
          qualityScore: (context as any).qualityHonorResult.qualityScore,
        }
      : undefined,
    marginViolation: (context as any).marginViolationInfo || undefined,
    rejectionInfo: (context as any).rejectionInfo || undefined,
    pipelineLog: logBuffer.length > 0 ? logBuffer.join("\n") : undefined,
    blobFilename: (context as any).blobFilename || null,
    blobUrl: (context as any).blobUrl || null,
    requiresMerchantApproval: (context as any).requiresMerchantApproval || false,
    visionRawJson: (context as any).visionRawJson ?? undefined,
    geminiLineItems: Array.isArray((context as any).geminiLineItems)
      ? (context as any).geminiLineItems
      : undefined,
    gptFullReceiptResult: (context as any).gptFullReceiptResult ?? undefined,
    merchantAddress: (context as any).merchantAddress
      ? String((context as any).merchantAddress).trim() || undefined
      : undefined,
    branchInfo: (context as any).branchInfo
      ? String((context as any).branchInfo).trim() || undefined
      : undefined,
    addressCity: (context as any).addressCity
      ? String((context as any).addressCity).trim() || undefined
      : undefined,
    addressDistrict: (context as any).addressDistrict
      ? String((context as any).addressDistrict).trim() || undefined
      : undefined,
    addressNeighborhood: (context as any).addressNeighborhood
      ? String((context as any).addressNeighborhood).trim() || undefined
      : undefined,
    addressStreet: (context as any).addressStreet
      ? String((context as any).addressStreet).trim() || undefined
      : undefined,
    extractionValidation: extractionValidationSnap,
    postProcessState: postProcessStateOut,
  };
}
