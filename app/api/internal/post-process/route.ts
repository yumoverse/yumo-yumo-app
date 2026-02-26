/**
 * Internal: Faz2 post-process worker (Oracle plan).
 * POST /api/internal/post-process?receiptId=...
 * Idempotent: skips if post_process_state is not pending.
 *
 * Requires Authorization: Bearer <INTERNAL_SECRET> header.
 */

import { NextResponse } from "next/server";
import { runPostProcess } from "@/lib/receipt/post-process/run-post-process";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function checkInternalAuth(req: Request): boolean {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!checkInternalAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const receiptId = searchParams.get("receiptId");
  if (!receiptId || receiptId.trim() === "") {
    return NextResponse.json({ error: "receiptId required" }, { status: 400 });
  }

  const result = await runPostProcess(receiptId.trim());
  if (!result.ok && result.state === "not_found") {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json(result);
}
