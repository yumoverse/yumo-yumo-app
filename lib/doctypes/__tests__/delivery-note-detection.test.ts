/**
 * Unit tests for delivery note detection
 * 
 * Tests that:
 * 1. TR e-Arşiv invoices with "İrsaliye yerine geçer" are NOT classified as delivery_note
 * 2. Real delivery notes with strong phrases ARE classified as delivery_note
 */

import { hasDeliveryNoteStrongPhrase, isDeliveryNoteExclusion } from "../signals";
import { analyzeReceiptGate } from "../receiptGate";
import { classifyDocType } from "../classifier";
import type { OCRLine } from "@/lib/receipt/types";

describe("Delivery Note Detection", () => {
  describe("isDeliveryNoteExclusion", () => {
    it("should exclude 'irsaliye yerine geçer' from delivery_note detection", () => {
      const result = isDeliveryNoteExclusion("irsaliye", "İrsaliye yerine geçer");
      expect(result).toBe(true);
    });

    it("should exclude 'irsaliye yerine geçer.' (with period)", () => {
      const result = isDeliveryNoteExclusion("irsaliye", "İrsaliye yerine geçer.");
      expect(result).toBe(true);
    });

    it("should exclude 'irsaliye yerine geçer,' (with comma)", () => {
      const result = isDeliveryNoteExclusion("irsaliye", "İrsaliye yerine geçer,");
      expect(result).toBe(true);
    });

    it("should NOT exclude 'sevk irsaliyesi' (real delivery note phrase)", () => {
      const result = isDeliveryNoteExclusion("sevk irsaliyesi", "Sevk İrsaliyesi No: 12345");
      expect(result).toBe(false);
    });
  });

  describe("hasDeliveryNoteStrongPhrase", () => {
    it("should NOT detect delivery_note from e-Arşiv invoice with 'İrsaliye yerine geçer'", () => {
      const ocrText = `
        TÜR: e-ARŞİV FATURA
        ETTN: abc123def456
        KDV: 18.00
        Toplam: 100.00 TL
        İrsaliye yerine geçer
      `;
      
      const ocrLines: OCRLine[] = ocrText.split("\n").map((text, index) => ({
        text: text.trim(),
        boundingBox: { x: 0, y: index * 20, width: 100, height: 20 },
      }));

      const result = hasDeliveryNoteStrongPhrase(ocrText, ocrLines);
      expect(result.found).toBe(false);
      expect(result.matches).toHaveLength(0);
    });

    it("should detect delivery_note from real delivery note with strong phrases", () => {
      const ocrText = `
        SEVK İRSALİYESİ
        İrsaliye No: 12345
        Sevk Tarihi: 15.01.2025
        Teslim Edan: ABC Nakliyat
        Teslim Alan: XYZ Şirketi
        Araç Plaka: 34 ABC 123
      `;
      
      const ocrLines: OCRLine[] = ocrText.split("\n").map((text, index) => ({
        text: text.trim(),
        boundingBox: { x: 0, y: index * 20, width: 100, height: 20 },
      }));

      const result = hasDeliveryNoteStrongPhrase(ocrText, ocrLines);
      expect(result.found).toBe(true);
      expect(result.matches.length).toBeGreaterThanOrEqual(2); // At least 2 strong phrases
    });
  });

  describe("analyzeReceiptGate - e-Arşiv Invoice", () => {
    it("should classify e-Arşiv invoice as 'invoice' (not delivery_note)", () => {
      const ocrText = `
        TÜR: e-ARŞİV FATURA
        ETTN: abc123def456ghi789
        Fatura No: INV-2025-001
        Tarih: 15.01.2025
        KDV: 18.00
        Toplam: 100.00 TL
        İrsaliye yerine geçer
        Ödeme: Nakit
      `;
      
      const ocrLines: OCRLine[] = ocrText.split("\n").map((text, index) => ({
        text: text.trim(),
        boundingBox: { x: 0, y: index * 20, width: 100, height: 20 },
      }));

      const result = analyzeReceiptGate(ocrText, ocrLines);
      
      // Should be classified as invoice, NOT delivery_note
      expect(result.docType).toBe("invoice");
      expect(result.confidence).toBeGreaterThan(0.7);
      
      // Should NOT contain delivery_note reasons
      const hasDeliveryNoteReason = result.reasons.some(r => 
        r.includes("delivery_note") || r.includes("delivery note")
      );
      expect(hasDeliveryNoteReason).toBe(false);
    });
  });

  describe("analyzeReceiptGate - Real Delivery Note", () => {
    it("should classify real delivery note as 'other' (reject)", () => {
      const ocrText = `
        SEVK İRSALİYESİ
        İrsaliye No: 12345
        Sevk Tarihi: 15.01.2025
        Çıkış Tarihi: 15.01.2025 08:00
        Teslim Edan: ABC Nakliyat Ltd. Şti.
        Teslim Alan: XYZ Şirketi A.Ş.
        Araç Plaka: 34 ABC 123
        Yükleme Yeri: İstanbul Depo
        Boşaltma Yeri: Ankara Depo
      `;
      
      const ocrLines: OCRLine[] = ocrText.split("\n").map((text, index) => ({
        text: text.trim(),
        boundingBox: { x: 0, y: index * 20, width: 100, height: 20 },
      }));

      const result = analyzeReceiptGate(ocrText, ocrLines);
      
      // Should be classified as 'other' (reject) because it's a delivery note
      expect(result.docType).toBe("other");
      expect(result.confidence).toBeGreaterThan(0.8);
      
      // Should contain delivery_note reasons
      const hasDeliveryNoteReason = result.reasons.some(r => 
        r.includes("delivery_note") || r.includes("Delivery note")
      );
      expect(hasDeliveryNoteReason).toBe(true);
    });
  });

  describe("classifyDocType - e-Arşiv Invoice", () => {
    it("should classify e-Arşiv invoice as 'invoice' (not delivery_note)", () => {
      const ocrText = `
        TÜR: e-ARŞİV FATURA
        ETTN: abc123def456ghi789
        Fatura No: INV-2025-001
        Tarih: 15.01.2025
        KDV: 18.00
        Toplam: 100.00 TL
        İrsaliye yerine geçer
        Ödeme: Nakit
      `;
      
      const ocrLines: OCRLine[] = ocrText.split("\n").map((text, index) => ({
        text: text.trim(),
        boundingBox: { x: 0, y: index * 20, width: 100, height: 20 },
      }));

      const result = classifyDocType(ocrText, ocrLines);
      
      // Should be classified as invoice, NOT delivery_note or other
      expect(result.docType).toBe("invoice");
      expect(result.confidence).toBeGreaterThan(0.5);
      
      // Should NOT contain delivery_note reasons
      const hasDeliveryNoteReason = result.reasons.some(r => 
        r.includes("delivery_note") || r.includes("delivery note")
      );
      expect(hasDeliveryNoteReason).toBe(false);
    });
  });
});





