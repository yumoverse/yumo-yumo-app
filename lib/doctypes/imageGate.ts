/**
 * Image Gate - Stage 0: Pre-OCR image analysis
 * Rejects chart-like images, infographics, and non-receipt graphics
 */

export interface ImageGateResult {
  pass: boolean;
  reasons: string[];
  confidence: number;
}

export interface ImageFeatures {
  averageSaturation: number;
  highSaturationPct: number;
  aspectRatio: number;
  hasLargeColorBlocks: boolean;
}

/**
 * Analyze image buffer to detect if it's a receipt or a graphic/chart
 */
export async function analyzeImageGate(
  imageBuffer: Buffer | Uint8Array,
  width?: number,
  height?: number
): Promise<ImageGateResult> {
  const reasons: string[] = [];
  let confidence = 1.0;

  try {
    // For now, we'll use heuristics based on image metadata
    // In production, you might want to use sharp or canvas to analyze pixels
    
    // If dimensions are provided, check aspect ratio
    if (width && height) {
      const aspectRatio = width / height;
      
      // Receipts typically have aspect ratios between 0.3 and 0.8 (portrait)
      // Charts/infographics often have aspect ratios closer to 1.0 (square) or wider
      if (aspectRatio > 0.7 && aspectRatio < 1.5) {
        reasons.push(`aspect_ratio: ${aspectRatio.toFixed(2)} (suspiciously square/wide for receipt)`);
        confidence -= 0.2;
      }
    }

    // For pixel-level analysis, we'd need to decode the image
    // This is a simplified version - in production, use sharp or canvas
    // For now, we'll rely on OCR gate for more detailed analysis
    
    // Check file size - very small files might be icons/graphics
    if (imageBuffer.length < 10000) {
      reasons.push("file_size: Very small file (might be icon/graphic)");
      confidence -= 0.1;
    }

    // If we have low confidence, reject
    if (confidence < 0.7) {
      return {
        pass: false,
        reasons: [
          "image_gate: Image appears to be a chart/infographic, not a receipt",
          ...reasons,
        ],
        confidence,
      };
    }

    return {
      pass: true,
      reasons: [],
      confidence: 1.0,
    };
  } catch (error: any) {
    // If analysis fails, pass through to OCR gate
    return {
      pass: true,
      reasons: [`image_gate: Analysis failed, passing to OCR gate: ${error.message}`],
      confidence: 0.5,
    };
  }
}

/**
 * Simplified image gate that works with image URLs or buffers
 * Uses basic heuristics without full pixel analysis
 */
export function quickImageGate(
  imageBuffer: Buffer | Uint8Array,
  metadata?: { width?: number; height?: number; format?: string }
): ImageGateResult {
  const reasons: string[] = [];
  let confidence = 1.0;

  // Check aspect ratio if available
  if (metadata?.width && metadata?.height) {
    const aspectRatio = metadata.width / metadata.height;
    
    // Receipts are typically portrait (0.3-0.8), charts are often square/wide (0.7-1.5)
    if (aspectRatio >= 0.7 && aspectRatio <= 1.5) {
      reasons.push(`aspect_ratio: ${aspectRatio.toFixed(2)} (suspicious for receipt)`);
      confidence -= 0.3;
    }
  }

  // Check file size
  const sizeKB = imageBuffer.length / 1024;
  if (sizeKB < 10) {
    reasons.push(`file_size: ${sizeKB.toFixed(1)}KB (very small, might be icon)`);
    confidence -= 0.2;
  }

  // Check format - receipts are usually JPEG/PNG, not SVG/GIF
  if (metadata?.format) {
    const format = metadata.format.toLowerCase();
    if (format === "svg" || format === "gif") {
      reasons.push(`format: ${format} (unusual for receipt)`);
      confidence -= 0.2;
    }
  }

  if (confidence < 0.6) {
    return {
      pass: false,
      reasons: [
        "image_gate: Image characteristics suggest chart/infographic, not receipt",
        ...reasons,
      ],
      confidence,
    };
  }

  return {
    pass: true,
    reasons: [],
    confidence: 1.0,
  };
}





