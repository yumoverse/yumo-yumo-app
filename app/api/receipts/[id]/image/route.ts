import { NextResponse } from "next/server";
import { getSessionUsername } from "@/lib/auth/session";
import { getSql } from "@/lib/db/client";

import { isAdminUser } from "@/lib/auth/admin-users";

/**
 * GET /api/receipts/[id]/image
 * Returns the original receipt image for download (admin only).
 * Uses blob_url from DB so admin always gets the real fiş image.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const username = await getSessionUsername();

    if (!username || !isAdminUser(username)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const idTrimmed = id?.trim() ?? id;
    if (!idTrimmed) {
      return NextResponse.json({ error: "Receipt ID required" }, { status: 400 });
    }

    const sql = getSql();
    if (!sql) {
      return NextResponse.json(
        { error: "Database not available" },
        { status: 503 }
      );
    }

    const rows = await sql`
      SELECT blob_url, receipt_data
      FROM receipts
      WHERE receipt_id = ${idTrimmed}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "Receipt not found", receiptId: idTrimmed },
        { status: 404 }
      );
    }

    const row = rows[0] as { blob_url: string | null; receipt_data: unknown };
    let imageUrl: string | null = row.blob_url;

    if (!imageUrl && row.receipt_data != null) {
      const parsed = typeof row.receipt_data === "string"
        ? JSON.parse(row.receipt_data as string) as Record<string, unknown>
        : (row.receipt_data as Record<string, unknown>);
      imageUrl = (parsed?.blobUrl ?? parsed?.imageUrl ?? null) as string | null;
    }

    const hasBlobUrl = imageUrl && typeof imageUrl === "string" && imageUrl.startsWith("http");

    if (hasBlobUrl && imageUrl) {
      const imageResponse = await fetch(imageUrl, { cache: "no-store" });
      if (imageResponse.ok) {
        const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
        const buffer = await imageResponse.arrayBuffer();
        const filename = `receipt-${idTrimmed.slice(0, 8)}.${contentType.includes("png") ? "png" : "jpg"}`;
        return new NextResponse(buffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        });
      }
      const status = imageResponse.status;
      const text = await imageResponse.text().catch(() => "");
      console.warn("[api/receipts/[id]/image] Blob fetch failed:", { status, receiptId: idTrimmed, urlPreview: imageUrl.length > 60 ? imageUrl.slice(0, 60) + "..." : imageUrl });
      // Fall through to try receipt_upload_fallback
    }

    // Fallback: image stored in receipt_upload_fallback (e.g. when Blob upload failed)
    try {
      const fallbackRows = await sql`
        SELECT image_data, content_type FROM receipt_upload_fallback WHERE receipt_id = ${idTrimmed} LIMIT 1
      `;
      if (fallbackRows.length > 0) {
        const row = fallbackRows[0] as { image_data: Buffer | Uint8Array; content_type: string | null };
        const data = row.image_data;
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as Uint8Array);
        const contentType = row.content_type || "image/jpeg";
        const filename = `receipt-${idTrimmed.slice(0, 8)}.${contentType.includes("png") ? "png" : "jpg"}`;
        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        });
      }
    } catch {
      /* table may not exist */
    }

    if (!hasBlobUrl) {
      return NextResponse.json(
        { error: "No image URL for this receipt", receiptId: idTrimmed },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "Image not found (blob may be deleted or expired)",
        receiptId: idTrimmed,
      },
      { status: 404 }
    );
  } catch (error: unknown) {
    console.error("[api/receipts/[id]/image] GET error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to fetch image", details: msg },
      { status: 500 }
    );
  }
}
