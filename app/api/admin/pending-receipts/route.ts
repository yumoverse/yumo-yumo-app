import { NextResponse } from "next/server";
import { getAllReceiptsAll } from "@/lib/receipt/storage-db";
import { getSessionUsername } from "@/lib/auth/session";

// Admin users list
import { isAdminUser } from "@/lib/auth/admin-users";

export async function GET(req: Request) {
  try {
    // Get username from cookie
    const username = await getSessionUsername();

    if (!username) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check if admin
    const isAdmin = isAdminUser(username);
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    // Only show receipts that are actually awaiting approval (pending).
    // Analyzed receipts must not appear here so the Approve button works.
    const allReceipts = await getAllReceiptsAll();
    const pendingReceipts = allReceipts.filter((r) => r.status === "pending");

    console.log(`[api/admin/pending-receipts] Found ${pendingReceipts.length} receipts (pending)`);
    
    return NextResponse.json({ receipts: pendingReceipts });
  } catch (error: any) {
    console.error("[api/admin/pending-receipts] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch pending receipts",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
