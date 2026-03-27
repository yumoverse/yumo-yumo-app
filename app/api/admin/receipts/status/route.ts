import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { isAdminUser } from "@/lib/auth/admin-users";
import { getSql, warmUpConnection } from "@/lib/db/client";
import { getReceiptById } from "@/lib/receipt/storage-db";

const ALLOWED_STATUSES = new Set(["scanned", "pending", "analyzed", "verified", "rejected"]);

function mapPostProcessState(status: string): string {
  switch (status) {
    case "verified":
      return "verified";
    case "scanned":
    case "pending":
    case "analyzed":
      return "pending";
    case "rejected":
      return "failed";
    default:
      return "pending";
  }
}

export async function POST(req: Request) {
  try {
    const username = await getSessionUsername();
    if (!username) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isAdminUser(username)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "Admin status edit is local-only" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const receiptId = typeof body?.receiptId === "string" ? body.receiptId.trim() : "";
    const statusRaw = typeof body?.status === "string" ? body.status.trim().toLowerCase() : "";
    if (!receiptId) {
      return NextResponse.json({ error: "receiptId is required" }, { status: 400 });
    }
    if (!ALLOWED_STATUSES.has(statusRaw)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json({ error: "Database not available" }, { status: 503 });
    }
    await warmUpConnection();

    const postProcessState = mapPostProcessState(statusRaw);
    await sql`
      UPDATE receipts
      SET
        status = ${statusRaw},
        post_process_state = ${postProcessState},
        updated_at = now(),
        receipt_data = jsonb_set(
          COALESCE(receipt_data, '{}'::jsonb),
          '{status}',
          to_jsonb(${statusRaw}::text),
          true
        )
      WHERE receipt_id = ${receiptId}
    `;

    const updated = await getReceiptById(receiptId, username, true);
    if (!updated) {
      return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, receipt: updated });
  } catch (error: any) {
    console.error("[api/admin/receipts/status] POST error:", error);
    return NextResponse.json(
      { error: "Failed to update receipt status", details: error?.message ?? String(error) },
      { status: 500 }
    );
  }
}

