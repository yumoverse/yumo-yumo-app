/**
 * DELETE queries for receipts
 * SERVER-ONLY: Do not import in client components
 */

import { sql } from "@/lib/db/client";
import { getReceiptById as getReceiptByIdFile, deleteReceipt as deleteReceiptFile } from "../../storage";
import { isDatabaseAvailable } from "../connection";

export async function deleteReceipt(
  receiptId: string,
  username: string,
  isAdmin: boolean = false
): Promise<boolean> {
  if (!isDatabaseAvailable() || !sql) {
    const receipt = await getReceiptByIdFile(receiptId);
    if (!receipt) {
      return false;
    }
    if (!isAdmin && receipt.username !== username) {
      return false;
    }
    return deleteReceiptFile(receiptId);
  }

  const dbSql = sql;

  try {
    const rows = await dbSql`
      SELECT username 
      FROM receipts 
      WHERE receipt_id = ${receiptId}
      LIMIT 1
    `;
    
    if (rows.length === 0) {
      return false;
    }
    
    if (!isAdmin && rows[0].username !== username) {
      return false;
    }
    
    await dbSql`
      DELETE FROM receipts 
      WHERE receipt_id = ${receiptId}
    `;
    
    console.log(`[storage-db] Receipt deleted from database: ${receiptId}${isAdmin ? " (admin)" : ""}`);
    return true;
  } catch (error) {
    console.error("[storage-db] Failed to delete receipt from database:", error);
    const receipt = await getReceiptByIdFile(receiptId);
    if (!receipt) {
      return false;
    }
    if (!isAdmin && receipt.username !== username) {
      return false;
    }
    return deleteReceiptFile(receiptId);
  }
}
