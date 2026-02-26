import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getSessionUsername } from "@/lib/auth/session";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID, createHash } from "crypto";
import { scheduleDeletion } from "@/lib/scheduled-deletion";
import { calculatePerceptualHash } from "@/lib/fraud/hash-utils";
import sharp from 'sharp';
import { db } from "@/lib/db/client";
import { isAdminUser, getWhatsAppExemptUsernames } from "@/lib/auth/admin-users";

/** Blob operations timeout (ms). If exceeded, image is stored in Neon fallback table. */
const BLOB_TIMEOUT_MS = 8000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

// Fallback: Vercel uses /tmp for temporary file storage (read-write)
// Local development uses .data/uploads
const isVercel = process.env.VERCEL === "1" || process.cwd().startsWith("/var/task");
const UPLOAD_DIR = isVercel
  ? path.join("/tmp", "uploads")
  : path.join(process.cwd(), ".data", "uploads");

// Check if Vercel Blob Storage is available
function isBlobStorageAvailable(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
    console.log("[api/receipt/upload] Directory check:", UPLOAD_DIR, error);
  }
}

export async function POST(req: Request) {
  console.log("=".repeat(80));
  console.log("[api/receipt/upload] 📤 FILE UPLOAD REQUEST RECEIVED");
  console.log("=".repeat(80));

  // Auth gate — must be called before any file parsing to avoid unauthenticated uploads
  const sessionUsername = await getSessionUsername();
  if (!sessionUsername) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      console.error("[api/receipt/upload] ❌ No file provided");
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Get location from form data (optional)
    const latitudeStr = formData.get("latitude") as string | null;
    const longitudeStr = formData.get("longitude") as string | null;
    let location: { lat: number; lng: number } | null = null;
    
    if (latitudeStr && longitudeStr) {
      const lat = parseFloat(latitudeStr);
      const lng = parseFloat(longitudeStr);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        location = { lat, lng };
        console.log(`[api/receipt/upload] 📍 Location received: ${lat}, ${lng}`);
      } else {
        console.warn(`[api/receipt/upload] ⚠️ Invalid location: ${latitudeStr}, ${longitudeStr}`);
      }
    }

    console.log("[api/receipt/upload] File received:", file.name, "Type:", file.type, "Size:", file.size);

    // Reuse the session validated at the top of the handler
    const uploadUsername = sessionUsername;
    const whatsAppExempt = getWhatsAppExemptUsernames();
    const isAdmin = uploadUsername ? isAdminUser(uploadUsername) : false;

    // REJECT screenshots and chat exports based on filename (admin + exempt users)
    const fileNameLower = file.name.toLowerCase();
    const isScreenshotFilename = /\b(screenshot|screen\s+shot|ekran\s+görüntü|ekran\s+kaydı|screen\s+capture|screen\s+recording|snapshot|ekran\s+resmi)\b/i.test(fileNameLower);
    const isChatFilename = /\b(whatsapp|whats\s*app|telegram|messenger|chat|conversation)\b/i.test(fileNameLower);

    if (isScreenshotFilename && !isAdmin) {
      console.error("[api/receipt/upload] ❌ REJECTED: Screenshot detected in filename:", file.name);
      return NextResponse.json(
        {
          error: "Screenshot detected - please upload a photo of a real receipt, not a screenshot",
          reason: "Filename contains screenshot-related keywords"
        },
        { status: 400 }
      );
    }
    if (isScreenshotFilename && isAdmin) {
      console.warn("[api/receipt/upload] ⚠️ ADMIN: Screenshot filename detected but allowed:", file.name);
    }
    if (isChatFilename && !isAdmin && !(uploadUsername && whatsAppExempt.includes(uploadUsername))) {
      console.error("[api/receipt/upload] ❌ REJECTED: Chat/WhatsApp export detected in filename:", file.name);
      return NextResponse.json(
        {
          error: "Please upload a photo of a receipt, not a chat or conversation export",
          reason: "Filename contains chat-related keywords (e.g. WhatsApp)"
        },
        { status: 400 }
      );
    }

    // Validate file type - accept images and PDFs
    const isValidImage = file.type.startsWith("image/");
    const isValidPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    
    if (!isValidImage && !isValidPdf) {
      console.error("[api/receipt/upload] Invalid file type:", file.type);
      return NextResponse.json(
        { error: "File must be an image or PDF" },
        { status: 400 }
      );
    }

    // Validate file size (4.5 MB limit for server uploads)
    const MAX_FILE_SIZE = 4.5 * 1024 * 1024; // 4.5 MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      console.error("[api/receipt/upload] File too large:", file.size, "bytes");
      return NextResponse.json(
        { 
          error: "File size exceeds 4.5 MB limit",
          maxSize: MAX_FILE_SIZE,
          receivedSize: file.size
        },
        { status: 400 }
      );
    }

    // Generate receipt ID
    const receiptId = randomUUID();
    
    // Calculate SHA-256 hash of file content for duplicate detection
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

  // Server-side compression (all images; client no longer compresses)
  let finalBuffer = buffer;
  let fullBufferForOcr: Buffer | null = null;
  const originalSize = buffer.length;

  // ⭐ YENİ: Çok büyük image dosyalarını önce agresif resize et (memory-safe)
