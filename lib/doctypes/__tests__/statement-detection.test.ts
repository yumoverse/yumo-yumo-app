/**
 * Tests for statement detection improvements
 * Ensures "Son ödeme tarihi" alone is NOT enough, and e-Arşiv fatura signals reduce statement score
 */

import { classifyDocType } from "../classifier";
import { OCRLine } from "../../receipt/types";

describe("Statement Detection", () => {
  it("should NOT classify netgsm e-Arşiv fatura as statement", () => {
    // netgsm e-Arşiv fatura has "Son ödeme tarihi" but is NOT a statement
    const ocrText = `
      e-Arşiv Fatura
      Fatura No: ETTN123456789
      Senaryo: EARSIVFATURA
      Son ödeme tarihi: 15.01.2024
      Toplam: 1.000,00 TL
      KDV: 180,00 TL
    `;

    const ocrLines: OCRLine[] = ocrText.split("\n")
      .filter(line => line.trim())
      .map((text, idx) => ({ text: text.trim(), lineNo: idx + 1 }));

    const result = classifyDocType(ocrText, ocrLines);

    // Should NOT be classified as statement
    expect(result.docType).not.toBe("statement");
    expect(result.docType).toBe("invoice"); // Should be invoice
  });

  it("should classify enpara kredi kartı ekstresi as statement", () => {
    // enpara kredi kartı ekstresi has multiple strong signals
    const ocrText = `
      Kredi Kartı Ekstresi
      Minimum ödeme tutarı: 500,00 TL
      Ekstre borcu: 5.000,00 TL
      Kart limiti: 10.000,00 TL
      Faiz oranı: 1,5%
      Son ödeme tarihi: 15.01.2024
      Asgari ödeme: 500,00 TL
    `;

    const ocrLines: OCRLine[] = ocrText.split("\n")
      .filter(line => line.trim())
      .map((text, idx) => ({ text: text.trim(), lineNo: idx + 1 }));

    const result = classifyDocType(ocrText, ocrLines);

    // Should be classified as statement (has multiple strong signals)
    expect(result.docType).toBe("statement");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("should require 2-3 evidences for statement classification", () => {
    // Only "Son ödeme tarihi" - should NOT be enough
    const ocrText = `
      Fatura
      Son ödeme tarihi: 15.01.2024
      Toplam: 1.000,00 TL
    `;

    const ocrLines: OCRLine[] = ocrText.split("\n")
      .filter(line => line.trim())
      .map((text, idx) => ({ text: text.trim(), lineNo: idx + 1 }));

    const result = classifyDocType(ocrText, ocrLines);

    // Should NOT be statement (only weak phrase)
    expect(result.docType).not.toBe("statement");
  });
});
