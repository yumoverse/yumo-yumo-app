/**
 * Receipt data model types
 */

export type ReceiptStatus = "draft" | "verified" | "saved" | "rejected" | "pending" | "analyzed" | "scanned";

export type MerchantTier = "verified" | "candidate" | "unverified";

export interface Merchant {
  name: string;
  placeId?: string;
  category?: string;
  /** When category is "utilities": water | electricity | gas (su, elektrik, doğalgaz) */
  utilityType?: "water" | "electricity" | "gas";
  country?: string;
  channel?: string; // Merchant channel classification (marketplace, supermarket_grocery, etc.)
  /** Canonical merchant UUID when matched via merchant-matching */
  merchantId?: string | null;
  /** Tier from canonical merchant (affects reward multiplier) */
  tier?: MerchantTier | null;
}

export interface ExtractionField {
  value: string | number;
  confidence: number;
  sourceLine?: number;
}

export interface DateExtraction extends ExtractionField {
  value: string; // ISO date string
}

export interface TimeExtraction extends ExtractionField {
  value: string; // HH:MM format (24-hour)
}

export interface TotalExtraction extends ExtractionField {
  value: number;
  currency?: string;
}

export interface VATExtraction extends ExtractionField {
  value: number;
  rate?: number; // VAT rate as decimal (e.g., 0.20 for 20%)
}

export interface Extraction {
  date: DateExtraction;
  time?: TimeExtraction; // Optional time extraction
  total: TotalExtraction;
  vat: VATExtraction;
}

export interface Pricing {
  // Server-authoritative values (DO NOT recompute in UI)
  totalPaid: number; // Total amount paid (net + VAT)
  vatAmount: number; // VAT amount in money (NOT rate)
  paidExTax: number; // Paid amount excluding tax
  vatRate?: number; // VAT rate as decimal (e.g., 0.07 for 7%) - optional, for reference only
  
  // Legacy fields (kept for backward compatibility, but deprecated)
  paidPriceExTax: number; // Same as paidExTax
  stateLayerTax: number; // Same as vatAmount
  
  // Rates for hidden cost calculation
  importSystemRate: number;
  retailHiddenRate: number;
  currency?: string; // ISO code: "TRY", "THB", "USD", etc.
  symbol?: string; // Symbol: "₺", "฿", "$", etc.
  
  // Flight-specific fields (optional, only present for flight receipts)
  baseTransportValue?: number; // Base transport value for flight receipts (from flightHiddenCost)
}

export interface HiddenCostBreakdownItem {
  label: string;
  amount: number;
  description?: string;
  bucket?: "store" | "supply" | "retail" | "government";
  estimated?: boolean;
}

export interface HiddenCostBreakdown {
  importSystemCost: number;
  retailHiddenCost: number;
  items: HiddenCostBreakdownItem[]; // Multiple sub-items for detailed breakdown
}

export interface HiddenCost {
  referencePrice: number;
  hiddenCostCore: number;
  breakdown: HiddenCostBreakdown;
  // For flights: total hidden cost (hiddenCore + stateLayer)
  hiddenTotal?: number;
}

export interface Reward {
  conversionRate: number;
  raw: number;
  final: number;
  /** rYUMO = aYUMO × CPI × Level_Catalyzer × Category_Catalyzer (analyze/post-process) */
  ryumo?: number;
  token: string; // "aYUMO"
  capsApplied: string[];
  /** True when user got the one-time 1.2x bonus for being the first uploader of a now-verified merchant. */
  verifiedThankYou?: boolean;
}

/**
 * receipt_rewards tablosundan gelen ödül ve hidden cost özeti.
 * GET /api/receipts/[id] response'unda `rewards` alanı olarak döner.
 * Post-process tamamlanmamışsa bu alan undefined olabilir.
 *
 * Ödül formülü: aYUMO = HiddenCost / USD_rate; rYUMO = aYUMO × CPI × Level_Catalyzer × Category_Catalyzer.
 */
