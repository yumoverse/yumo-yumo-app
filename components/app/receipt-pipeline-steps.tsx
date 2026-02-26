"use client";

/**
 * Fiş pipeline'ı – baştan aşağı yeni arayüz.
 * Adım göstergesi yok; her ekran kendi başlığıyla. Hata ekranı da yeni.
 */

import { useMemo, useState, useEffect } from "react";
import { useTier } from "@/lib/theme/theme-context";
import { useAppLocale } from "@/lib/i18n/app-context";
import { ThemeCard } from "@/components/app/theme-card";
import type { Receipt } from "@/lib/mock/types";
import { useSound } from "@/lib/audio/sound-context";
import {
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  FileText,
  RotateCcw,
  AlertTriangle,
  CloudUpload,
  ScanText,
  CalendarDays,
  Store,
  ShieldCheck,
  Coins,
} from "lucide-react";
import { VectorReceipt } from "@/components/app/vector-receipt";

// —— 0. Hata (yeni arayüz, eski ErrorState kullanılmaz) ——
interface PipelineErrorStepProps {
  message: string;
  onRetry: () => void;
  locale?: string;
  accountLevel?: number;
}

export function ReceiptPipelineError({ message, onRetry, accountLevel = 1 }: PipelineErrorStepProps) {
  const tier = useTier(accountLevel);
  const { t } = useAppLocale();
  const title = t("pipeline.errorTitle");
  const retryLabel = t("pipeline.retry");

  return (
    <ThemeCard accountLevel={accountLevel} className="p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: "var(--app-bg-elevated)", border: "2px solid var(--app-border)" }}
        >
          <AlertTriangle className="w-6 h-6" style={{ color: "var(--app-text-muted)" }} />
        </div>
        <div>
          <h2 className="text-lg font-semibold" style={{ color: "var(--app-text-primary)" }}>{title}</h2>
          <p className="text-sm mt-2" style={{ color: "var(--app-text-muted)" }}>{message}</p>
        </div>
        <button
          type="button"
          onClick={onRetry}
          className="w-full max-w-xs py-2.5 rounded-xl text-sm font-semibold"
          style={{
            background: `linear-gradient(135deg,${tier.accent},${tier.accent2})`,
            color: "#0a0a0a",
          }}
        >
          {retryLabel}
        </button>
      </div>
    </ThemeCard>
  );
}

const BUCKET_KEYS: Record<string, string> = {
  store: "breakdown.bucket.store",
  supply: "breakdown.bucket.supply",
  retail: "breakdown.bucket.retail",
  government: "breakdown.bucket.government",
  other: "breakdown.bucket.other",
};

const PIPELINE_STAGE_KEYS = [
  "pipeline.stage.upload",
  "pipeline.stage.ocr",
  "pipeline.stage.extract",
  "pipeline.stage.merchant",
  "pipeline.stage.hidden",
  "pipeline.stage.verify",
];

interface AnalyzingStepProps {
  progress?: number | null;
  /** Sunucudan gelen gerçek pipeline aşama numarası (1–11). Verilirse döngü yok, sadece bu aşama gösterilir. */
  pipelineStep?: number;
  /** Sunucudan gelen aşama etiketi (örn. "Metin okunuyor (OCR)"). */
  pipelineLabel?: string;
  locale?: string;
  accountLevel?: number;
}

