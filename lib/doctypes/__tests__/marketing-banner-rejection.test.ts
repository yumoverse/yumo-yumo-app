/**
 * Unit tests for marketing banner/infographic rejection
 * 
 * Tests that marketing banners are rejected and LLM is not called
 */

import { analyzeReceiptGate } from "../receiptGate";
import type { OCRLine } from "@/lib/receipt/types";

function createOCRLines(text: string): OCRLine[] {
  return text.split("\n").map((text, index) => ({
    text: text.trim(),
    boundingBox: { x: 0, y: index * 20, width: 100, height: 20 },
  })).filter(line => line.text.length > 0);
}

describe("Marketing Banner Rejection", () => {
  describe("Marketing Banner Detection", () => {
    it("should REJECT marketing banner with 'Did you think you knew where your money went?'", () => {
      const ocrText = `
        Did you think you knew where your money went?
        System
        Product Value
        $9.99
        State
        Store
        Brand
      `;
      
      const ocrLines = createOCRLines(ocrText);
      const result = analyzeReceiptGate(ocrText, ocrLines);
      
      // Should be rejected
      expect(result.passed).toBe(false);
      expect(result.docType).toBe("other");
      expect(result.structureEvidenceCount).toBeLessThan(2);
      
      // Should have marketing banner reason
      const hasMarketingBannerReason = result.reasons.some(r => 
        r.includes("marketing banner") || r.includes("marketing_banner")
      );
      expect(hasMarketingBannerReason).toBe(true);
      
      // Should have insufficient structure evidence reason
      const hasInsufficientStructure = result.reasons.some(r => 
        r.includes("insufficient receipt structure evidence")
      );
      expect(hasInsufficientStructure).toBe(true);
    });

    it("should REJECT banner with single monetary value and no receipt keywords", () => {
      const ocrText = `
        Coming Soon
        Join Us Now
        Special Offer
        $9.99
        Limited Time
      `;
      
      const ocrLines = createOCRLines(ocrText);
      const result = analyzeReceiptGate(ocrText, ocrLines);
      
      // Should be rejected
      expect(result.passed).toBe(false);
      expect(result.structureEvidenceCount).toBeLessThan(2);
      
      // Should have marketing banner indicator
      const hasMarketingBannerReason = result.reasons.some(r => 
        r.includes("marketing banner") || r.includes("Single monetary value")
      );
      expect(hasMarketingBannerReason).toBe(true);
    });
  });

  describe("Structure Evidence Requirement", () => {
    it("should REJECT document with only 1 structure evidence", () => {
      const ocrText = `
        MERCHANT NAME
        $9.99
      `;
      
      const ocrLines = createOCRLines(ocrText);
      const result = analyzeReceiptGate(ocrText, ocrLines);
      
      // Should be rejected (only merchant evidence, no payment/tax/itemized)
      expect(result.passed).toBe(false);
      expect(result.structureEvidenceCount).toBeLessThan(2);
      expect(result.reasons.some(r => r.includes("insufficient receipt structure evidence"))).toBe(true);
    });

    it("should ACCEPT receipt with >= 2 structure evidences", () => {
      const ocrText = `
        MERCHANT NAME
        Phone: +90 212 123 45 67
        Address: Test Street
        
        Item 1              10.00 TL
        Item 2              20.00 TL
        Item 3              15.00 TL
        
        Subtotal            45.00 TL
        KDV                  8.10 TL
        Toplam              53.10 TL
        
        Nakit                60.00 TL
        Para Üstü            6.90 TL
      `;
      
      const ocrLines = createOCRLines(ocrText);
      const result = analyzeReceiptGate(ocrText, ocrLines);
      
      // Should pass (merchant + itemized + payment + tax = 4 structure evidences)
      expect(result.passed).toBe(true);
      expect(result.structureEvidenceCount).toBeGreaterThanOrEqual(2);
      expect(result.docType).toBe("receipt");
    });
  });

  describe("Layout Heuristic Fix", () => {
    it("should NOT pass layout check with only 1 money line", () => {
      const ocrText = `
        Did you think you knew where your money went?
        Product Value
        $9.99
      `;
      
      const ocrLines = createOCRLines(ocrText);
      const result = analyzeReceiptGate(ocrText, ocrLines);
      
      // Should be rejected
      expect(result.passed).toBe(false);
      
      // Should NOT have layout pass reason (requires >= 4 money lines)
      const hasLayoutPass = result.reasons.some(r => 
        r.includes("receipt-like layout") && r.includes("right-aligned prices")
      );
      expect(hasLayoutPass).toBe(false);
    });

    it("should pass layout check with >= 4 money lines", () => {
      const ocrText = `
        MERCHANT NAME
        
        Item 1              10.00 TL
        Item 2              20.00 TL
        Item 3              15.00 TL
        Item 4              25.00 TL
        
        Subtotal            70.00 TL
        KDV                 12.60 TL
        Toplam              82.60 TL
      `;
      
      const ocrLines = createOCRLines(ocrText);
      const result = analyzeReceiptGate(ocrText, ocrLines);
      
      // Should pass (has >= 4 money lines)
      expect(result.passed).toBe(true);
    });
  });
});





