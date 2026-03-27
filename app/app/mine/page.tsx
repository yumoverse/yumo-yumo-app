"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { DesktopUploadMessage } from "@/components/app/desktop-upload-message";
import { ReceiptScanner } from "@/components/app/receipt-scanner";
import { useIsDesktop } from "@/lib/hooks/use-is-desktop";
import {
  ReceiptPipelineError,
  ReceiptAnalyzingStep,
  ReceiptResultWithBreakdownStep,
  ReceiptVectorReceiptStep,
  ReceiptDoneStep,
} from "@/components/app/receipt-pipeline-steps";
import { useAppProfile } from "@/lib/app/profile-context";
import { useQueryClient } from "@tanstack/react-query";
import { QUESTS_DAILY_QUERY_KEY, PROFILE_QUERY_KEY } from "@/lib/app/query-keys";
import type { Receipt } from "@/lib/mock/types";
import type { ReceiptAnalysis } from "@/lib/receipt/types";
import { convertReceiptAnalysisToReceipt } from "@/lib/receipt/receipt-converter";
import { generateSyntheticReceiptBlob } from "@/lib/receipt/synthetic-receipt";
import { toast } from "sonner";
import { useAppLocale, translateApiError } from "@/lib/i18n/app-context";
import { TimePickerModal } from "@/components/app/time-picker-modal";
import { QualityIssuesModal } from "@/components/app/quality-issues-modal";
import { checkImageQuality } from "@/lib/utils/image-quality-check";
import type { ImageQualityIssue } from "@/lib/utils/image-quality-check";
import { filenameSuggestsEfatura } from "@/lib/utils/efatura-exempt";


/**
 * Get user's GPS location (with permission)
 * Returns null if permission denied or unavailable
 */
async function getLocation(): Promise<{ lat: number; lng: number } | null> {
  if (!navigator.geolocation) {
    console.log("[getLocation] Geolocation not available");
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        console.log(`[getLocation] ✅ Location captured: ${location.lat}, ${location.lng}`);
        resolve(location);
      },
      (error) => {
        // User denied or error - non-blocking
        console.log(`[getLocation] ⚠️ Location not available: ${error.message}`);
        resolve(null);
      },
      {
        timeout: 5000,
        maximumAge: 60000, // Cache for 1 minute
        enableHighAccuracy: false, // Faster, less battery
      }
    );
  });
}

