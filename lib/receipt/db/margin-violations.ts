/**
 * Margin Violation Tracking
 * SERVER-ONLY: Do not import in client components
 */

import { sql } from "@/lib/db/client";
import { isDatabaseAvailable } from "./connection";

/**
 * Count today's margin violations for a user
 */
export async function countTodayMarginViolations(username: string): Promise<number> {
  if (!isDatabaseAvailable() || !sql) {
    console.warn("[margin-violations] DB not available, returning 0");
    return 0;
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    // ✅ Direkt row count (daha güvenli)
    const rows = await sql`
      SELECT violation_date
      FROM margin_violations
      WHERE username = ${username}
        AND violation_date = ${today}
    `;
    
    return rows.length;
  } catch (error: any) {
    console.error("[margin-violations] Error counting:", error);
    return 0; // Fail open
  }
}

/**
 * Record a margin violation for a user
 */
export async function recordMarginViolation(username: string): Promise<void> {
  if (!isDatabaseAvailable() || !sql) {
    console.warn("[margin-violations] DB not available, skipping");
    return;
  }
  
  try {
    const today = new Date().toISOString().split('T')[0];
    
    await sql`
      INSERT INTO margin_violations (username, violation_date)
      VALUES (${username}, ${today})
      ON CONFLICT (username, violation_date) DO NOTHING
    `;
    
    console.log(`[margin-violations] ✅ Recorded for ${username} on ${today}`);
  } catch (error: any) {
    console.error("[margin-violations] Error recording:", error);
    // Fail silently
  }
}
