import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { getFeedbackAll } from "@/lib/receipt/db/queries/feedback";
import { getReceiptById } from "@/lib/receipt/storage-db";
import { isAdminUser } from "@/lib/auth/admin-users";

export async function GET(req: Request) {
  try {
    const username = await getSessionUsername();

    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const rows = await getFeedbackAll(limit, offset);

    const feedbacks = await Promise.all(
      rows.map(async (row) => {
        let receipt = null;
        try {
          receipt = await getReceiptById(row.receipt_id, undefined, true);
        } catch {
          // Receipt may not exist yet (reported before claim)
        }
        return {
          id: row.id,
          receiptId: row.receipt_id,
          username: row.username,
          bugTypes: row.bug_types,
          createdAt: row.created_at,
          receipt: receipt ?? undefined,
        };
      })
    );

    return NextResponse.json({ feedbacks });
  } catch (error: any) {
    console.error("[api/admin/feedback] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch feedback",
        details: error?.message ?? String(error),
      },
      { status: 500 }
    );
  }
}