if (originalSize > 4 * 1024 * 1024 && isValidImage) {
  console.log('[api/receipt/upload] 📐 Very large image detected:', (originalSize / 1024 / 1024).toFixed(2), 'MB');
  console.log('[api/receipt/upload] 🔄 Applying aggressive pre-resize for memory safety...');
  
  try {
    // İlk resize: Agresif boyut düşürme (memory-safe)
    const preResized = await sharp(buffer)
      .resize(2400, 2400, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toBuffer();
    
    finalBuffer = Buffer.from(preResized);
    console.log('[api/receipt/upload] ✅ Pre-resized:', (finalBuffer.length / 1024 / 1024).toFixed(2), 'MB');
  } catch (error) {
    console.error('[api/receipt/upload] ⚠️ Pre-resize failed, using original:', error);
    finalBuffer = buffer;
  }
}

// Compress if >500KB (single place for all compression)
if (finalBuffer.length > 500 * 1024) {
  console.log('[api/receipt/upload] 🗜️ Compressing:', (finalBuffer.length / 1024 / 1024).toFixed(2), 'MB');
  console.log('[api/receipt/upload] 📦 Applying server-side compression...');
  
  try {
    const compressedBuffer = await sharp(finalBuffer)
      .resize(1920, 1920, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    
    finalBuffer = Buffer.from(compressedBuffer);
    
    const newSize = finalBuffer.length;
    const reduction = ((1 - newSize / originalSize) * 100).toFixed(0);
    console.log('[api/receipt/upload] ✅ Server compression:', (newSize / 1024).toFixed(0), 'KB', `(-${reduction}%)`);
  } catch (error) {
    console.error('[api/receipt/upload] ⚠️ Server compression failed, using original:', error);
    finalBuffer = buffer; // Fallback
  }
}
  
  
    // Validate buffer
    if (!finalBuffer || finalBuffer.length === 0) {
      console.error("[api/receipt/upload] ❌ Invalid or empty buffer");
      return NextResponse.json(
        { error: "Invalid file data" },
        { status: 400 }
      );
    }
    
    const hash = createHash('sha256').update(finalBuffer).digest('hex');

    // Reuse username from cookie (already read above for WhatsApp exempt)
    const username = uploadUsername;

    // isAdmin already set above (for WhatsApp exempt + margin bypass)
    
    // ✅ Margin validation (sadece images için, PDF'ler için skip). E-fatura: margin muaf.
    let marginCheck: any = null;
    if (isValidImage) {
      try {
        const { isEfaturaExemptForMarginCheck } = await import('@/lib/utils/efatura-exempt');
        const efaturaExempt = await isEfaturaExemptForMarginCheck({
          buffer: finalBuffer,
          filename: file.name,
          mimeType: file.type,
        });
        if (efaturaExempt) {
          console.log("[api/receipt/upload] 📄 E-fatura/e-arşiv: margin kontrolü atlandı (muaf)");
          marginCheck = null;
        } else {
          const { validateReceiptMargins } = await import('@/lib/utils/receipt-validator');
          marginCheck = await validateReceiptMargins(finalBuffer);
        
        // Margin/brightness check: never reject at upload. Store result for analyze (edge+OCR rule).
        if (!marginCheck.valid) {
          const margins = marginCheck.margins as { top: number; bottom: number; left: number; right: number } | undefined;
          const marginThreshold = 3;

          if (marginCheck.reason === 'Could not detect receipt boundaries') {
            (marginCheck as any).hasMarginViolation = true;
            (marginCheck as any).violationCount = 0;
            (marginCheck as any).violations = ['Could not detect receipt boundaries (size/edge check failed)'];
            (marginCheck as any).margins = marginCheck.margins ?? { top: 0, bottom: 0, left: 0, right: 0 };
            (marginCheck as any).minRequired = { vertical: 4, horizontal: 4 };
            (marginCheck as any).edgesTouchBoundary = true; // assume worst case for analyze
            console.warn("[api/receipt/upload] ⚠️ Margin check failed (boundaries) — allowing upload; analyze will use edge+OCR rule");
          } else if (margins) {
            const verticalTiny = margins.top < marginThreshold && margins.bottom < marginThreshold;
            const horizontalTiny = margins.left < marginThreshold && margins.right < marginThreshold;
            (marginCheck as any).edgesTouchBoundary = verticalTiny || horizontalTiny;
            (marginCheck as any).hasMarginViolation = true;

            if (username) {
              const { countTodayMarginViolations, recordMarginViolation } = await import('@/lib/receipt/db/margin-violations');
              const todayViolations = await countTodayMarginViolations(username);
              await recordMarginViolation(username);
              (marginCheck as any).violationCount = todayViolations + 1;
              console.warn(`[api/receipt/upload] ⚠️ Margin violation #${todayViolations + 1} for ${username} — allowing upload; analyze will use edge+OCR rule`);
            }
          }
        } else if (marginCheck.croppedBuffer) {
          // Test: DISABLE_AUTO_CROP=1 ile kırpmayı atla (OCR alt satırlarının kesilip kesilmediğini test etmek için)
          const skipCrop = process.env.DISABLE_AUTO_CROP === "1" || process.env.DISABLE_AUTO_CROP === "true";
          if (skipCrop) {
            console.log("[api/receipt/upload] ⏭️ Auto-crop SKIPPED (DISABLE_AUTO_CROP=1) — using full image for OCR test");
          } else {
            // Keep full image for OCR fallback
            fullBufferForOcr = finalBuffer;
            finalBuffer = marginCheck.croppedBuffer;
            console.log("[api/receipt/upload] ✂️ Auto-cropped:", marginCheck.margins);
          }
        }
        }
      } catch (error: any) {
        console.warn("[api/receipt/upload] ⚠️ Margin validation error:", error?.message);
        // Fail-safe: orijinali kullan
      }
    }
    
    // Calculate perceptual hash for images (for visual similarity detection)
    let perceptualHash: string | null = null;
    if (isValidImage && buffer.length > 0) {
      try {
        const calculatedHash = await calculatePerceptualHash(finalBuffer); // ✅ finalBuffer kullan
        // Only set if we got a valid non-empty hash
        if (calculatedHash && calculatedHash.length > 0) {
          perceptualHash = calculatedHash;
          console.log("[api/receipt/upload] 🖼️ Perceptual hash calculated:", perceptualHash.substring(0, 16) + '...');
        } else {
          console.warn("[api/receipt/upload] ⚠️ Perceptual hash calculation returned empty string");
        }
      } catch (error: any) {
        console.warn("[api/receipt/upload] ⚠️ Failed to calculate perceptual hash:", error?.message);
        // Non-blocking - continue without perceptual hash
        perceptualHash = null;
      }
    }
    
    console.log("[api/receipt/upload] 🆔 Generated receipt ID:", receiptId);
    console.log("[api/receipt/upload] 🔐 File hash (SHA-256):", hash);
    console.log("[api/receipt/upload] 📋 File details:", {
      name: file.name,
      type: file.type,
      size: `${(file.size / 1024).toFixed(2)} KB`
    });

    // ⭐ YENİ: DEBUG log ekle BURAYA
console.log("[api/receipt/upload] 🔍 DEBUG:", {
  VERCEL: process.env.VERCEL,
  NODE_ENV: process.env.NODE_ENV,
  isDevelopment: !process.env.VERCEL,
  blobAvailable: isBlobStorageAvailable()
});

    // Development: Vercel ortamında değilse local
const isDevelopment = !process.env.VERCEL;

if (isBlobStorageAvailable() && !isDevelopment) {
      try {
        console.log("[api/receipt/upload] Uploading to Vercel Blob Storage (max " + BLOB_TIMEOUT_MS / 1000 + "s)...");
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const blobName = `receipts/${receiptId}.${fileExtension}`;

        const blob = await withTimeout(
          put(blobName, finalBuffer, {
            access: 'public',
            contentType: file.type,
          }),
          BLOB_TIMEOUT_MS,
          "Blob upload timeout"
        );

        console.log("[api/receipt/upload] ✅ File uploaded to Vercel Blob Storage:", blob.url);

        // 🔥 Schedule automatic deletion after 90 days
        const DELETION_DELAY_HOURS = 90 * 24; // 2160 hours = 90 days
        const deletionScheduled = await scheduleDeletion(
          receiptId,
          blob.url,
          DELETION_DELAY_HOURS * 60 * 60 * 1000
        );
        if (deletionScheduled) {
          console.log(`[api/receipt/upload] ⏰ Scheduled blob deletion in ${DELETION_DELAY_HOURS} hours`);
        } else {
          console.warn("[api/receipt/upload] ⚠️ Failed to schedule blob deletion (non-blocking)");
        }

        console.log("=".repeat(80));
        console.log(`[api/receipt/upload] ✅ UPLOAD SUCCESS - Receipt ID: ${receiptId}`);
        console.log("=".repeat(80));

        let fullBlobUrl: string | undefined;
        if (fullBufferForOcr) {
          try {
            const fullBlob = await withTimeout(
              put(`receipts/${receiptId}.full.${fileExtension}`, fullBufferForOcr, {
                access: "public",
                contentType: file.type,
              }),
              BLOB_TIMEOUT_MS,
              "Blob full image upload timeout"
            );
            fullBlobUrl = fullBlob.url;
          } catch {
            console.warn("[api/receipt/upload] ⚠️ Full image blob upload failed or timed out (non-blocking)");
          }
        }

        return NextResponse.json({
          receiptId,
          filename: file.name,
          size: file.size,
          blobUrl: blob.url,
          fullBlobUrl,
          hash,
          perceptualHash,
          location,
          deletionScheduledAt: new Date(Date.now() + DELETION_DELAY_HOURS * 60 * 60 * 1000).toISOString(),
          marginViolation: (marginCheck as any)?.hasMarginViolation ? {
            hasViolation: true,
            violationCount: (marginCheck as any)?.violationCount || 0,
            reason: marginCheck.reason,
            violations: marginCheck.violations || [],
            margins: marginCheck.margins || {},
            minRequired: marginCheck.minRequired || {},
            edgesTouchBoundary: (marginCheck as any)?.edgesTouchBoundary ?? false,
            adminBypass: (marginCheck as any)?.adminBypass || undefined,
          } : undefined,
        });
      } catch (blobError: any) {
        const isTimeout = blobError?.message?.includes("timeout") || blobError?.message?.includes("Timeout");
        console.error("[api/receipt/upload] Blob failed" + (isTimeout ? " (timeout)" : "") + ", trying Neon fallback:", blobError?.message);

        try {
          await db.query(
            `INSERT INTO receipt_upload_fallback (receipt_id, image_data, content_type)
             VALUES ($1, $2, $3)
             ON CONFLICT (receipt_id) DO UPDATE SET image_data = $2, content_type = $3, created_at = NOW()`,
            [receiptId, finalBuffer, file.type || "image/jpeg"]
          );
          console.log("[api/receipt/upload] ✅ Image saved to Neon fallback (receipt_upload_fallback)");

          return NextResponse.json({
            receiptId,
            filename: file.name,
            size: file.size,
            blobUrl: null,
            fullBlobUrl: undefined,
            imageStoredInDb: true,
            hash,
            perceptualHash,
            location,
            marginViolation: (marginCheck as any)?.hasMarginViolation ? {
              hasViolation: true,
              violationCount: (marginCheck as any)?.violationCount || 0,
              reason: marginCheck.reason,
              violations: marginCheck.violations || [],
              margins: marginCheck.margins || {},
              minRequired: marginCheck.minRequired || {},
              edgesTouchBoundary: (marginCheck as any)?.edgesTouchBoundary ?? false,
              adminBypass: (marginCheck as any)?.adminBypass || undefined,
            } : undefined,
          });
        } catch (neonError: any) {
          console.error("[api/receipt/upload] Neon fallback failed, falling back to local:", neonError?.message);
          // Fall through to local storage
        }
      }
    }

    // Fallback to local file storage
    console.log("[api/receipt/upload] Using local file storage (fallback)");
    await ensureUploadDir();
    
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const filePath = path.join(UPLOAD_DIR, `${receiptId}.${fileExtension}`);
    console.log("[api/receipt/upload] Writing file to:", filePath);
    
    await writeFile(filePath, finalBuffer);
    if (fullBufferForOcr) {
      const fullFilePath = path.join(UPLOAD_DIR, `${receiptId}.full.${fileExtension}`);
      await writeFile(fullFilePath, fullBufferForOcr);
      console.log("[api/receipt/upload] ✅ Full image saved for OCR fallback:", fullFilePath);
    }
    console.log("[api/receipt/upload] ✅ File saved to local storage successfully");
    console.log("=".repeat(80));
    console.log(`[api/receipt/upload] ✅ UPLOAD SUCCESS - Receipt ID: ${receiptId}`);
    console.log("=".repeat(80));
    
    return NextResponse.json({
      receiptId,
      filename: file.name,
      size: file.size,
      hash, // SHA-256 hash for duplicate detection
      perceptualHash, // Perceptual hash for visual similarity detection
      location, // GPS location for Places API
      marginViolation: (marginCheck as any)?.hasMarginViolation ? {
        hasViolation: true,
        violationCount: (marginCheck as any)?.violationCount || 0,
        reason: marginCheck.reason,
        violations: marginCheck.violations || [],
        margins: marginCheck.margins || {},
        minRequired: marginCheck.minRequired || {},
        edgesTouchBoundary: (marginCheck as any)?.edgesTouchBoundary ?? false,
        adminBypass: (marginCheck as any)?.adminBypass || undefined,
      } : undefined,
    });
  } catch (error: any) {
    console.error("[api/receipt/upload] ❌ UPLOAD ERROR:", {
      message: error?.message,
      stack: error?.stack,
      code: error?.code,
      errno: error?.errno,
      path: error?.path,
      name: error?.name,
      cause: error?.cause,
    });
    console.error("[api/receipt/upload] Full error object:", error);
    return NextResponse.json(
      {
        error: "Failed to upload receipt",
        details: error?.message ?? String(error),
        code: error?.code,
      },
      { status: 500 }
    );
  }
}
