/**
 * Admin: approve a merchant (set tier to candidate or verified).
 * POST body: { merchantId: string, tier: "candidate" | "verified" }
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

    let body: { merchantId?: string; tier?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { merchantId, tier } = body;
    if (!merchantId || typeof merchantId !== "string" || !merchantId.trim()) {
      return NextResponse.json(
        { error: "merchantId is required" },
        { status: 400 }
      );
    }
    const newTier =
      tier === "verified" ? "verified" : "candidate";

    const idParam = merchantId.trim();
    const update = await db.query<{ id: string }>(
      `UPDATE merchants SET tier = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id`,
      [newTier, idParam]
    );
    if (!update.rows || update.rows.length === 0) {
      return NextResponse.json(
        { error: "Merchant not found or no row updated" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      merchantId: update.rows[0].id,
      tier: newTier,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : undefined;
    console.error("[api/admin/approve-merchant] POST error:", message, code ?? "", e);
    return NextResponse.json(
      {
        error: "Failed to approve merchant",
        detail: process.env.NODE_ENV === "development" ? message : undefined,
      },
      { status: 500 }
    );
  }
}
