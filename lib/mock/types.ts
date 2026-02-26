export type ReceiptStatus = "PENDING" | "VERIFIED" | "REJECTED" | "analyzed" | "scanned";

export interface HiddenCost {
  importSystem: number;
  retailBrand: number;
  state: number;
  productValue: number;
  totalHidden: number;
  systemSubsidy?: number; // Subsidy amount when productValue is negative (normalized to 0)
  breakdownItems?: Array<{
    label: string;
    amount: number;
    description?: string;
    bucket?: "store" | "supply" | "retail" | "government";
    estimated?: boolean;
  }>;
}

export interface Reward {
  amount: number;
  symbol: string;
  claimable: boolean;
  /** rYUMO (CPI × level × category catalyzer applied); from receipt_rewards or analyze response */
  ryumo?: number;
}

export interface OCRLine {
  lineNo: number;
  text: string;
}

export interface TotalCandidate {
  value: number;
  score: number;
  fromLine: number;
  reasons: string[];
}

export interface DuplicateCheck {
  isDuplicate: boolean;
  matchedReceiptId?: string;
  duplicateType?: "file" | "visual" | "content";
  duplicateUsername?: string;
}

export interface FraudInfo {
  fraudScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  isValid: boolean;
  rejectionReasons: string[];
  warnings: string[];
  checks?: {
    hasExif?: boolean;
    hasDate?: boolean;
    hasTime?: boolean;
    merchantVerified?: boolean;
    hasInfrastructure?: boolean;
    hasHandwritingSignals?: boolean;
    isScreenshot?: boolean;
    ocrConfidence?: number;
  };
}

export interface Receipt {
  id: string;
  merchantName: string;
  merchantPlaceId?: string;
  country: string;
  currency: string;
  date: string;
  time?: string; // Time string (HH:MM format, optional)
  total: number;
  vat: number;
  paidExTax: number;
  status: ReceiptStatus;
  confidence: number;
  hiddenCost: HiddenCost;
  reward: Reward;
  reasons: string[];
  ocrLines: OCRLine[];
  pickedTotalCandidate: TotalCandidate;
  duplicateCheck: DuplicateCheck;
  createdAt: string;
  imageUrl?: string;
  category?: string; // Merchant category (grocery, restaurant, etc.)
  /** When category is "utilities": water | electricity | gas */
  utilityType?: "water" | "electricity" | "gas";
  totalPaid?: number; // Alias for total
  ocrRawText?: string; // Raw OCR text (for admin viewing)
  username?: string; // Username who uploaded this receipt (for admin viewing)
  displayName?: string; // Görünen ad (user_profiles.display_name)
  merchantChannel?: string; // Merchant channel classification (marketplace, supermarket_grocery, etc.)
  fraudInfo?: FraudInfo; // Fraud detection information (for admin display)
  riskScore?: number | null; // Fraud/risk score (0-100)
  marginViolation?: {
    hasViolation: boolean;
    violationCount: number;
    reason?: string;
    violations?: string[]; // Detailed violation list (e.g., ["top=0px < 80px", "right=1px < 60px"])
    margins?: { top?: number; bottom?: number; left?: number; right?: number }; // Actual margin values
    minRequired?: { top?: number; bottom?: number; left?: number; right?: number }; // Minimum required margins
    adminBypass?: string; // Admin bypass message - why a normal user would have been rejected
  }; // Margin violation info (for friendly reminder to all users)
  rejectionInfo?: Array<{
    rejected: boolean;
    reason: string;
    reasons: string[];
    gateConfidence?: number;
    stage: string;
    substage?: string;
    timestamp?: number;
  }>; // Rejection info (for admin display - shows all rejection reasons that were bypassed)
  pipelineLog?: string; // Pipeline/terminal logs for admin evidence (admin only)
  blobFilename?: string; // Blob storage filename (e.g. m-migros-2026-01-23-773.35-TRY-iQxxMwTiubV1yNGN6EDnuyXRMGLCPQ.jpg) for log download naming
  /** Honor/quality result for this receipt (honorDelta, reward%, 1.2x bonus); shown to all including admin (admin's profile honor is not updated) */
  qualityHonor?: {
    level: string;
    honorDelta: number;
    rewardPct: number;
    honorBonusApplied: boolean;
    reasons?: string[];
    /** Quality score 0–90+ (admin breakdown) */
    qualityScore?: number;
    /** Security red reasons when SECURITY level (admin breakdown) */
    securityReasons?: string[];
  };
}

export interface UserStats {
  spentMonth: number;
  hiddenMonth: number;
  productValueMonth: number;
  minedToday: number;
  streakDays: number;
  nextTierInReceipts: number;
  multiplier: number;
  claimableRewards: number;
}

export type QuestType = "DAILY" | "WEEKLY" | "SEASONAL";

export interface Quest {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  rewardText: string;
  type: QuestType;
  completed: boolean;
}

export type TaskType = "SOCIAL_MEDIA" | "CHALLENGE" | "CONTENT_CREATION" | "COMMUNITY";

export interface Task {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  platform?: string; // Twitter, TikTok, Instagram, etc.
  progress: number;
  target: number;
  rewardText: string;
  rewardAmount: number;
  completed: boolean;
  deadline?: string;
  instructions: string[];
  tags: string[];
}

export interface LeaderboardEntry {
  rank: number;
  /** Username for "Sen" highlight on leaderboard (from API) */
  username?: string;
  address: string;
  displayName: string;
  receiptsVerified: number;
  hiddenCostUncovered: number;
  streakDays: number;
  badges: string[];
  /** Honor score (0–100); only users with honor > 0 are shown when Honor system is enabled */
  honor?: number;
  /** All-time total aYUMO (admin-only, from API when viewer is admin) */
  totalAyumo?: number;
  /** All-time total rYUMO (admin-only, from API when viewer is admin) */
  totalRyumo?: number;
}

export interface ReceiptFilters {
  dateFrom?: string;
  dateTo?: string;
  country?: string;
  status?: ReceiptStatus;
  verifiedOnly?: boolean;
  search?: string;
}

export interface InsightData {
  monthlySpend: { month: string; spend: number; hidden: number }[];
  categoryBreakdown: { category: string; amount: number }[];
  topMerchants: { name: string; receipts: number; total: number }[];
  inflationIndex: number;
}

export type ActivityType = "RECEIPT_VERIFIED" | "TASK_COMPLETED" | "ADJUSTMENT" | "CLAIM";

export interface ActivityLog {
  id: string;
  type: ActivityType;
  date: string;
  description: string;
  amount: number;
  currency: string; // "aYUMO" or "rYUMO"
  status: "COMPLETED" | "PENDING";
  referenceId?: string; // Receipt ID, Task ID, etc.
}
