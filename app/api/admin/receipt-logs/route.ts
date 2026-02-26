import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { getReceiptLogsForAdmin } from "@/lib/receipt/db";

import { isAdminUser } from "@/lib/auth/admin-users";

export async function GET(req: Request) {
  try {
    const username = await getSessionUsername();

    if (!username || !isAdminUser(username)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const hours = parseInt(searchParams.get("hours") || "48", 10);
    const limit = parseInt(searchParams.get("limit") || "500", 10);

    const receipts = await getReceiptLogsForAdmin(hours, limit);

    return NextResponse.json({
      success: true,
      receipts,
      count: receipts.length,
    });
  } catch (error) {
    console.error("[api/admin/receipt-logs] error:", error);
    return NextResponse.json(
      { success: false, error: "Log listesi alınamadı" },
      { status: 500 }
    );
  }
}
