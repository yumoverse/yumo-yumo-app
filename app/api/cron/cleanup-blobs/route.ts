/**
 * Cron Job: Cleanup Scheduled Blob Deletions
 * 
 * This endpoint is called by Vercel Cron to process scheduled blob deletions.
 * Receipt images are deleted 48 hours after upload to save storage space.
 * 
 * Schedule: Every hour (configurable in vercel.json)
 * 
 * Security: Protected by CRON_SECRET to prevent unauthorized access
 */

import { NextResponse } from "next/server";
import { processPendingDeletions, getDeletionStats } from "@/lib/scheduled-deletion";

function checkCronAuth(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

export async function GET(req: Request) {
  console.log("=".repeat(80));
  console.log("[cron/cleanup-blobs] 🕐 Cron job triggered");
  console.log("=".repeat(80));

  if (!checkCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get stats before processing
    const statsBefore = await getDeletionStats();
    console.log("[cron/cleanup-blobs] 📊 Stats before:", statsBefore);
    
    // Process pending deletions
    const result = await processPendingDeletions();
    
    // Get stats after processing
    const statsAfter = await getDeletionStats();
    
    console.log("=".repeat(80));
    console.log("[cron/cleanup-blobs] ✅ Cron job completed");
    console.log(`[cron/cleanup-blobs] 📊 Processed: ${result.total}, Deleted: ${result.deleted}, Failed: ${result.failed}`);
    console.log("=".repeat(80));

    return NextResponse.json({
      success: true,
      processed: result.total,
      deleted: result.deleted,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors : undefined,
      stats: {
        before: statsBefore,
        after: statsAfter
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error("[cron/cleanup-blobs] ❌ Error:", error.message);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process deletions",
        details: error?.message ?? String(error)
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(req: Request) {
  return GET(req);
}