export function ReceiptAnalyzingStep({ progress, pipelineStep = 0, pipelineLabel = "", accountLevel = 1 }: AnalyzingStepProps) {
  const tier = useTier(accountLevel);
  const { t } = useAppLocale();
  const { playSfx } = useSound();
  const acc = tier.accent;
  const stages = PIPELINE_STAGE_KEYS.map((k) => t(k));
  const [currentStageIndex, setCurrentStageIndex] = useState(0);
  const [simulatedProgress, setSimulatedProgress] = useState(0);
  const [lastSceneIndex, setLastSceneIndex] = useState<number | null>(null);
  const [playedComplete, setPlayedComplete] = useState(false);

  const useRealPipeline = pipelineStep > 0 || (pipelineStep === 0 && pipelineLabel !== undefined && pipelineLabel !== "");

  type StorySceneKey = "upload" | "ocr" | "extract" | "enrich" | "verify" | "reward";
  const storyScenes: { key: StorySceneKey; icon: React.ReactNode }[] = useMemo(
    () => [
      { key: "upload", icon: <CloudUpload className="w-4 h-4" /> },
      { key: "ocr", icon: <ScanText className="w-4 h-4" /> },
      { key: "extract", icon: <CalendarDays className="w-4 h-4" /> },
      { key: "enrich", icon: <Store className="w-4 h-4" /> },
      { key: "verify", icon: <ShieldCheck className="w-4 h-4" /> },
      { key: "reward", icon: <Coins className="w-4 h-4" /> },
    ],
    []
  );

  const getSceneIndexFromRealStep = (step: number): number => {
    // 0..11 (from mine pipeline). Group into fewer story beats.
    if (step <= 2) return 0; // send/validate/load
    if (step === 3) return 1; // OCR
    if (step <= 5) return 2; // classify/extract
    if (step <= 7) return 3; // AI + external enrichment
    if (step <= 10) return 4; // fraud/currency/dup
    return 5; // pricing/reward
  };

  const getSceneIndex = (): number => {
    if (useRealPipeline) return getSceneIndexFromRealStep(pipelineStep);
    // Fallback: reuse the 6 stage cycle as 6 story scenes
    return Math.max(0, Math.min(storyScenes.length - 1, currentStageIndex));
  };

  // Gerçek aşama yoksa: aşamayı her ~2.2 saniyede ilerlet (fallback)
  useEffect(() => {
    if (useRealPipeline) return;
    const id = setInterval(() => {
      setCurrentStageIndex((i) => (i + 1) % stages.length);
    }, 2200);
    return () => clearInterval(id);
  }, [useRealPipeline, stages.length]);

  // Progress bar: sayı geliyorsa (0 dahil) sadece onu kullan; böylece bar 0→100 ilerler, geri düşmez
  useEffect(() => {
    if (typeof progress === "number") {
      setSimulatedProgress(progress);
      return;
    }
    if (progress != null && progress >= 100) {
      setSimulatedProgress(100);
      return;
    }
    if (progress != null && progress > 0) {
      setSimulatedProgress((p) => Math.max(p, progress));
      return;
    }
    if (useRealPipeline) return;
    const t = setInterval(() => {
      setSimulatedProgress((p) => {
        if (p >= 88) return 88;
        return p + 1.8;
      });
    }, 800);
    return () => clearInterval(t);
  }, [progress, useRealPipeline]);

  const displayProgress = typeof progress === "number" ? Math.min(100, Math.round(progress)) : (progress != null && progress >= 100 ? 100 : Math.min(100, Math.round(simulatedProgress)));
  const currentLabel = useRealPipeline ? pipelineLabel : stages[currentStageIndex];
  const sceneIndex = getSceneIndex();
  const sceneKey = storyScenes[sceneIndex]?.key ?? "upload";
  const storyTitle = t(`pipeline.story.${sceneKey}.title`);
  const storySub = t(`pipeline.story.${sceneKey}.sub`);

  // Subtle SFX: scene tick + completion chime
  useEffect(() => {
    if (lastSceneIndex == null) {
      setLastSceneIndex(sceneIndex);
      return;
    }
    if (sceneIndex !== lastSceneIndex && displayProgress < 100) {
      void playSfx("tick");
      setLastSceneIndex(sceneIndex);
    }
  }, [displayProgress, lastSceneIndex, playSfx, sceneIndex]);

  useEffect(() => {
    if (playedComplete) return;
    if (displayProgress >= 100) {
      void playSfx("scan_complete");
      setPlayedComplete(true);
    }
  }, [displayProgress, playSfx, playedComplete]);

  return (
    <ThemeCard accountLevel={accountLevel} className="p-6">
      <div className="flex flex-col items-center gap-5">
        {/* Cinematic scan vignette */}
        <div className="w-full max-w-sm">
          <div
            className="relative overflow-hidden rounded-2xl border"
            style={{ background: "var(--app-bg-elevated)", borderColor: "var(--app-border)" }}
          >
            {/* Soft aurora */}
            <div
              className="absolute -inset-10 opacity-70"
              style={{
                background: `radial-gradient(circle at 25% 25%, ${tier.accent}22, transparent 55%), radial-gradient(circle at 70% 80%, ${tier.accent2}14, transparent 60%)`,
              }}
            />
            {/* Shine sweep */}
            <div
              className="absolute inset-y-0 -left-1/2 w-1/2 rotate-12 animate-shimmer"
              style={{
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)",
              }}
            />

            <div className="relative p-4">
              {/* “Receipt frame” */}
              <div
                className="relative mx-auto w-[82%] aspect-[3/4] rounded-xl border border-dashed overflow-hidden"
                style={{ borderColor: `${acc}55`, background: "color-mix(in srgb, var(--app-bg-surface) 70%, transparent)" }}
              >
                {/* scan line */}
                <div className="absolute left-0 right-0 h-px receipt-scan-line" style={{ background: `linear-gradient(90deg, transparent, ${acc}, transparent)` }} />
                {/* top glow */}
                <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${acc}88, transparent)` }} />

                {/* glyph */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{
                      background: `${acc}12`,
                      border: `1px solid ${acc}2e`,
                      color: acc,
                      boxShadow: `0 0 24px ${acc}1f`,
                    }}
                  >
                    {storyScenes[sceneIndex]?.icon ?? <CloudUpload className="w-4 h-4" />}
                  </div>
                </div>
              </div>

              {/* Header copy */}
              <div className="text-center mt-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: "var(--app-text-muted)" }}>
                  {t("pipeline.analyzing")}
                </p>
                <h2 className="text-[17px] font-semibold mt-1" style={{ color: "var(--app-text-primary)" }}>
                  {storyTitle}
                </h2>
                <p className="text-[12px] mt-1 leading-snug" style={{ color: "var(--app-text-secondary)" }}>
                  {storySub}
                </p>
                <p className="text-[11px] mt-2 receipt-analyzing-pulse" style={{ color: "var(--app-text-muted)" }}>
                  {currentLabel}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Story beats (icon timeline) */}
        <div className="w-full max-w-sm grid grid-cols-3 gap-2">
          {storyScenes.map((s, i) => {
            const isCompleted = i < sceneIndex || displayProgress >= 100;
            const isActive = i === sceneIndex && displayProgress < 100;
            const label = t(`pipeline.story.${s.key}.short`);
            return (
              <div
                key={s.key}
                className="flex items-center gap-2 rounded-xl px-3 py-2 border transition-[transform,background-color,border-color] duration-300"
                style={{
                  background: isCompleted ? `${acc}10` : isActive ? "var(--app-bg-elevated)" : "transparent",
                  borderColor: isCompleted ? `${acc}33` : "var(--app-border)",
                  transform: isActive ? "translateY(-1px)" : "translateY(0px)",
                }}
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isCompleted ? `${acc}18` : "var(--app-bg-elevated)",
                    border: `1px solid ${isCompleted ? `${acc}44` : "var(--app-border)"}`,
                    color: isCompleted ? acc : "var(--app-text-muted)",
                  }}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.icon}
                </div>
                <div className="min-w-0">
                  <p
                    className="text-[11px] font-semibold truncate"
                    style={{ color: isCompleted ? "var(--app-text-primary)" : isActive ? "var(--app-text-secondary)" : "var(--app-text-muted)" }}
                  >
                    {label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress */}
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[11px] font-medium" style={{ color: "var(--app-text-muted)" }}>
              {t("mining.modal.progress")}
            </p>
            <p className="text-[11px] font-mono font-bold tabular-nums" style={{ color: acc }}>
              {displayProgress}%
            </p>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-border)" }}>
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{
                width: `${displayProgress}%`,
                background: `linear-gradient(90deg, ${tier.accent}, ${tier.accent2})`,
              }}
            />
          </div>
          <div className="mt-3 rounded-xl border px-3 py-2 flex items-center gap-2" style={{ background: "var(--app-bg-elevated)", borderColor: "var(--app-border)" }}>
            <ShieldCheck className="w-4 h-4" style={{ color: acc }} />
            <p className="text-[11px] leading-snug" style={{ color: "var(--app-text-muted)" }}>
              {t("mine.privacy.description")}
            </p>
          </div>
        </div>
      </div>
    </ThemeCard>
  );
}

// —— 2. Sonuç (gizli maliyet bulundu) ——
interface ResultStepProps {
  receipt: Receipt;
  onContinue: () => void;
  onCancel?: () => void;
  locale?: string;
  accountLevel?: number;
}

export function ReceiptResultStep({ receipt, onContinue, onCancel, accountLevel = 1 }: ResultStepProps) {
  const tier = useTier(accountLevel);
  const { t } = useAppLocale();
  const hiddenCost = receipt.hiddenCost.totalHidden;
  const totalPaid = receipt.total;
  const productValue = Math.max(0, receipt.hiddenCost.productValue ?? totalPaid - hiddenCost);
  const hiddenPercent = totalPaid > 0 ? (hiddenCost / totalPaid) * 100 : 0;
  const labels = { title: t("pipeline.hiddenCostFound"), hidden: t("mine.hiddenCost"), paid: t("pipeline.paid"), realValue: t("pipeline.realValue"), viewDetails: t("pipeline.viewDetails"), cancel: t("common.cancel") };

  return (
    <ThemeCard accountLevel={accountLevel} className="p-5">
      <h2 className="text-lg font-semibold text-center mb-4" style={{ color: "var(--app-text-primary)" }}>{labels.title}</h2>
      <div className="rounded-xl p-4 mb-4" style={{ background: "var(--app-bg-elevated)" }}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm" style={{ color: "var(--app-text-muted)" }}>{labels.hidden}</span>
          <span className="font-semibold tabular-nums" style={{ color: tier.accent }}>{hiddenCost.toFixed(2)} {receipt.currency}</span>
        </div>
        <div className="flex justify-between items-center text-sm mb-2">
          <span style={{ color: "var(--app-text-muted)" }}>{labels.paid}</span>
          <span style={{ color: "var(--app-text-primary)" }}>{totalPaid.toFixed(2)} {receipt.currency}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span style={{ color: "var(--app-text-muted)" }}>{labels.realValue}</span>
          <span style={{ color: "var(--app-text-primary)" }}>{productValue.toFixed(2)} {receipt.currency}</span>
        </div>
        <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-border)" }}>
          <div className="h-full rounded-full" style={{ width: `${hiddenPercent}%`, background: tier.accent }} />
        </div>
      </div>
      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
            style={{ borderColor: "var(--app-border)", color: "var(--app-text-secondary)" }}
          >
            {labels.cancel}
          </button>
        )}
        <button
          type="button"
          onClick={onContinue}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1"
          style={{ background: `linear-gradient(135deg,${tier.accent},${tier.accent2})`, color: "#0a0a0a" }}
        >
          {labels.viewDetails}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </ThemeCard>
  );
}

// —— 2+3 birleşik: Gizli maliyet bulundu + Maliyet dağılımı (tek ekran) ——
interface ResultWithBreakdownStepProps {
  receipt: Receipt;
  onContinue: () => void;
  onCancel?: () => void;
  locale?: string;
  accountLevel?: number;
}

export function ReceiptResultWithBreakdownStep({ receipt, onContinue, onCancel, locale: localeProp, accountLevel = 1 }: ResultWithBreakdownStepProps) {
  const tier = useTier(accountLevel);
  const { t } = useAppLocale();
  const hiddenCost = receipt.hiddenCost.totalHidden;
  const totalPaid = receipt.total;
  const productValue = Math.max(0, receipt.hiddenCost.productValue ?? totalPaid - hiddenCost);
  const hiddenPercent = totalPaid > 0 ? (hiddenCost / totalPaid) * 100 : 0;
  const items = (receipt.hiddenCost.breakdownItems || []).filter((i) => i.bucket !== "government");
  const getBucketLabel = (bucket: string) => t(BUCKET_KEYS[bucket as keyof typeof BUCKET_KEYS] || BUCKET_KEYS.other);
  const byBucket = items.reduce((acc, item) => {
    const b = item.bucket || "other";
    if (!acc[b]) acc[b] = 0;
    acc[b] += item.amount;
    return acc;
  }, {} as Record<string, number>);
  const total = receipt.hiddenCost.totalHidden || 1;

  const labels = { title: t("pipeline.hiddenCostFound"), hidden: t("mine.hiddenCost"), paid: t("pipeline.paid"), realValue: t("pipeline.realValue"), breakdownTitle: t("pipeline.breakdownTitle"), viewNext: t("pipeline.viewNext"), cancel: t("common.cancel") };

  return (
    <ThemeCard accountLevel={accountLevel} className="p-5">
      <h2 className="text-lg font-semibold text-center mb-4" style={{ color: "var(--app-text-primary)" }}>{labels.title}</h2>
      <div className="rounded-xl p-4 mb-4" style={{ background: "var(--app-bg-elevated)" }}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm" style={{ color: "var(--app-text-muted)" }}>{labels.hidden}</span>
          <span className="font-semibold tabular-nums" style={{ color: tier.accent }}>{hiddenCost.toFixed(2)} {receipt.currency}</span>
        </div>
        <div className="flex justify-between items-center text-sm mb-2">
          <span style={{ color: "var(--app-text-muted)" }}>{labels.paid}</span>
          <span style={{ color: "var(--app-text-primary)" }}>{totalPaid.toFixed(2)} {receipt.currency}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span style={{ color: "var(--app-text-muted)" }}>{labels.realValue}</span>
          <span style={{ color: "var(--app-text-primary)" }}>{productValue.toFixed(2)} {receipt.currency}</span>
        </div>
        <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-border)" }}>
          <div className="h-full rounded-full" style={{ width: `${hiddenPercent}%`, background: tier.accent }} />
        </div>
      </div>

      <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--app-text-secondary)" }}>{labels.breakdownTitle}</h3>
      <div className="space-y-3 mb-5">
        {Object.entries(byBucket).map(([bucket, amount]) => {
          const pct = total > 0 ? (amount / total) * 100 : 0;
          return (
            <div key={bucket}>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: "var(--app-text-secondary)" }}>{getBucketLabel(bucket)}</span>
                <span className="tabular-nums" style={{ color: "var(--app-text-primary)" }}>{amount.toFixed(2)} {receipt.currency}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-border)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tier.accent }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
            style={{ borderColor: "var(--app-border)", color: "var(--app-text-secondary)" }}
          >
            {labels.cancel}
          </button>
        )}
        <button
          type="button"
          onClick={onContinue}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1"
          style={{ background: `linear-gradient(135deg,${tier.accent},${tier.accent2})`, color: "#0a0a0a" }}
        >
          {labels.viewNext}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </ThemeCard>
  );
}

// —— 3. Maliyet dağılımı (ayrı ekran – artık birleşik ekranda kullanılıyor) ——
interface BreakdownStepProps {
  receipt: Receipt;
  onBack: () => void;
  onContinue: () => void;
  locale?: string;
  accountLevel?: number;
  isAdmin?: boolean;
}

export function ReceiptBreakdownStep({ receipt, onBack, onContinue, accountLevel = 1 }: BreakdownStepProps) {
  const tier = useTier(accountLevel);
  const { t } = useAppLocale();
  const items = (receipt.hiddenCost.breakdownItems || []).filter((i) => i.bucket !== "government");
  const getBucketLabel = (bucket: string) => t(BUCKET_KEYS[bucket as keyof typeof BUCKET_KEYS] || BUCKET_KEYS.other);

  const byBucket = items.reduce((acc, item) => {
    const b = item.bucket || "other";
    if (!acc[b]) acc[b] = 0;
    acc[b] += item.amount;
    return acc;
  }, {} as Record<string, number>);
  const total = receipt.hiddenCost.totalHidden || 1;

  return (
    <ThemeCard accountLevel={accountLevel} className="p-5">
      <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--app-text-primary)" }}>{t("pipeline.breakdownTitle")}</h2>
      <div className="space-y-3 mb-5">
        {Object.entries(byBucket).map(([bucket, amount]) => {
          const pct = total > 0 ? (amount / total) * 100 : 0;
          return (
            <div key={bucket}>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: "var(--app-text-secondary)" }}>{getBucketLabel(bucket)}</span>
                <span className="tabular-nums" style={{ color: "var(--app-text-primary)" }}>{amount.toFixed(2)} {receipt.currency}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-border)" }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tier.accent }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-xl text-sm font-medium border" style={{ borderColor: "var(--app-border)", color: "var(--app-text-secondary)" }}>
          <ArrowLeft className="w-4 h-4 inline mr-1" />
          {t("common.back")}
        </button>
        <button type="button" onClick={onContinue} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: `linear-gradient(135deg,${tier.accent},${tier.accent2})`, color: "#0a0a0a" }}>
          {t("pipeline.viewNext")}
          <ChevronRight className="w-4 h-4 inline ml-1" />
        </button>
      </div>
    </ThemeCard>
  );
}

// —— 4. Vektör fiş + Fişi kaydet (tek ekran) ——
interface VectorReceiptStepProps {
  receipt: Receipt;
  onBack: () => void;
  onSave: () => void;
  isSaving?: boolean;
  locale?: string;
  accountLevel?: number;
}

export function ReceiptVectorReceiptStep({ receipt, onBack, onSave, isSaving = false, locale: localeProp = "tr", accountLevel = 1 }: VectorReceiptStepProps) {
  const tier = useTier(accountLevel);
  const { t, locale } = useAppLocale();

  return (
    <ThemeCard accountLevel={accountLevel} className="p-4">
      <div className="rounded-xl overflow-hidden mb-4 max-h-[70vh] flex justify-center">
        <VectorReceipt
          receipt={receipt}
          locale={localeProp || locale}
          accountLevel={accountLevel}
          compact={false}
          className="w-full aspect-[2/3] max-h-[70vh] min-h-[280px]"
        />
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-xl text-sm font-medium border" style={{ borderColor: "var(--app-border)", color: "var(--app-text-secondary)" }}>
          <ArrowLeft className="w-4 h-4 inline mr-1" />
          {t("common.back")}
        </button>
        <button type="button" onClick={onSave} disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60" style={{ background: `linear-gradient(135deg,${tier.accent},${tier.accent2})`, color: "#0a0a0a" }}>
          {isSaving ? t("pipeline.saving") : t("pipeline.saveReceipt")}
        </button>
      </div>
    </ThemeCard>
  );
}

// —— Ödül ekranı (eski – artık vektör fiş ekranında kaydet kullanılıyor) ——
interface RewardStepProps {
  receipt: Receipt;
  onBack: () => void;
  onClaim: () => void;
  isSaving?: boolean;
  locale?: string;
  accountLevel?: number;
  isAdmin?: boolean;
}

export function ReceiptRewardStep({ receipt, onBack, onClaim, isSaving = false, accountLevel = 1 }: RewardStepProps) {
  const tier = useTier(accountLevel);
  const { t } = useAppLocale();
  const amount = receipt.reward?.amount ?? receipt.hiddenCost.totalHidden;

  return (
    <ThemeCard accountLevel={accountLevel} className="p-5">
      <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--app-text-primary)" }}>{t("pipeline.potentialReward")}</h2>
      <div className="flex items-baseline gap-2 mb-5">
        <span className="text-2xl font-bold tabular-nums" style={{ color: tier.accent }}>{amount.toFixed(2)}</span>
        <span className="text-sm" style={{ color: "var(--app-text-muted)" }}>aYUMO</span>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onBack} className="flex-1 py-2.5 rounded-xl text-sm font-medium border" style={{ borderColor: "var(--app-border)", color: "var(--app-text-secondary)" }}>
          <ArrowLeft className="w-4 h-4 inline mr-1" />
          {t("common.back")}
        </button>
        <button type="button" onClick={onClaim} disabled={isSaving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-60" style={{ background: `linear-gradient(135deg,${tier.accent},${tier.accent2})`, color: "#0a0a0a" }}>
          {isSaving ? t("pipeline.saving") : t("common.save")}
        </button>
      </div>
    </ThemeCard>
  );
}

// —— 5. Tamamlandı ——
interface DoneStepProps {
  receipt: Receipt;
  onMineAnother: () => void;
  onViewReceipts: () => void;
  locale?: string;
  accountLevel?: number;
}

export function ReceiptDoneStep({ receipt, onMineAnother, onViewReceipts, accountLevel = 1 }: DoneStepProps) {
  const tier = useTier(accountLevel);
  const { t } = useAppLocale();
  const hiddenCost = receipt.hiddenCost.totalHidden;
  const reward = receipt.reward?.amount ?? hiddenCost;

  return (
    <ThemeCard accountLevel={accountLevel} className="p-5">
      <div className="flex justify-center mb-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: `${tier.accent}22`, border: `2px solid ${tier.accent}` }}>
          <CheckCircle2 className="w-7 h-7" style={{ color: tier.accent }} />
        </div>
      </div>
      <h2 className="text-lg font-semibold text-center mb-1" style={{ color: "var(--app-text-primary)" }}>{t("pipeline.doneTitle")}</h2>
      <p className="text-sm text-center mb-5" style={{ color: "var(--app-text-muted)" }}>{t("pipeline.doneSub")}</p>
      <div className="rounded-xl p-3 mb-5 space-y-2" style={{ background: "var(--app-bg-elevated)" }}>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--app-text-muted)" }}>{t("mine.hiddenCost")}</span>
          <span className="tabular-nums font-medium" style={{ color: "var(--app-text-primary)" }}>{hiddenCost.toFixed(2)} {receipt.currency}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "var(--app-text-muted)" }}>{t("mine.reward")}</span>
          <span className="tabular-nums font-medium" style={{ color: tier.accent }}>{reward.toFixed(2)} aYUMO</span>
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onViewReceipts} className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-1.5 border" style={{ borderColor: "var(--app-border)", color: "var(--app-text-primary)" }}>
          <FileText className="w-4 h-4" />
          {t("pipeline.viewReceipts")}
        </button>
        <button type="button" onClick={onMineAnother} className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5" style={{ background: `linear-gradient(135deg,${tier.accent},${tier.accent2})`, color: "#0a0a0a" }}>
          <RotateCcw className="w-4 h-4" />
          {t("pipeline.scanAgain")}
        </button>
      </div>
    </ThemeCard>
  );
}
