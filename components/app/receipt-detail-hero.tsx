"use client";

import { motion } from "framer-motion";
import { ThemeCard } from "@/components/app/theme-card";
import { VectorReceipt } from "@/components/app/vector-receipt";
import { StatusBadge } from "@/components/app/status-badge";
import { Badge } from "@/components/ui/badge";
import { Share2, ChevronLeft } from "lucide-react";
import { useTier } from "@/lib/theme/theme-context";
import { useAppLocale } from "@/lib/i18n/app-context";
import type { Receipt } from "@/lib/mock/types";

interface ReceiptDetailHeroProps {
  receipt: Receipt;
  accountLevel?: number;
  onBack?: () => void;
  onShare?: () => void;
  showVectorReceipt?: boolean;
  compact?: boolean;
}

export function ReceiptDetailHero({
  receipt,
  accountLevel = 1,
  onBack,
  onShare,
  showVectorReceipt = true,
  compact = false,
}: ReceiptDetailHeroProps) {
  const tier = useTier(accountLevel);
  const { t } = useAppLocale();
  const acc = tier.accent;

  return (
    <div className="space-y-4">
      {/* Üst satır: Geri + Paylaş */}
      <div className="flex items-center justify-between">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-sm font-medium">{t("common.back")}</span>
          </button>
        )}
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all hover:opacity-90"
            style={{
              background: `${acc}20`,
              border: `1px solid ${acc}40`,
              color: acc,
            }}
          >
            <Share2 className="h-4 w-4" />
            {t("common.share")}
          </button>
        )}
      </div>

      {/* Fiş kartı + Özet */}
      <ThemeCard accountLevel={accountLevel} className="overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 p-4 lg:p-6">
          {/* Sol: Vektör fiş */}
          {showVectorReceipt && (
            <motion.div
              className="lg:col-span-2 flex items-center justify-center"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <VectorReceipt
                receipt={receipt}
                locale="tr"
                accountLevel={accountLevel}
                compact={compact}
                className="max-w-full h-[240px] sm:h-[320px] lg:h-[380px]"
              />
            </motion.div>
          )}

          {/* Sağ: Özet metrikleri */}
          <motion.div
            className={showVectorReceipt ? "lg:col-span-3" : "lg:col-span-5"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="space-y-4">
              <div>
                <h1
                  className="text-xl sm:text-2xl font-bold tracking-tight"
                  style={{ color: "var(--app-text-primary)" }}
                >
                  {receipt.merchantName}
                </h1>
                <p className="text-sm text-white/50 mt-1">
                  {receipt.date}
                  {receipt.time ? ` · ${receipt.time}` : ""}
                  {receipt.category && receipt.category !== "other"
                    ? ` · ${receipt.category}`
                    : ""}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: `${acc}10`,
                    border: `1px solid ${acc}25`,
                  }}
                >
                  <p className="text-xs font-medium text-white/60 uppercase tracking-wider">
                    {t("receiptDetail.total")}
                  </p>
                  <p
                    className="text-lg font-bold tabular-nums mt-0.5"
                    style={{ color: acc }}
                  >
                    {receipt.total.toFixed(2)}
                  </p>
                  <p className="text-xs text-white/50">{receipt.currency}</p>
                </div>
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: `${acc}08`,
                    border: `1px solid ${acc}20`,
                  }}
                >
                  <p className="text-xs font-medium text-white/60 uppercase tracking-wider">
                    {t("receiptDetail.hiddenCost")}
                  </p>
                  <p
                    className="text-lg font-bold tabular-nums mt-0.5"
                    style={{ color: tier.accent2 }}
                  >
                    {receipt.hiddenCost.totalHidden.toFixed(2)}
                  </p>
                  <p className="text-xs text-white/50">{receipt.currency}</p>
                </div>
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: "var(--app-bg-elevated)",
                    border: "1px solid var(--app-border)",
                  }}
                >
                  <p className="text-xs font-medium text-white/60 uppercase tracking-wider">
                    {t("receiptDetail.reward")}
                  </p>
                  <p
                    className="text-lg font-bold tabular-nums mt-0.5"
                    style={{ color: acc }}
                  >
                    +{receipt.reward.amount.toFixed(2)}
                  </p>
                  <p className="text-xs text-white/50">{receipt.reward.symbol}</p>
                  {receipt.reward.ryumo != null && (
                    <p className="text-xs font-medium mt-1.5" style={{ color: "var(--app-emerald, #10b981)" }}>
                      rYUMO: +{receipt.reward.ryumo.toFixed(2)}
                    </p>
                  )}
                </div>
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: "var(--app-bg-elevated)",
                    border: "1px solid var(--app-border)",
                  }}
                >
                  <p className="text-xs font-medium text-white/60 uppercase tracking-wider">
                    {t("receiptDetail.status")}
                  </p>
                  <div className="mt-1.5">
                    <StatusBadge status={receipt.status} />
                  </div>
                  {receipt.reward.claimable && (
                    <Badge
                      variant="outline"
                      className="mt-2 text-xs"
                      style={{
                        borderColor: `${acc}50`,
                        color: acc,
                      }}
                    >
                      {t("common.claimable")}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </ThemeCard>
    </div>
  );
}