export interface ReceiptRewards {
  /** Base aYUMO (kategori hidden cost / USD_rate) */
  base_reward_amount: number;
  /** Ek aYUMO (canonical delta / USD_rate; 0 ise canonical artış yok) */
  extra_reward_amount: number;
  /** Toplam aYUMO = base + extra (DB trigger ile set edilir) */
  ayumo_amount: number;
  /** rYUMO = aYUMO × CPI × Level_Catalyzer × Category_Catalyzer (reward_version >= 2) */
  ryumo_bonus_amount: number | null;
  /** Kategori bazlı hidden cost (post-process öncesi baz değer) */
  base_hidden_cost: number | null;
  /** Canonical pipeline sonrası final hidden cost (varsa daha yüksek) */
  final_hidden_cost: number | null;
  /** Ödül hesaplama versiyonu (2 = USD_rate + CPI + catalyzer) */
  reward_version: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface ReceiptFlags {
  needsLLM: boolean; // Deprecated: use needsAI instead
  reasons: string[];
  rejected?: boolean; // Gate rejection flag
  rejectionReasons?: string[]; // Gate rejection reasons
  gateConfidence?: number; // Gate confidence score (0-100)
  docType?: "receipt" | "invoice" | "delivery_note" | "unknown"; // Detected document type
}

export interface OCRLine {
  lineNo: number;
  text: string;
  confidence?: number; // Optional OCR confidence score (0-1)
}

export interface OCR {
  lines: OCRLine[];
  rawText: string;
}

export interface ReceiptVerification {
  hash: string; // SHA-256 hash of receipt image for duplicate detection
  isDuplicate: boolean;
  duplicateReceiptId?: string;
  duplicateType?: "file" | "visual" | "content";
  duplicateUsername?: string;
  confidenceScore: number; // Overall confidence (0-1)
  merchantVerified: boolean;
  passedGating: boolean; // Whether confidence thresholds are met
}

export type ProofType = "digital_receipt" | "physical_receipt" | "screenshot" | "manual";
export type RewardTier = "A" | "B" | "C" | "none";

export interface ReceiptEvidence {
  hasExif?: boolean;
  exifTimestamp?: string; // ISO timestamp from EXIF data
  photoHash?: string; // Hash of the photo for verification
  hasLocation?: boolean;
  locationMatch?: boolean; // Whether location matches merchant location
}

export interface ReceiptSource {
  app?: string; // Source app (e.g., "yumo", "booking.com", "uber")
  bookingId?: string; // External booking/reference ID
  captureType?: string; // How the receipt was captured (e.g., "camera", "upload", "api")
}

export interface ReceiptAnalysis {
  receiptId: string;
  status: ReceiptStatus;
  merchant: Merchant;
  extraction: Extraction;
  pricing: Pricing;
  hiddenCost: HiddenCost;
  reward: Reward;
  flags: ReceiptFlags;
  ocr: OCR;
  verification?: ReceiptVerification;
  fraud?: import("@/lib/fraud/fraud-detection").FraudDetectionResult; // Optional fraud detection result
  createdAt?: string;
  walletAddress?: string;
  username?: string; // User who uploaded this receipt
  
  // New metadata fields (optional for backward compatibility)
  proofType?: ProofType;
  isRewarded?: boolean; // Default true for existing non-manual records
  rewardTier?: RewardTier; // Default "A" for existing records
  riskScore?: number | null; // Fraud/risk score (0-100)
  evidence?: ReceiptEvidence; // Evidence JSON with EXIF, location, etc.
  source?: ReceiptSource; // Source JSON with app, bookingId, captureType
  receiptHash?: string; // SHA-256 hash of receipt file for duplicate detection
  imagePhash?: string; // Perceptual hash for visual similarity detection
  contentHash?: string; // Content hash (merchant + total + date + tax) for content-based duplicate detection
  pipelineLog?: string; // Pipeline/terminal logs for admin evidence (no extra API cost)
  /** Google Vision raw JSON (responses[0]) for post-process; stored in receipt_vision_raw. */
  visionRawJson?: unknown;
  /** Honor/quality result when USE_HONOR_FOR_VALIDATION is enabled */
  qualityHonor?: {
    level: string;
    honorDelta: number;
    rewardPct: number;
    honorBonusApplied: boolean;
    reasons: string[];
    securityReasons?: string[];
    qualityScore?: number;
  };
  /**
   * receipt_rewards tablosundan gelen ödül özeti.
   * Post-process tamamlanmamışsa undefined.
   * GET /api/receipts/[id] ile dolar; liste sorgularında dönmez.
   */
  rewards?: ReceiptRewards;
  /**
   * Admin-only: normal kullanıcı için reddedilecek durumlar listesi.
   * Pipeline admin bypass'i sayesinde başarıyla devam etse bile bu bilgiler saklanır.
   */
  rejectionInfo?: Array<{
    rejected: boolean;
    reason: string;
    reasons?: string[];
    gateConfidence?: number;
    stage?: string;
    substage?: string;
    timestamp?: number;
  }>;
  /** Admin-only: Blob dosyası adı (log indirme için kullanılır). */
  blobFilename?: string | null;
  /** Admin-only: Blob storage URL. */
  blobUrl?: string | null;
}

export interface ReceiptStorage {
  receipts: ReceiptAnalysis[];
}