export default function MinePage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { t, locale } = useAppLocale();
  const { profile } = useAppProfile();
  const accountLevel = profile?.accountLevel ?? 1;
  const queryClient = useQueryClient();

  if (isDesktop) {
    return (
      <AppShell>
        <DesktopUploadMessage />
      </AppShell>
    );
  }
  
  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectionNoBackground, setRejectionNoBackground] = useState(false);
  const [isMining, setIsMining] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [syntheticReceiptUrl, setSyntheticReceiptUrl] = useState<string | null>(null);
  const [receiptNumber, setReceiptNumber] = useState<string>("");
  const [originalAnalysis, setOriginalAnalysis] = useState<ReceiptAnalysis | null>(null);
  const [miningProgress, setMiningProgress] = useState<number | null>(null);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [pendingTimeAnalysis, setPendingTimeAnalysis] = useState<{ analysis: ReceiptAnalysis; imageUrl: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [qualityIssues, setQualityIssues] = useState<ImageQualityIssue[]>([]);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<number>(0);
  const [pipelineLabel, setPipelineLabel] = useState<string>("");
  const [displayPipelineStep, setDisplayPipelineStep] = useState<number>(0);
  const [warmupProgress, setWarmupProgress] = useState<number>(0);
  const [canLeaveAnalyzeScreen, setCanLeaveAnalyzeScreen] = useState(false);
  const isAnalyzeScreen = currentStep === 1;
  const analyzeRunIdRef = useRef(0);
  const uploadAnalyzeInFlightRef = useRef(false);

  const PIPELINE_STAGE_LABELS: Record<number, string> = {
    0: t("mine.step.sendingFile"),
    1: "Doğrulama",
    2: "Dosya yükleniyor",
    3: "Metin okunuyor (OCR)",
    4: "Belge sınıflandırılıyor",
    5: "Veri çıkarılıyor",
    6: "Yapay zeka zenginleştirme",
    7: "Harici doğrulama",
    8: "Hile kontrolü",
    9: "Para birimi doğrulanıyor",
    10: "Tekrar kontrolü",
    11: "Fiyatlandırma",
  };

  // Step 0'da sayaç hemen hareket etsin: 0 → 8% yavaşça (2 saniyede)
  useEffect(() => {
    if (displayPipelineStep !== 0) return;
    setWarmupProgress(0);
    const t = setInterval(() => {
      setWarmupProgress((p) => (p >= 8 ? 8 : p + 1));
    }, 260);
    return () => clearInterval(t);
  }, [displayPipelineStep]);

  // Gösterilen adımı gerçek step'e kademeli yaklaştır (roket hızı olmasın: ~300ms per step)
  useEffect(() => {
    if (displayPipelineStep >= pipelineStep) return;
    const t = setInterval(() => {
      setDisplayPipelineStep((s) => (s >= pipelineStep ? s : s + 1));
    }, 300);
    return () => clearInterval(t);
  }, [pipelineStep, displayPipelineStep]);

  useEffect(() => {
    setIsAdmin(!!profile?.isAdmin);
  }, [profile?.isAdmin]);
  
  // Helper function to process analysis after time is confirmed
  const processAnalysisWithTime = async (
    fullAnalysis: ReceiptAnalysis, 
    imageUrl: string, 
    time?: string
  ) => {
    // Update analysis with user-provided time if given
    const updatedAnalysis = time ? {
      ...fullAnalysis,
      extraction: {
        ...fullAnalysis.extraction,
        time: {
          value: time,
          confidence: 1.0, // User-provided = high confidence
          sourceLine: -1, // Manual input
        }
      }
    } : fullAnalysis;
    
    // Store original analysis
    setOriginalAnalysis(updatedAnalysis);
    
    // Update receipt with full analysis data
    const fullReceipt = convertReceiptAnalysisToReceipt(updatedAnalysis, imageUrl);
    
    // Add time to receipt if provided (override extraction time)
    if (time) {
      fullReceipt.time = time;
    }
    
    setReceipt((prev) => {
      if (!prev) return fullReceipt;
      return {
        ...fullReceipt,
        imageUrl: prev.imageUrl || fullReceipt.imageUrl,
        time: fullReceipt.time || prev.time, // Preserve time from fullReceipt or keep previous
      };
    });
    
    // Generate synthetic receipt
    console.log("[mine] Full analysis completed, generating synthetic receipt...");
    
    try {
      const syntheticReceiptBlob = await generateSyntheticReceiptBlob({
        merchantName: fullReceipt.merchantName,
        date: fullReceipt.date,
        time: fullReceipt.time || time,
        category: fullReceipt.category || "other",
        total: fullReceipt.total,
        vat: fullReceipt.vat,
        currency: fullReceipt.currency,
        receiptNumber: receiptNumber,
      });
      const syntheticUrl = URL.createObjectURL(syntheticReceiptBlob);
      setSyntheticReceiptUrl(syntheticUrl);
      
      setReceipt(prev => prev ? { ...prev, imageUrl: syntheticUrl } : prev);
    } catch (err) {
      console.error("[mine] Failed to generate synthetic receipt:", err);
    }
    
    setMiningProgress(100);
    setCanLeaveAnalyzeScreen(false);
    setCurrentStep(2); // Analiz bitti → Sonuç adımına geç
  };
  
  // Handle time selection from modal
  const handleTimeConfirm = async (time: string) => {
    setShowTimeModal(false);
    
    if (pendingTimeAnalysis) {
      const { analysis, imageUrl } = pendingTimeAnalysis;
      setPendingTimeAnalysis(null);
      
      toast.success(t("mine.toast.timeSaved"), {
        description: time,
        duration: 3000,
      });
      
      setIsMining(true);
      await processAnalysisWithTime(analysis, imageUrl, time);
    }
  };
  
  // Handle time modal close (skip time)
  const handleTimeSkip = async () => {
    setShowTimeModal(false);
    
    if (pendingTimeAnalysis) {
      const { analysis, imageUrl } = pendingTimeAnalysis;
      setPendingTimeAnalysis(null);
      
      toast.info(t("mine.toast.timeSkipped"), {
        duration: 3000,
      });
      
      setIsMining(true);
      await processAnalysisWithTime(analysis, imageUrl, undefined);
    }
  };

  // Handle file selection and start analysis
  const handleFileSelect = async (file: File) => {
    if (!file || file.size === 0) {
      setSelectedFile(null);
      setReceipt(null);
      return;
    }
    if (isMining || uploadAnalyzeInFlightRef.current) return;
    uploadAnalyzeInFlightRef.current = true;

    setSelectedFile(file);
    setIsProcessing(true);
    setError(null);
    setRejectionNoBackground(false);

    try {
      let fileToUpload = file;
      let convertedImageFile: File | null = null;

      console.log('[mine] 📤 Uploading file (server will compress if needed):', (fileToUpload.size / 1024).toFixed(0), 'KB');

      // If PDF, convert to image on client-side
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        try {
          const { convertPdfToImageClient } = await import("@/lib/utils/client-pdf-to-image");
          fileToUpload = await convertPdfToImageClient(file);
          convertedImageFile = fileToUpload;
          console.log("[mine] PDF converted to image on client-side");
        } catch (pdfError: unknown) {
          console.error("[mine] PDF conversion error:", pdfError);
          const errorMessage = pdfError instanceof Error ? pdfError.message : String(pdfError);
          throw new Error(`${t("mine.error.pdfConversion")}: ${errorMessage}`);
        }
      }

      // PRE-UPLOAD QUALITY CHECK (only for photos/images; skip for PDFs and e-fatura filenames)
      // Mobilde büyük dosyalarda atla – S23 Ultra / iPhone’da full-size canvas bellek hatasına yol açıyor
      // Bellek garantisi: gorsel icin client'ta decode yok. bellek hatası devam ediyorsa çoğu kamerayı resize et (decode 2000px’te yapılsın)
      // Client-side resize KALDIRILDI (createImageBitmap/canvas = bellek hatasi). Dosya aynen sunucuya gidiyor; sikistirma sunucuda.

      // Gorsel icin client'ta quality check YOK (decode/canvas = bellek hatasi). Sunucu kaliteyi degerlendirir.

      // Gorsel icin object URL asla (decode = bellek hatasi). Sonuc/sentetik ile gosterilir.
      const imageUrl = '';
      // Open analysis screen immediately – no waiting for upload (tüm process bu ekranda ilerler)
      setCurrentStep(1);
      setIsMining(true);
      setMiningProgress(null);
      setCanLeaveAnalyzeScreen(false);
      setError(null);
      setIsProcessing(false);

      // Start location fetch in parallel (used for analyze; optional for upload)
      const locationPromise = getLocation();

      // Upload + analyze in background while user sees "Fiş analiz ediliyor" screen
      const formData = new FormData();
      formData.append("file", fileToUpload);

      fetch("/api/receipt/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      })
        .then(async (uploadResponse) => {
          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json().catch(() => ({ error: t("mine.error.upload") }));
            const msg = translateApiError(errorData.error, t) || t("mine.error.upload");
            toast.error(t("mine.error.upload"), { description: msg, duration: 5000 });
            setError(msg);
            setReceipt(null);
            setIsMining(false);
            setCurrentStep(0);
            try { URL.revokeObjectURL(imageUrl); } catch { /* ignore */ }
            return undefined;
          }

          const uploadData = await uploadResponse.json();
          console.log('🔍 UPLOAD DATA:', uploadData);
          console.log('🔍 BLOB URL:', uploadData.blobUrl);
          const receiptId = uploadData.receiptId;
          const hash = uploadData.hash;
          const perceptualHash = uploadData.perceptualHash;
          const filename = uploadData.filename;
          const blobUrl = uploadData.blobUrl;
          const marginViolation = uploadData.marginViolation;

          if (!receiptId) {
            toast.error(t("mine.error.upload"), { description: t("mine.error.noReceiptId"), duration: 5000 });
            setError(t("mine.error.noReceiptId"));
            setReceipt(null);
            setIsMining(false);
            setCurrentStep(0);
            try { URL.revokeObjectURL(imageUrl); } catch { /* ignore */ }
            return undefined;
          }

          const receiptNum = `REC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
          setReceiptNumber(receiptNum);
          setCanLeaveAnalyzeScreen(true);

          // Use location when ready (max 3s wait), then run analyze
          const gpsLocation = await Promise.race([
            locationPromise,
            new Promise<{ lat: number; lng: number } | null>((r) => setTimeout(() => r(null), 3000)),
          ]);
          if (gpsLocation) {
            console.log(`[mine] 📍 Location for analyze: ${gpsLocation.lat}, ${gpsLocation.lng}`);
          }

          console.log("[mine] Upload done, starting full analysis...");
          const analyzeBody: Record<string, unknown> = {
            receiptId,
            hash,
            perceptualHash,
            filename,
            blobUrl,
            location: gpsLocation,
            marginViolation,
          };
          if (typeof uploadData.size === "number" && uploadData.size > 0) {
            analyzeBody.originalFileSizeBytes = uploadData.size;
          }
          analyzeBody.stream = true;
          analyzeRunIdRef.current += 1;
          const thisRunId = analyzeRunIdRef.current;
          setPipelineStep(0);
          setPipelineLabel("");
          setDisplayPipelineStep(0);
          setWarmupProgress(0);
          setMiningProgress(null);
          return fetch("/api/receipt/analyze", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(analyzeBody),
          }).then((res) => ({ response: res, runId: thisRunId }));
        })
        .then(async (value: { response: Response; runId: number } | undefined) => {
          if (!value) return;
          const { response: fullResponse, runId } = value;
          if (!fullResponse.ok) {
            if (fullResponse.status === 401) {
              const sessionMsg = t("errors.sessionEnded");
              setError(sessionMsg);
              setReceipt(null);
              setIsMining(false);
              setCanLeaveAnalyzeScreen(false);
              setCurrentStep(0);
              try { URL.revokeObjectURL(imageUrl); } catch { /* ignore */ }
              toast.error(sessionMsg, { duration: 6000 });
              router.push("/app/login");
              return;
            }
            let errorMessage = t("errors.api.analyzeFailed");
            try {
              const errorData = await fullResponse.json();
              if (typeof errorData === "object" && errorData !== null) {
                const firstReason = Array.isArray(errorData.rejectionReasons) && errorData.rejectionReasons[0]
                  ? errorData.rejectionReasons[0]
                  : null;
                const primary = errorData.error || errorData.details || errorData.message;
                const raw = firstReason || primary;
                errorMessage = translateApiError(raw, t) || raw || t("errors.api.analyzeFailed");
                setRejectionNoBackground(firstReason === "Arka plan yok");
              }
            } catch {
              // Ignore parse errors
            }
            toast.error(t("mine.error.analyze"), { description: errorMessage, duration: 8000 });
            setError(errorMessage);
            setReceipt(null);
            setIsMining(false);
            setCanLeaveAnalyzeScreen(false);
            setCurrentStep(0);
            try { URL.revokeObjectURL(imageUrl); } catch { /* ignore */ }
            return;
          }
          
          const contentType = fullResponse.headers.get("content-type") ?? "";
          let fullAnalysis: ReceiptAnalysis | null = null;
          if (contentType.includes("ndjson") && fullResponse.body) {
            const reader = fullResponse.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const line of lines) {
                if (!line.trim()) continue;
                try {
                  const obj = JSON.parse(line) as { type: string; step?: number; label?: string; error?: string };
                  if (obj.type === "step" && typeof obj.step === "number" && typeof obj.label === "string") {
                    if (runId === analyzeRunIdRef.current) {
                      setPipelineStep(obj.step);
                      setPipelineLabel(obj.label);
                    }
                  } else if (obj.type === "done" && runId === analyzeRunIdRef.current) {
                    const { type: _t, ...payload } = obj as { type: string } & ReceiptAnalysis;
                    fullAnalysis = payload as ReceiptAnalysis;
                  } else if (obj.type === "error" && typeof obj.error === "string" && runId === analyzeRunIdRef.current) {
                    setError(obj.error);
                    setReceipt(null);
                    setIsMining(false);
                    setCanLeaveAnalyzeScreen(false);
                    setCurrentStep(0);
                    try { URL.revokeObjectURL(imageUrl); } catch { /* ignore */ }
                    toast.error(t("mine.error.analyze"), { description: obj.error, duration: 5000 });
                    return;
                  }
                } catch {
                  // skip malformed line
                }
              }
            }
            if (buffer.trim()) {
              try {
                const obj = JSON.parse(buffer) as { type: string; error?: string };
                if (obj.type === "done" && runId === analyzeRunIdRef.current) {
                  const { type: _t, ...payload } = obj as { type: string } & ReceiptAnalysis;
                  fullAnalysis = payload as ReceiptAnalysis;
                } else if (obj.type === "error" && typeof obj.error === "string" && runId === analyzeRunIdRef.current) {
                  setError(obj.error);
                  setReceipt(null);
                  setIsMining(false);
                  setCanLeaveAnalyzeScreen(false);
                  setCurrentStep(0);
                  try { URL.revokeObjectURL(imageUrl); } catch { /* ignore */ }
                  toast.error(t("mine.error.analyze"), { description: obj.error, duration: 5000 });
                  return;
                }
              } catch {
                // ignore
              }
            }
            if (!fullAnalysis && runId === analyzeRunIdRef.current) {
              setError(t("errors.api.analyzeFailed"));
              setReceipt(null);
              setIsMining(false);
              setCanLeaveAnalyzeScreen(false);
              setCurrentStep(0);
              try { URL.revokeObjectURL(imageUrl); } catch { /* ignore */ }
              return;
            }
            if (!fullAnalysis) return;
          } else {
            fullAnalysis = await fullResponse.json();
          }
          if (!fullAnalysis) {
            setError(t("errors.api.analyzeFailed"));
            setReceipt(null);
            setIsMining(false);
            setCanLeaveAnalyzeScreen(false);
            setCurrentStep(0);
            try { URL.revokeObjectURL(imageUrl); } catch { /* ignore */ }
            return;
          }
          
          // Check if receipt was rejected
          if (fullAnalysis.status === "rejected" || fullAnalysis.flags?.rejected) {
            const rejectionReasons = fullAnalysis.flags?.rejectionReasons || [];
            const rawRejection = rejectionReasons[0] || "This document doesn't appear to be a valid receipt.";
            const rejectionMessage = translateApiError(rawRejection, t) || rawRejection;
            setRejectionNoBackground(rawRejection === "Arka plan yok");
            
            toast.error(t("mine.error.rejected"), {
              description: rejectionMessage,
              duration: 5000,
            });
            
            setError(rejectionMessage);
            setReceipt(null);
            setIsMining(false);
            setCanLeaveAnalyzeScreen(false);
            setCurrentStep(0);
            try { URL.revokeObjectURL(imageUrl); } catch { /* ignore */ }
            return;
          }
          
          // Check for duplicate warning
          if (fullAnalysis.verification?.isDuplicate) {
            toast.warning(t("errors.duplicateWarning"), {
              description: t("mine.duplicateToastDesc", { id: fullAnalysis.verification.duplicateReceiptId?.substring(0, 8) ?? "" }),
              duration: 8000,
            });
          }
          
          // Check if time is missing - show time picker modal
          const hasTime = fullAnalysis.extraction?.time?.value && fullAnalysis.extraction.time.value !== "";
          if (!hasTime) {
            console.log("[mine] Time missing - showing time picker modal");
            setPendingTimeAnalysis({ analysis: fullAnalysis, imageUrl });
            setShowTimeModal(true);
            setIsMining(false);
            setCanLeaveAnalyzeScreen(false);
            return;
          }
          
          // Process with existing time
          await processAnalysisWithTime(fullAnalysis, imageUrl, fullAnalysis.extraction?.time?.value);
        })
        .catch((err) => {
          console.error("[mine] Upload or analysis error:", err);
          const errMsg = err instanceof Error ? err.message : t("mine.error.analysisFailed");
          setError(translateApiError(errMsg, t) || errMsg);
          setReceipt(null);
          setIsMining(false);
          setCanLeaveAnalyzeScreen(false);
          setCurrentStep(0);
          try { URL.revokeObjectURL(imageUrl); } catch { /* ignore */ }
          toast.error(t("mine.error.analyze"), {
            description: translateApiError(errMsg, t) || t("mine.error.analysisFailed"),
            duration: 5000,
          });
        })
        .finally(() => {
          uploadAnalyzeInFlightRef.current = false;
        });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("mine.error.processImage");
      const isMemoryError = /bellek\s*yetersiz|insufficient\s*memory|out\s*of\s*memory|quotaexceeded/i.test(String(errorMessage));

      if (isMemoryError) {
        toast.error(t("errors.memory"), {
          description: t("mine.photoTooLargeDesc"),
          duration: 8000,
        });
      } else {
        toast.error(t("mine.error.upload"), {
          description: translateApiError(errorMessage, t) || errorMessage,
          duration: 5000,
        });
      }

      setError(translateApiError(errorMessage, t) || errorMessage);
      setReceipt(null);
      setCanLeaveAnalyzeScreen(false);
      setCurrentStep(0);
    } finally {
      uploadAnalyzeInFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  // Analiz bittiğinde otomatik sonuç adımına geç (receipt set edildiğinde step 2)

  // Handle save receipt
  const handleSaveReceipt = async () => {
    if (!originalAnalysis || isSaving) return;

    // Check if receipt is duplicate - don't save if duplicate
    if (originalAnalysis.verification?.isDuplicate) {
      toast.warning(t("errors.duplicateReceipt"), {
        description: t("mine.duplicateNotSavedDesc"),
        duration: 5000,
      });
      // Still navigate to complete step but don't save
      setCurrentStep(4);
      return;
    }

    setIsSaving(true);
    setError(null);

    // Optimistic UI: Navigate to complete step (Done)
    setCurrentStep(4);
    
    // Save in background
    const savePromise = (async () => {
      try {
        const analysisToSave: ReceiptAnalysis = {
          ...originalAnalysis,
          status: "verified",
          createdAt: new Date().toISOString(),
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch("/api/receipts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(analysisToSave),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
            console.error("Failed to save receipt:", errorData);
            throw new Error(errorData.error || "Failed to save receipt");
          }

          const saved = await response.json();
          console.log("Receipt saved successfully:", saved.receiptId);
          // Görev ve profil verilerini anında yenile
          queryClient.invalidateQueries({ queryKey: QUESTS_DAILY_QUERY_KEY });
          queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_KEY });
        } catch (fetchError: unknown) {
          clearTimeout(timeoutId);
          if (fetchError instanceof Error && fetchError.name === 'AbortError') {
            console.warn("Save operation timed out, retrying in background");
            fetch("/api/receipts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(analysisToSave),
            }).catch(err => {
              console.error("Background save failed:", err);
            });
          } else {
            throw fetchError;
          }
        }
      } catch (err: unknown) {
        console.error("Failed to save receipt:", err);
      } finally {
        setIsSaving(false);
      }
    })();

    savePromise.catch(() => {});
  };

  // Reset and mine another receipt
  const handleMineAnother = () => {
    setCurrentStep(0);
    setSelectedFile(null);
    setReceipt(null);
    setOriginalAnalysis(null);
    setMiningProgress(null);
    setSyntheticReceiptUrl(null);
    setError(null);
    setRejectionNoBackground(false);
    setIsMining(false);
    setIsSaving(false);
    // Pipeline gösterge state'lerini sıfırla — retry'da eski adımdan başlamasın
    setPipelineStep(0);
    setPipelineLabel("");
    setDisplayPipelineStep(0);
    setWarmupProgress(0);
    setCanLeaveAnalyzeScreen(false);
  };

  const handleLeaveAnalyzeScreen = () => {
    toast.success(
      locale === "tr"
        ? "Fiş yüklendi, analiz arka planda devam ediyor."
        : "Receipt uploaded, analysis continues in background.",
      {
        description:
          locale === "tr"
            ? "Analiz tamamlanınca bildirim alacaksınız."
            : "You will be notified when analysis is complete.",
        duration: 5000,
      }
    );
    router.push("/app/receipts");
  };

  if (error) {
    return (
      <AppShell>
        <div className="max-w-md mx-auto">
          <ReceiptPipelineError
            message={error}
            onRetry={handleMineAnother}
            locale={locale}
            accountLevel={accountLevel}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell className={isAnalyzeScreen ? "p-2 sm:p-2 pb-[clamp(3.75rem,10svh,5rem)] min-h-0 overflow-hidden" : undefined}>
      <div className={`max-w-md mx-auto ${isAnalyzeScreen ? "space-y-2 h-full min-h-0 overflow-hidden" : "space-y-4"}`}>
        {/* Tara – kamera ile fiş tara */}
        {currentStep === 0 && (
          <ReceiptScanner
            onCapture={handleFileSelect}
            locale={locale}
            className={isProcessing ? "opacity-50 pointer-events-none" : ""}
            onClose={() => router.back()}
          />
        )}

        {currentStep === 1 && (
          <ReceiptAnalyzingStep
            progress={displayPipelineStep === 0 ? warmupProgress : Math.round((displayPipelineStep / 11) * 100)}
            pipelineStep={displayPipelineStep}
            pipelineLabel={PIPELINE_STAGE_LABELS[displayPipelineStep] ?? ""}
            canLeaveScreen={canLeaveAnalyzeScreen}
            leaveHintText={
              locale === "tr"
                ? "Fiş sunucuya yüklendi. Bu ekrandan çıkabilirsiniz, analiz arka planda devam eder."
                : "Receipt reached the server. You can leave this screen while analysis continues in the background."
            }
            leaveButtonText={locale === "tr" ? "Arka planda devam et" : "Continue in background"}
            onLeaveScreen={handleLeaveAnalyzeScreen}
            locale={locale}
            accountLevel={accountLevel}
            compact={true}
          />
        )}

        {currentStep === 2 && receipt && (
          <ReceiptResultWithBreakdownStep
            receipt={receipt}
            onContinue={() => setCurrentStep(3)}
            onCancel={handleMineAnother}
            locale={locale}
            accountLevel={accountLevel}
          />
        )}

        {currentStep === 3 && receipt && (
          <ReceiptVectorReceiptStep
            receipt={receipt}
            onBack={() => setCurrentStep(2)}
            onSave={handleSaveReceipt}
            isSaving={isSaving}
            locale={locale}
            accountLevel={accountLevel}
          />
        )}

        {currentStep === 4 && receipt && (
          <ReceiptDoneStep
            receipt={receipt}
            onMineAnother={handleMineAnother}
            onViewReceipts={() => router.push("/app/receipts")}
            locale={locale}
            accountLevel={accountLevel}
          />
        )}
      </div>
      
      {/* Time Picker Modal - shown when time not detected */}
      <TimePickerModal
        open={showTimeModal}
        onClose={handleTimeSkip}
        onConfirm={handleTimeConfirm}
        locale={locale}
      />

      {/* Quality Issues Modal */}
      <QualityIssuesModal
        open={showQualityModal}
        onClose={() => {
          setShowQualityModal(false);
          setSelectedFile(null);
          setIsProcessing(false);
        }}
        onRetry={() => {
          setShowQualityModal(false);
          setQualityIssues([]);
          // File input will be reset, user can select again
          setSelectedFile(null);
          setIsProcessing(false);
        }}
        issues={qualityIssues}
        locale={locale}
      />
    </AppShell>
  );
}
