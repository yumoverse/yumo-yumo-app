import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getSessionUsername } from "@/lib/auth/session";
import type { OCRLine, ReceiptAnalysis } from "@/lib/receipt/types";
import { resolveCurrency } from "@/lib/currency/resolveCurrency";
import { extractMerchant, extractDate, extractTime } from "@/lib/receipt/ocr-extraction";
import { formatMerchantAmpersandAsVe } from "@/lib/mining/contextFactors";
import { classifyDocType } from "@/lib/doctypes/classifier";
import { quickImageGate } from "@/lib/doctypes/imageGate";
import { analyzeReceiptGate } from "@/lib/doctypes/receiptGate";
import { extractTotalRobust, extractVATRobust } from "@/lib/extractors/robust-extraction";
import { detectCountryFromText, getCountryConfig } from "@/lib/country/registry";
import OpenAI from "openai";
import { isPdfBuffer } from "@/lib/utils/pdf-to-image";

const UPLOAD_DIR = path.join(process.cwd(), ".data", "uploads");

// Helper function to parse Turkish number format
function parseLooseNumber(text: string): number | null {
  if (!text) return null;
  
  // Remove currency symbols and whitespace
  let cleaned = text.replace(/[₺$€£¥฿₹]/g, "").trim();
  
  // Turkish format: "3.125,00" = 3125.00 (dot = thousands, comma = decimal)
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }
  // Standard format: "3125.00" or "3125,00"
  else if (/,/.test(cleaned) && !/\./.test(cleaned)) {
    cleaned = cleaned.replace(",", ".");
  }
  
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function convertFullTextToOCRLines(fullText: string): OCRLine[] {
  return fullText
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((text, index) => ({
      lineNo: index + 1,
      text: text.trim(),
    }));
}

export const runtime = 'nodejs';

// Initialize AI service client
const aiService = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

/**
 * Quick analysis - returns only basic info (merchant, date, total, currency)
 * This is much faster than full analysis as it skips breakdown/reward calculations
 */
