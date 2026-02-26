"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { Button } from "@/components/ui/button";
import { Stepper } from "@/components/ui/stepper";
import { DesktopUploadMessage } from "@/components/app/desktop-upload-message";
import { ReceiptUploadCard } from "../components/receipt-upload-card";
import { useIsDesktop } from "@/lib/hooks/use-is-desktop";
import { AppShell } from "@/components/app/app-shell";
import { ExtractionReviewCard } from "../components/extraction-review-card";
import { BreakdownCard } from "../components/breakdown-card";
import { RewardCard } from "../components/reward-card";
import { EvidenceDrawer } from "../components/evidence-drawer";
import { EvidenceModal } from "../components/evidence-modal";
import { MiningModal, type MiningStep } from "../components/mining-modal";
import { StyledReceipt } from "../components/styled-receipt";
import { ThemeCard } from "@/components/app/theme-card";
import { ThemeBg } from "@/components/app/theme-bg";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, LayoutDashboard, Upload, AlertTriangle } from "lucide-react";
import type { ReceiptAnalysis } from "@/lib/receipt/types";
import { getCategoryRates } from "@/lib/receipt/calculations";
import { useAppLocale, translateApiError } from "@/lib/i18n/app-context";
import { useAppProfile } from "@/lib/app/profile-context";
import { useEffect } from "react";

const STEPS = ["Upload", "Review", "Breakdown"];

