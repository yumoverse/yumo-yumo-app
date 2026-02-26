/**
 * Types for receipt database operations
 */

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingReceiptId?: string;
  existingUsername?: string;
  duplicateType?: "file" | "visual" | "content";
}
