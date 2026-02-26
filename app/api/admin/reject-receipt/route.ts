import { NextResponse } from "next/server";
import { getReceiptById, saveReceipt } from "@/lib/receipt/storage-db";
import { getSessionUsername } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/admin-users";

export async function POST(req: Request) {
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

    const body = await req.json();
    const { receiptId, reason } = body;

    if (!receiptId) {
      return NextResponse.json(
        { error: "Receipt ID is required" },
        { status: 400 }
      );
    }

    // Get the receipt (admin can access any receipt)
    const receipt = await getReceiptById(receiptId, username, true);
    
    if (!receipt) {
      return NextResponse.json(
        { error: "Receipt not found" },
        { status: 404 }
      );
    }

    // Check if receipt is pending
    if (receipt.status !== "pending") {
      return NextResponse.json(
        { error: "Receipt is not pending approval" },
        { status: 400 }
      );
    }

    // Update status to rejected
    receipt.status = "rejected";
    
    // Add rejection reason to flags
    if (!receipt.flags) {
      receipt.flags = {
        needsLLM: false,
        reasons: [],
        rejected: true,
        rejectionReasons: [],
      };
    } else {
      receipt.flags.rejected = true;
      if (!receipt.flags.rejectionReasons) {
        receipt.flags.rejectionReasons = [];
      }
      if (reason) {
        receipt.flags.rejectionReasons.push(`Admin rejection: ${reason}`);
      } else {
        receipt.flags.rejectionReasons.push("Admin rejection: High value receipt rejected");
      }
    }

    // Save the updated receipt
    const saved = await saveReceipt(receipt);
    
    console.log(`[api/admin/reject-receipt] Receipt ${receiptId} rejected by ${username}`);
    
    return NextResponse.json({ 
      success: true, 
      receipt: saved 
    });
  } catch (error: any) {
    console.error("[api/admin/reject-receipt] POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to reject receipt",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
