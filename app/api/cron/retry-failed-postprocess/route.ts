/**
 * Cron: Retry failed post-process (Oracle plan).
 * GET/POST /api/cron/retry-failed-postprocess
 * Finds receipts with post_process_state='failed' and post_process_failed_at > 24h ago,
 * post_process_retry_count < max (e.g. 5), and re-enqueues post-process.
 */

import { NextResponse } from "next/server";
import { sql } from "@/lib/db/client";
import { oraclePhases } from "@/config/oracle-phases";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_RETRIES = 5;
const RETRY_AFTER_HOURS = 24;

export async function GET(req: Request) {
  return runRetry(req);
}

export async function POST(req: Request) {
  return runRetry(req);
}

async function runRetry(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!oraclePhases.retryCronEnabled) {
    return NextResponse.json({ ok: true, disabled: true, message: "ORACLE_RETRY_CRON_ENABLED is not set" });
  }

  if (!sql) {
    return NextResponse.json({ error: "Database not available" }, { status: 503 });
  }

  const cutoff = new Date(Date.now() - RETRY_AFTER_HOURS * 60 * 60 * 1000);
  const rows = await sql`
    SELECT receipt_id FROM receipts
    WHERE post_process_state = 'failed'
      AND (post_process_failed_at IS NULL OR post_process_failed_at < ${cutoff})
      AND COALESCE(post_process_retry_count, 0) < ${MAX_RETRIES}
    LIMIT 100
  `;

  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const internalSecret = process.env.INTERNAL_SECRET;
  let enqueued = 0;
  for (const row of rows as { receipt_id: string }[]) {
    try {
      await fetch(`${base}/api/internal/post-process?receiptId=${encodeURIComponent(row.receipt_id)}`, {
        method: "POST",
        cache: "no-store",
        ...(internalSecret && { headers: { Authorization: `Bearer ${internalSecret}` } }),
      });
      enqueued++;
    } catch {
      // continue
    }
  }

  return NextResponse.json({ ok: true, found: rows.length, enqueued });
}
