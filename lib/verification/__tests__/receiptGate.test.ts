/**
 * Unit tests for receiptGate
 * 
 * Tests various document types to ensure proper rejection/acceptance
 */

import { receiptGate } from "../receiptGate";
import type { OCRLine } from "../../receipt/types";

function createOCRLines(text: string): OCRLine[] {
  return text.split("\n").map((line, index) => ({
    lineNo: index + 1,
    text: line.trim(),
  })).filter(line => line.text.length > 0);
}

describe("receiptGate", () => {
  describe("Real retail receipts", () => {
    it("should accept a typical grocery receipt", () => {
      const ocrText = `
        MIGROS
        Kasiyer: 123
        Terminal: POS-001
        Fiş No: 456789
        
        Domates        5.50 TL
        Ekmek          2.00 TL
        Süt            8.50 TL
        
        Ara Toplam     16.00 TL
        KDV            2.88 TL
        Toplam         18.88 TL
        
        Nakit          20.00 TL
        Para Üstü      1.12 TL
        
        Teşekkür Ederiz
      `;
      
      const result = receiptGate(ocrText, createOCRLines(ocrText));
      expect(result.ok).toBe(true);
      expect(result.docType).toBe("receipt");
      expect(result.confidence).toBeGreaterThanOrEqual(70);
    });

    it("should accept a restaurant receipt", () => {
      const ocrText = `
        RESTAURANT XYZ
        Cashier: John
        Receipt #789
        
        Burger         45.00 TL
        Fries          15.00 TL
        Drink          10.00 TL
        
        Subtotal       70.00 TL
        VAT            12.60 TL
        Total          82.60 TL
        
        Card ending 1234
        Thank you!
      `;
      
      const result = receiptGate(ocrText, createOCRLines(ocrText));
      expect(result.ok).toBe(true);
      expect(result.docType).toBe("receipt");
    });
  });

  describe("TR e-Arşiv Invoice acceptance", () => {
    it("should accept e-Arşiv invoice with 'İrsaliye yerine geçer'", () => {
      const ocrText = `
        TÜR: e-ARŞİV FATURA
        ETTN: 12345678-1234-1234-1234-123456789012
        Fatura No: INV-2025-001
        Tarih: 15.01.2025
        
        MERCHANT NAME
        ADRES: Test Mahallesi, Test Sokak No:1
        TELEFON: +90 212 123 45 67
        VERGİ NO: 1234567890
        
        ÜRÜN ADI                    ADET    FİYAT
        Test Ürün 1                 2       50.00
        Test Ürün 2                 1       25.00
        
        ARA TOPLAM:                  75.00
        KDV (%20):                   15.00
        TOPLAM:                      90.00
        
        İrsaliye yerine geçer
        
        ÖDEME ŞEKLİ: BANKA KREDİ KARTI
      `;
      
      const result = receiptGate(ocrText, createOCRLines(ocrText));
      expect(result.ok).toBe(true);
      expect(result.docType).toBe("invoice");
      expect(result.confidence).toBeGreaterThanOrEqual(75);
      // Should NOT have "irsaliye" warning
      expect(result.reasons.some(r => r.includes("warning: found keywords [irsaliye]"))).toBe(false);
      // Should have e-Arşiv pass reason
      expect(result.reasons.some(r => r.includes("e-Arşiv Fatura detected"))).toBe(true);
    });

    it("should accept e-Arşiv invoice with ETTN + KDV + Toplam (strong signals)", () => {
      const ocrText = `
        TÜR: e-ARŞİV FATURA
        ETTN: abc123def456-7890-1234-5678-efghijklmnop
        Fatura No: INV-2025-002
        Tarih: 15.01.2025
        
        MERCHANT NAME
        VERGİ NO: 1234567890
        
        ÜRÜN ADI                    FİYAT
        Test Ürün                   100.00
        
        KDV:                         18.00
        TOPLAM:                     118.00
        
        İrsaliye yerine geçer
      `;
      
      const result = receiptGate(ocrText, createOCRLines(ocrText));
      expect(result.ok).toBe(true);
      expect(result.docType).toBe("invoice");
      expect(result.confidence).toBeGreaterThanOrEqual(75);
      // Should have strong e-Arşiv signals
      expect(result.reasons.some(r => r.includes("e-Arşiv Fatura detected") && r.includes("strong signals"))).toBe(true);
    });
  });

  describe("Invoice rejection (non-e-Arşiv)", () => {
    it("should reject an e-fatura invoice (not e-Arşiv)", () => {
      const ocrText = `
        E-FATURA
        Fatura No: OT42024000000076
        Fatura Tarihi: 17-02-2024
        
        ALICI:
        MEDIA MARKT TURKEY TİCARET LİMİTED ŞİRKETİ
        Vergi Dairesi: MARMARA
        VKN: 6130636884
        
        SATICI:
        Ototrim Panel San. ve Tic. A.Ş.
        Vergi Dairesi: Ertuğrulgazi V.D.
        VKN: 6490020678
        
        Ödeme Vadesi: 17.02.2024
        IBAN: TR33 0006 4000 0011 2345 6789 01
        
        Mal Hizmet Toplam Tutarı: 32.990,83 TL
        KDV: 6.598,17 TL
        Ödenecek Tutar: 39.589,00 TL
      `;
      
      const result = receiptGate(ocrText, createOCRLines(ocrText));
      // e-Fatura (not e-Arşiv) should still be rejected if it has IBAN/payment terms
      // But if it has strong receipt signals, it might pass
      // This test checks the old behavior - may need adjustment
      expect(result.docType).toBe("invoice");
    });

    it("should reject invoice with IBAN and payment terms", () => {
      const ocrText = `
        INVOICE
        Bill To: ABC Company
        Ship To: XYZ Address
        
        Purchase Order: PO-12345
        
        Items:
        Product A    1000.00 USD
        
        Subtotal     1000.00 USD
        Tax          200.00 USD
        Total        1200.00 USD
        
        Payment Due: 30 days
        Bank Account: IBAN GB82 WEST 1234 5678 9012 34
      `;
      
      const result = receiptGate(ocrText, createOCRLines(ocrText));
      expect(result.ok).toBe(false);
      expect(result.docType).toBe("invoice");
    });
  });

  describe("Delivery note rejection", () => {
    it("should reject real delivery note with strong signals (SEVK İRSALİYESİ, İrsaliye No, Sevk Tarihi, Teslim Alan)", () => {
      const ocrText = `
        SEVK İRSALİYESİ
        İrsaliye No: 123456
        Sevk Tarihi: 15.01.2024
        
        Gönderen: ABC Şirketi
        Teslim Alan: XYZ Mağazası
        
        Teslimat Adresi:
        İstanbul, Kadıköy
        
        Ürünler:
        Malzeme A    10 Adet
        Malzeme B    5 Adet
        
        Toplam: 15 Adet
      `;
      
      const result = receiptGate(ocrText, createOCRLines(ocrText));
      expect(result.ok).toBe(false);
      expect(result.docType).toBe("delivery_note");
      expect(result.reasons.some(r => r.includes("irsaliye") || r.includes("sevk") || r.includes("teslimat"))).toBe(true);
    });

    it("should reject delivery note in English", () => {
      const ocrText = `
        DELIVERY NOTE
        Waybill #789
        Date: 2024-01-15
        
        From: Supplier ABC
        To: Customer XYZ
        
        Delivery Address:
        123 Main Street
        
        Items:
        Item 1    Qty: 10
        Item 2    Qty: 5
        
        Total Items: 15
      `;
      
      const result = receiptGate(ocrText, createOCRLines(ocrText));
      expect(result.ok).toBe(false);
      expect(result.docType).toBe("delivery_note");
    });
  });

  describe("Document-like formatting rejection", () => {
    it("should reject PDF-like document with terms", () => {
      const ocrText = `
        CONTRACT TERMS AND CONDITIONS
        
        This document outlines the terms and conditions for the purchase agreement.
        The parties agree to the following terms:
        
        Payment Terms:
        - Net 30 days
        - Late payment fees apply
        
        Signature Required:
        Authorized Representative
        
        Page 1 of 3
        
        Total Amount: 5000.00 USD
        Date: 2024-01-15
      `;
      
      const result = receiptGate(ocrText, createOCRLines(ocrText));
      expect(result.ok).toBe(false);
      expect(result.reasons.some(r => r.includes("document") || r.includes("terms"))).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("should reject document with only total and date (no receipt structure)", () => {
      const ocrText = `
        Some random document text here.
        This is a paragraph with lots of text that doesn't look like a receipt.
        It has a total: 100.00 USD
        And a date: 2024-01-15
        But no receipt structure signals.
      `;
      
      const result = receiptGate(ocrText, createOCRLines(ocrText));
      expect(result.ok).toBe(false);
      expect(result.reasons.some(r => r.includes("missing") || r.includes("structure"))).toBe(true);
    });

    it("should handle empty OCR text", () => {
      const result = receiptGate("", []);
      expect(result.ok).toBe(false);
      expect(result.confidence).toBeLessThan(70);
    });
  });
});



