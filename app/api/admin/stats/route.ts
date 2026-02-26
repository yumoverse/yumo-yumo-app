import { NextResponse } from "next/server";
import { getReceiptCountAll } from "@/lib/receipt/db";
import { getSessionUsername } from "@/lib/auth/session";

import { isAdminUser } from "@/lib/auth/admin-users";

export async function GET() {
  try {
    const username = await getSessionUsername();

    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isAdminUser(username)) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const totalReceipts = await getReceiptCountAll();

    return NextResponse.json({ totalReceipts });
  } catch (error: any) {
    console.error("[api/admin/stats] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch admin stats",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
