/**
 * Save breakdown items in parallel
 * SERVER-ONLY: Do not import in client components
 */

import { sql } from "@/lib/db/client";
import type { HiddenCostBreakdownItem } from "../../types";

/**
 * Save breakdown items for a receipt
 * Deletes existing items and batch inserts new ones
 */
export async function saveBreakdownItems(
  receiptId: string,
  items: HiddenCostBreakdownItem[]
): Promise<void> {
  if (!items || items.length === 0) {
    return;
  }

  const dbSql = sql;
  if (!dbSql) {
    throw new Error("Database connection not available");
  }

  // Delete existing breakdown items
  await dbSql`DELETE FROM receipt_breakdown_items WHERE receipt_id = ${receiptId}`;
  
  // Insert new items
  for (const item of items) {
    await dbSql`
      INSERT INTO receipt_breakdown_items (receipt_id, label, amount, description, bucket, estimated)
      VALUES (${receiptId}, ${item.label}, ${item.amount}, ${item.description || null}, ${item.bucket || null}, ${item.estimated || false})
    `;
  }
}
