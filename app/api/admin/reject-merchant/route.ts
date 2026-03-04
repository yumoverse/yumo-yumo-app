/**
 * Admin: reject (delete) an unverified merchant so it no longer appears in the list.
 * POST body: { merchantId: string }
 */

import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { db } from "@/lib/db/client";

import { isAdminUser } from "@/lib/auth/admin-users";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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

    let body: { merchantId?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const merchantId = body.merchantId?.trim();
    if (!merchantId) {
      return NextResponse.json(
        { error: "merchantId is required" },
        { status: 400 }
      );
    }

    // receipts.merchant_id references merchants(id) without ON DELETE CASCADE.
    // Nullify receipts first so the DELETE can succeed.
    await db.query(
      `UPDATE receipts SET merchant_id = NULL WHERE merchant_id = $1`,
      [merchantId]
    );

    const deleted = await db.query<{ id: string }>(
      `DELETE FROM merchants WHERE id = $1 AND tier = 'unverified' RETURNING id`,
      [merchantId]
    );
    if (!deleted.rows || deleted.rows.length === 0) {
      return NextResponse.json(
        { error: "Merchant not found or not unverified (cannot reject)" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      merchantId: deleted.rows[0].id,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/admin/reject-merchant] POST error:", message, e);
    return NextResponse.json(
      {
        error: "Failed to reject merchant",
        detail: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
