import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { getReceiptOcrForAdmin } from "@/lib/receipt/db";

import { isAdminUser } from "@/lib/auth/admin-users";
const MAX_OCR_DOWNLOAD = 1000;

export async function GET(req: Request) {
  try {
    const username = await getSessionUsername();

    if (!username || !isAdminUser(username)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const hours = parseInt(searchParams.get("hours") || "48", 10);
    let limit = parseInt(searchParams.get("limit") || String(MAX_OCR_DOWNLOAD), 10);
    limit = Math.min(MAX_OCR_DOWNLOAD, Math.max(1, limit));

    const receipts = await getReceiptOcrForAdmin(hours, limit);

    return NextResponse.json({
      success: true,
      receipts,
      count: receipts.length,
      maxAllowed: MAX_OCR_DOWNLOAD,
    });
  } catch (error) {
    console.error("[api/admin/ocr-download] error:", error);
    return NextResponse.json(
      { success: false, error: "RAW OCR listesi alınamadı" },
      { status: 500 }
    );
  }
}