export default function UploadPage() {
  const isDesktop = useIsDesktop();
  const { t } = useAppLocale();
  const { connected, publicKey } = useWallet();
  const { profile } = useAppProfile();
  const router = useRouter();
  const accountLevel = profile?.accountLevel ?? 1;
  const [currentStep, setCurrentStep] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<ReceiptAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [miningStep, setMiningStep] = useState<MiningStep>("uploading");
  const [showMiningModal, setShowMiningModal] = useState(false);
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [thankYouSummary, setThankYouSummary] = useState<{ receiptId: string; merchantName?: string; ayumo?: number; ryumo?: number } | null>(null);

  useEffect(() => {
    setIsAdmin(!!profile?.isAdmin);
  }, [profile?.isAdmin]);

  if (isDesktop && !isAdmin) {
    return (
      <AppShell>
        <DesktopUploadMessage />
      </AppShell>
    );
  }

  const handleFileUpload = async (file: File) => {
    console.log('[upload] 📤 Starting upload for:', file.name, (file.size / 1024 / 1024).toFixed(2), 'MB');

    let fileToUpload = file;
    let convertedImageFile: File | null = null;
    
    // If PDF, convert to image on client-side
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      try {
        const { convertPdfToImageClient } = await import("@/lib/utils/client-pdf-to-image");
        fileToUpload = await convertPdfToImageClient(file);
        convertedImageFile = fileToUpload; // Store converted image for later use
        console.log("[upload] PDF converted to image on client-side");
      } catch (pdfError: any) {
        console.error("[upload] PDF conversion error:", pdfError);
        alert(t("errors.upload.pdfFailed"));
        setShowMiningModal(false);
        return;
      }
    }

    console.log('[upload] 📦 Uploading file (server will compress if needed):', (fileToUpload.size / 1024).toFixed(0), 'KB');
    
    // Set the file to display (use converted image if PDF was converted)
    setUploadedFile(convertedImageFile || file);
    setShowMiningModal(true);
    setMiningStep("uploading");
    
    const formData = new FormData();
    formData.append("file", fileToUpload);

    try {
      setMiningStep("uploading");
      const response = await fetch("/api/receipt/upload", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Upload failed:", response.status, errorData);
        throw new Error(errorData.error || errorData.details || `Upload failed: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.receiptId) {
        throw new Error("No receipt ID returned from server");
      }
      
      setReceiptId(data.receiptId);
      
      // Automatically start analysis after upload (pass marginViolation and original size if available)
      await handleAnalyze(data.receiptId, data.marginViolation, data.size);
    } catch (error: any) {
      console.error("Upload failed:", error);
      const msg = translateApiError(error?.message, t) || t("errors.upload.unknown");
      alert(`${t("errors.upload.uploadFailed")}: ${msg}`);
      setShowMiningModal(false);
    }
  };

  const handleAnalyze = async (id?: string, marginViolation?: any, originalFileSizeBytes?: number) => {
    const receiptIdToUse = id || receiptId;
    if (!receiptIdToUse) return;

    setIsAnalyzing(true);
    setShowMiningModal(true);
    
    try {
      // Step 1: OCR
      setMiningStep("ocr");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Extraction
      setMiningStep("extraction");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 3: Merchant
      setMiningStep("merchant");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 4: Calculation (server-side)
      setMiningStep("calculation");
      
      const analyzeBody: Record<string, unknown> = { receiptId: receiptIdToUse, marginViolation };
      if (typeof originalFileSizeBytes === "number" && originalFileSizeBytes > 0) {
        analyzeBody.originalFileSizeBytes = originalFileSizeBytes;
      }
      const response = await fetch("/api/receipt/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analyzeBody),
      });
      
      if (!response.ok) {
        // Read response as text first (can only read once)
        const text = await response.text();
        let errorData;
        
        try {
          errorData = JSON.parse(text);
        } catch (e) {
          // If response is not JSON, use text as error message
          throw new Error(`Server error (${response.status}): ${text || response.statusText}`);
        }
        
        const errorMessage = errorData.message || errorData.error || "Analysis failed";
        
        // Handle specific error cases
        if (response.status === 422) {
          // Low confidence or missing data
          const details = errorData.details || {};
          const confidenceInfo = details.totalConfidence !== undefined 
            ? `\n\nConfidence scores:\n- Total: ${(details.totalConfidence * 100).toFixed(0)}%\n- Date: ${(details.dateConfidence * 100).toFixed(0)}%\n- VAT: ${(details.vatConfidence * 100).toFixed(0)}%`
            : '';
          
          throw new Error(`${errorMessage}${confidenceInfo}\n\nPlease try uploading a clearer image or a different receipt.`);
        } else if (response.status === 409) {
          // Duplicate receipt
          throw new Error(`${errorMessage}\n\nThis receipt has already been processed.`);
        } else if (response.status === 404) {
          // Receipt file not found
          throw new Error(`${errorMessage}\n\nPlease try uploading the receipt again.`);
        } else if (response.status === 400) {
          // Bad request
          throw new Error(`${errorMessage}\n\nPlease check the receipt image and try again.`);
        } else {
          // Other errors - include more details
          const details = errorData.details ? `\n\nDetails: ${errorData.details}` : '';
          throw new Error(`${errorMessage}${details}\n\nPlease try again or contact support if the problem persists.`);
        }
      }
      
      const data = await response.json();
      
      // Step 5: Verification
      setMiningStep("verification");
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 6: Complete
      setMiningStep("complete");
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setAnalysis(data);
      setShowMiningModal(false);
      // Show evidence modal automatically after analysis completes
      setShowEvidenceModal(true);
      // Skip merchant step, go directly to breakdown
      setCurrentStep(2);
    } catch (error: any) {
      console.error("Analysis failed:", error);
      console.error("Error details:", {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      });
      
      setShowMiningModal(false);
      setMiningStep("uploading"); // Reset step
      
      // Show user-friendly error message (locale-aware)
      const rawMessage = error?.message || "Failed to analyze receipt. Please try again.";
      const errorMessage = translateApiError(rawMessage, t) || t("errors.api.analyzeFailed");
      
      // Log full error for debugging
      console.error("Full error object:", error);
      
      alert(errorMessage);
      
      // Reset state to allow retry
      setUploadedFile(null);
      setReceiptId(null);
      setAnalysis(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Merchant selection removed - merchant is automatically determined from OCR

  const handleSave = async () => {
    if (!analysis) return;
    if (!isAdmin && !publicKey) {
      alert(t("errors.upload.walletRequired") || "Fişi kaydetmek için cüzdan bağlamanız gerekiyor.");
      return;
    }

    setIsSaving(true);

    try {
      console.log("[upload] Saving receipt:", analysis.receiptId);
      const statusToSave = analysis.status === "pending" ? "pending" : "saved";
      let body: string;
      try {
        body = JSON.stringify({
          ...analysis,
          status: statusToSave,
          walletAddress: publicKey?.toString() ?? undefined,
        });
      } catch (serializeErr: any) {
        console.error("[upload] Serialize failed:", serializeErr);
        throw new Error("Ödül verisi gönderilemedi. Sayfayı yenileyip tekrar deneyin.");
      }

      const response = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        credentials: "include",
      });

      const responseText = await response.text();
      if (!response.ok) {
        const errorData = responseText ? (() => { try { return JSON.parse(responseText); } catch { return { error: responseText }; } })() : { error: "Unknown error" };
        console.error("[upload] Save failed:", response.status, errorData);
        if (response.status === 401) {
          throw new Error("Oturum bulunamadı veya süresi dolmuş. Lütfen tekrar giriş yapın (cüzdan bağlayıp imzalayın).");
        }
        throw new Error((errorData as any).error || (errorData as any).details || `Kayıt başarısız: ${response.status}`);
      }

      const saved = responseText ? JSON.parse(responseText) : {};
      console.log("[upload] Receipt saved successfully:", saved.receiptId);
      setThankYouSummary({
        receiptId: analysis.receiptId,
        merchantName: analysis.merchant?.name,
        ayumo: analysis.reward?.final,
        ryumo: analysis.reward?.ryumo != null ? Number(analysis.reward.ryumo) : 0,
      });
      setShowThankYouModal(true);
    } catch (error: any) {
      console.error("[upload] Save failed:", error);
      const msg = error?.message || translateApiError(error?.message, t) || t("errors.upload.unknown");
      alert(`${t("errors.upload.saveFailed")}: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Admin: masaüstünde dosya yükleme cüzdan zorunlu değil (oturum yeterli). Diğer kullanıcılar cüzdan bağlamalı.
  if (!isAdmin && !connected) {
    return (
      <div className="min-h-screen bg-[var(--app-bg-shell)] text-[var(--app-text-primary)] relative font-sans">
        <ThemeBg accountLevel={1} />
        <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
          <ThemeCard accountLevel={1} className="max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--app-text-primary)" }}>
              Cüzdanı Bağla
            </h2>
            <p className="text-sm mb-4" style={{ color: "var(--app-text-muted)" }}>
              Fiş yüklemek için Solana cüzdanınızı bağlayın.
            </p>
            <WalletConnectButton />
          </ThemeCard>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <Stepper steps={STEPS} currentStep={currentStep} className="mb-6" />

        {/* Mining Modal */}
        <MiningModal 
          open={showMiningModal} 
          currentStep={miningStep}
        />

        {/* Evidence Modal - Shows automatically after analysis */}
        {analysis && (
          <EvidenceModal
            open={showEvidenceModal}
            onClose={() => setShowEvidenceModal(false)}
            flags={analysis.flags}
            ocr={analysis.ocr}
          />
        )}

        {/* Teşekkür modalı - Kaydet sonrası */}
        <Dialog open={showThankYouModal} onOpenChange={setShowThankYouModal}>
          <DialogContent className="sm:max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <div className="flex items-center gap-2 text-primary">
                <CheckCircle2 className="h-6 w-6" />
                <DialogTitle>Teşekkürler</DialogTitle>
              </div>
              <DialogDescription asChild>
                <div className="space-y-2 pt-1">
                  <p>Fişiniz kaydedildi.</p>
                  {thankYouSummary && (
                    <div className="rounded-lg border bg-muted/50 p-3 text-left space-y-2">
                      {thankYouSummary.merchantName && (
                        <p className="font-medium text-foreground">{thankYouSummary.merchantName}</p>
                      )}
                      <div>
                        <p className="text-2xl font-bold text-primary">
                          Toplam ödül: {( (thankYouSummary.ayumo ?? 0) + (thankYouSummary.ryumo ?? 0) ).toFixed(2)}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          aYUMO: {(thankYouSummary.ayumo ?? 0).toFixed(2)} · rYUMO: {(thankYouSummary.ryumo ?? 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  )}
                  <p className="text-muted-foreground">Ne yapmak istersiniz?</p>
                </div>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button
                className="w-full gap-2"
                onClick={() => {
                  setShowThankYouModal(false);
                  setThankYouSummary(null);
                  router.push(thankYouSummary ? `/app/receipts/${thankYouSummary.receiptId}` : "/app/receipts");
                }}
              >
                <LayoutDashboard className="h-4 w-4" />
                Panele git
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2 border-[var(--app-border)]"
                onClick={() => {
                  setShowThankYouModal(false);
                  setThankYouSummary(null);
                  setCurrentStep(0);
                  setAnalysis(null);
                  setUploadedFile(null);
                  setReceiptId(null);
                  setShowMiningModal(false);
                }}
              >
                <Upload className="h-4 w-4" />
                Yeni fiş yükle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Step 0: Upload */}
        {currentStep === 0 && (
          <div className="space-y-4">
            <ReceiptUploadCard
              accountLevel={accountLevel}
              onUpload={handleFileUpload}
              uploadedFile={uploadedFile}
              onRemove={() => {
                setUploadedFile(null);
                setReceiptId(null);
                setAnalysis(null);
                setShowMiningModal(false);
              }}
            />
          </div>
        )}

        {/* Step 1: Review Extraction */}
        {currentStep === 1 && analysis && (
          <div className="space-y-4">
            <ThemeCard accountLevel={accountLevel} className="p-4">
              <ExtractionReviewCard extraction={analysis.extraction} />
            </ThemeCard>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(0)}
                className="flex-1 border-[var(--app-border)]"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Geri
              </Button>
              <Button onClick={() => setCurrentStep(2)} className="flex-1">
                İleri
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Styled Receipt & Reward (2-column layout) */}
        {currentStep === 2 && analysis && (
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <ThemeCard accountLevel={accountLevel} className="p-4">
                <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--app-text-primary)" }}>
                  Düzenlenen Fiş
                </h3>
                <StyledReceipt analysis={analysis} locale="tr" className="flex-1" />
              </ThemeCard>
              <div className="flex flex-col gap-4">
                <ThemeCard accountLevel={accountLevel} className="p-4">
                  <h3 className="text-lg font-semibold mb-3" style={{ color: "var(--app-text-primary)" }}>
                    Potansiyel Ödül
                  </h3>
                  <RewardCard reward={analysis.reward} qualityHonor={analysis.qualityHonor} />
                </ThemeCard>
                {analysis.qualityHonor && ["MEDIUM", "RISKY", "HIGH"].includes(analysis.qualityHonor.level) && (
                  <ThemeCard accountLevel={accountLevel} className="p-4 border-primary/30">
                    <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--app-text-primary)" }}>{t("honor.tipsTitle")}</h4>
                    <ul className="text-sm space-y-1" style={{ color: "var(--app-text-muted)" }}>
                      <li>• {t("honor.tipPhoto")}</li>
                      <li>• {t("honor.tipCondition")}</li>
                      <li>• {t("honor.tipBackground")}</li>
                    </ul>
                  </ThemeCard>
                )}
                {isAdmin && analysis.rejectionInfo && analysis.rejectionInfo.length > 0 && (
                  <div className="rounded-lg border border-red-500/60 bg-red-500/10 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-red-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span className="text-xs font-semibold uppercase tracking-wide">Normal kullanıcı için reddedilirdi</span>
                    </div>
                    {analysis.rejectionInfo.map((info, i) => (
                      <div key={i} className="text-xs space-y-1">
                        <p className="font-medium text-red-300">{info.reason}</p>
                        {info.reasons && info.reasons.length > 0 && (
                          <ul className="pl-3 space-y-0.5 text-red-400/80">
                            {info.reasons.map((r, j) => (
                              <li key={j}>• {r}</li>
                            ))}
                          </ul>
                        )}
                        {info.stage && (
                          <p className="text-red-500/60 text-[10px]">Aşama: {info.stage}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <ThemeCard accountLevel={accountLevel} className="p-4">
                  <BreakdownCard
                    pricing={analysis.pricing}
                    hiddenCost={analysis.hiddenCost}
                    showEstimate={getCategoryRates(analysis.merchant.category).isEstimate}
                  />
                </ThemeCard>
              </div>
            </div>
            <EvidenceDrawer flags={analysis.flags} ocr={analysis.ocr} />
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1 min-w-[100px] border-[var(--app-border)]">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Geri
              </Button>
              <Button variant="outline" onClick={() => { setCurrentStep(0); setAnalysis(null); setUploadedFile(null); setReceiptId(null); setShowMiningModal(false); }} className="flex-1 min-w-[100px] border-[var(--app-border)]">
                İptal
              </Button>
              <Button onClick={handleSave} disabled={isSaving} className="flex-1 min-w-[100px]">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Kaydediliyor...
                  </>
                ) : (
                  "Kaydet"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}