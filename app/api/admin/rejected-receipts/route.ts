import { NextResponse } from "next/server";
import { getRejectedReceiptsAll } from "@/lib/receipt/storage-db";
import { getSessionUsername } from "@/lib/auth/session";

import { isAdminUser } from "@/lib/auth/admin-users";

export async function GET(req: Request) {
  try {
    const username = await getSessionUsername();

    if (!username) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const isAdmin = isAdminUser(username);
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - Admin access required" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 200);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const receipts = await getRejectedReceiptsAll(limit, offset);

    return NextResponse.json({ receipts });
  } catch (error: any) {
    console.error("[api/admin/rejected-receipts] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch rejected receipts",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