export async function POST(req: Request) {
  try {
    // Get username from cookie
    const username = await getSessionUsername();

    if (!username) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's selected country
    const { isAdminUser, getMultiCountryUsernames } = await import("@/lib/auth/admin-users");
    const multiCountryUsernames = getMultiCountryUsernames();
    const isAdmin = isAdminUser(username);
    
    let userCountry: string | null = null;
    try {
      const { readUsers } = await import("@/lib/storage/user-country-storage");
      const users = await readUsers();
      const user = users.find((u) => u.username === username);
      userCountry = user?.country || null;
    } catch (error) {
      console.error("[api/receipt/analyze-quick] Failed to read user country:", error);
    }

    if (!isAdmin && !multiCountryUsernames.includes(username) && !userCountry) {
      return NextResponse.json(
        { error: "Please select your country first" },
        { status: 400 }
      );
    }

    let body;
    try {
      body = await req.json();
    } catch (parseError: unknown) {
      const errorDetails = parseError instanceof Error ? parseError.message : String(parseError);
      return NextResponse.json(
        { error: "Invalid JSON in request body", details: errorDetails },
        { status: 400 }
      );
    }

    const { receiptId } = body;
    if (!receiptId) {
      return NextResponse.json(
        { error: "receiptId is required" },
        { status: 400 }
      );
    }

    // Find uploaded file
    let fileBuffer: Buffer | null = null;
    
    // Try local file system first
    try {
      const files = await fs.readdir(UPLOAD_DIR).catch(() => []);
      const file = files.find((f) => f.startsWith(receiptId));
      if (file) {
        const filePath = path.join(UPLOAD_DIR, file);
        fileBuffer = await fs.readFile(filePath);
      }
    } catch (error) {
      console.warn("[api/receipt/analyze-quick] Local file not found, trying Vercel Blob...");
    }

    if (!fileBuffer) {
      return NextResponse.json(
        { error: "Receipt file not found" },
        { status: 404 }
      );
    }

    const imageBuffer = fileBuffer;
    const base64Image = imageBuffer.toString("base64");

    // STAGE 0: IMAGE GATE
    const imageGateResult = quickImageGate(imageBuffer, {
      format: "image/jpeg",
    });

    if (!imageGateResult.pass) {
      return NextResponse.json({
        receiptId,
        status: "rejected" as const,
        flags: {
          needsLLM: false,
          reasons: [],
          rejected: true,
          rejectionReasons: imageGateResult.reasons.slice(0, 2),
          gateConfidence: imageGateResult.confidence,
          docType: "unknown" as const,
        },
      });
    }

    // Call Google Vision API
    const apiKey = process.env.GOOGLE_VISION_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Vision API not configured" },
        { status: 500 }
      );
    }

    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    const visionResponse = await fetch(visionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              {
                type: "DOCUMENT_TEXT_DETECTION",
                maxResults: 1,
              },
            ],
          },
        ],
      }),
    });

    if (!visionResponse.ok) {
      const errorData = await visionResponse.text();
      return NextResponse.json(
        { error: "Failed to process image with Vision API" },
        { status: visionResponse.status }
      );
    }

    const visionData = await visionResponse.json();
    const textAnnotations = visionData.responses[0]?.textAnnotations || [];
    const fullText = textAnnotations[0]?.description || "";
    
    if (!fullText || fullText.trim().length < 10) {
      return NextResponse.json(
        {
          receiptId,
          status: "rejected" as const,
          flags: {
            needsLLM: false,
            reasons: [],
            rejected: true,
            rejectionReasons: ["No text detected in image"],
            gateConfidence: 0,
            docType: "unknown" as const,
          },
        },
        { status: 400 }
      );
    }

    const ocrLines = convertFullTextToOCRLines(fullText);

    // STAGE 1: RECEIPT GATE
    const receiptGateResult = analyzeReceiptGate(fullText, ocrLines);
    
    if (!receiptGateResult.passed || receiptGateResult.structureEvidenceCount < 2) {
      return NextResponse.json({
        receiptId,
        status: "rejected" as const,
        flags: {
          needsLLM: false,
          reasons: [],
          rejected: true,
          rejectionReasons: [
            "Document does not appear to be a receipt or invoice",
            `Insufficient receipt structure evidence (${receiptGateResult.structureEvidenceCount}/4 required, minimum 2)`,
          ],
          gateConfidence: receiptGateResult.confidence,
          docType: receiptGateResult.docType,
        },
      });
    }

    // DOC TYPE CLASSIFIER
    const docTypeResult = classifyDocType(fullText, ocrLines);
    
    // Map docType to ReceiptFlags.docType format
    const mapDocType = (docType: string): "receipt" | "invoice" | "delivery_note" | "unknown" => {
      if (docType === "receipt" || docType === "invoice") {
        return docType;
      }
      return "unknown";
    };
    
    if (docTypeResult.docType === "statement" && docTypeResult.confidence > 0.7) {
      return NextResponse.json({
        receiptId,
        status: "rejected" as const,
        flags: {
          needsLLM: false,
          reasons: [],
          rejected: true,
          rejectionReasons: [
            "This looks like a bank/credit card statement (not a receipt/invoice). Please upload a receipt or tax invoice.",
          ],
          gateConfidence: docTypeResult.confidence,
          docType: "unknown" as const,
        },
      });
    }

    // Detect country from OCR text
    // This will always return TR, TH, or GENERIC (never null)
    const detectedCountryCode = detectCountryFromText(fullText);
    const detectedCountry = detectedCountryCode === "GENERIC" ? (userCountry || "TH") : detectedCountryCode;
    const countryConfig = getCountryConfig(detectedCountryCode);
    
    // Quick extraction (no LLM, no breakdown calculations)
    const totalExtraction = extractTotalRobust(ocrLines, countryConfig);
    const vatExtraction = extractVATRobust(ocrLines, totalExtraction.value || 0, countryConfig);
    
    // Currency resolution
    const currencyResolution = resolveCurrency(
      fullText,
      ocrLines,
      detectedCountry,
      undefined,
      docTypeResult.docType,
      userCountry || null,
      false, // isAdmin
      countryConfig
    );

    // Merchant extraction from OCR (slip: ilk 5 satır, fiş: ilk 20 satır)
    const ocrMerchant = extractMerchant(ocrLines, {
      isPosSlip: !!docTypeResult.isPosSlip,
    });
    const merchantName = ocrMerchant.name !== "Unknown Merchant" && ocrMerchant.confidence > 0.3
      ? formatMerchantAmpersandAsVe(ocrMerchant.name)
      : "Unknown Merchant";

    // Date extraction
    const ocrDate = extractDate(ocrLines, countryConfig);
    const extractedDate = ocrDate.confidence > 0.3 ? ocrDate.value : new Date().toISOString().split("T")[0];

    // Time extraction (pass receipt date to prefer time near date and reject footer/camera timestamps)
    const dateLineIndex = ocrDate.sourceLine != null ? ocrLines.findIndex(l => l.lineNo === ocrDate.sourceLine) : undefined;
    const timeExtraction = extractTime(ocrLines, countryConfig, (dateLineIndex ?? -1) >= 0 ? dateLineIndex : undefined, extractedDate);

    // Return quick analysis result (basic info only)
    const quickAnalysis: Partial<ReceiptAnalysis> = {
      receiptId,
      status: "analyzed" as const,
      merchant: {
        name: merchantName,
        category: "other",
        country: detectedCountry,
      },
      extraction: {
        date: {
          value: extractedDate,
          confidence: ocrDate.confidence,
          sourceLine: ocrDate.sourceLine,
        },
        time: timeExtraction.confidence > 0.5 && timeExtraction.value ? {
          value: timeExtraction.value,
          confidence: timeExtraction.confidence,
          sourceLine: timeExtraction.sourceLine,
        } : undefined,
        total: {
          value: totalExtraction.value || 0,
          confidence: totalExtraction.confidence,
          sourceLine: totalExtraction.sourceLine,
        },
        vat: {
          value: vatExtraction.value || 0,
          confidence: vatExtraction.confidence,
          sourceLine: vatExtraction.sourceLine,
        },
      },
      pricing: {
        totalPaid: totalExtraction.value || 0,
        paidExTax: (totalExtraction.value || 0) - (vatExtraction.value || 0),
        paidPriceExTax: (totalExtraction.value || 0) - (vatExtraction.value || 0), // Legacy field
        vatAmount: vatExtraction.value || 0,
        stateLayerTax: vatExtraction.value || 0, // Legacy field
        currency: currencyResolution.currency,
        symbol: currencyResolution.symbol,
        importSystemRate: 0, // Not calculated in quick analysis
        retailHiddenRate: 0, // Not calculated in quick analysis
      },
      flags: {
        needsLLM: false,
        reasons: [],
        gateConfidence: receiptGateResult.confidence,
        docType: mapDocType(docTypeResult.docType),
      },
      ocr: {
        lines: ocrLines,
        rawText: fullText,
      },
    };

    return NextResponse.json(quickAnalysis);
  } catch (error: unknown) {
    console.error("[api/receipt/analyze-quick] error:", error);
    const errorDetails = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        error: "Failed to analyze receipt",
        details: errorDetails,
      },
      { status: 500 }
    );
  }
}
