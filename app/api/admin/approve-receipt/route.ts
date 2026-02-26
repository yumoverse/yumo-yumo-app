import { NextResponse } from "next/server";
import { getReceiptById, saveReceipt } from "@/lib/receipt/storage-db";
import { getSessionUsername } from "@/lib/auth/session";

// Admin users list
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
    const { receiptId } = body;

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

    // Update status to analyzed (approved)
    receipt.status = "analyzed";

    // Save the updated receipt
    const saved = await saveReceipt(receipt);
    
    console.log(`[api/admin/approve-receipt] Receipt ${receiptId} approved by ${username}`);
    
    return NextResponse.json({ 
      success: true, 
      receipt: saved 
    });
  } catch (error: any) {
    console.error("[api/admin/approve-receipt] POST error:", error);
    return NextResponse.json(
      {
        error: "Failed to approve receipt",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
