"use client";

import { useState } from "react";
import { ThemeCard } from "@/components/app/theme-card";
import { RotateCw, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppLocale } from "@/lib/i18n/app-context";

interface ReceiptViewerProps {
  imageUrl?: string;
  accountLevel?: number;
  className?: string;
}

export function ReceiptViewer({ imageUrl, accountLevel = 1, className }: ReceiptViewerProps) {
  const { t } = useAppLocale();
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);

  return (
    <ThemeCard accountLevel={accountLevel} className={cn("p-3 sm:p-4", className)}>
      <div className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-sm sm:text-base" style={{ color: "var(--app-text-primary)" }}>
            {t("receiptViewer.title")}
          </h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
              style={{
                background: "var(--app-bg-elevated)",
                border: "1px solid var(--app-border)",
                color: "var(--app-text-secondary)",
              }}
              aria-label={t("receiptViewer.rotate")}
            >
              <RotateCw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => (z === 1 ? 1.5 : 1))}
              className="flex items-center justify-center w-9 h-9 rounded-lg transition-colors"
              style={{
                background: "var(--app-bg-elevated)",
                border: "1px solid var(--app-border)",
                color: "var(--app-text-secondary)",
              }}
              aria-label={t("receiptViewer.zoom")}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div
          className="relative rounded-xl overflow-hidden aspect-[3/4] flex items-center justify-center"
          style={{ background: "var(--app-bg-elevated)" }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={t("receiptViewer.title")}
              className="w-full h-full object-contain"
              style={{
                transform: `rotate(${rotation}deg) scale(${zoom})`,
                transition: "transform 0.3s",
              }}
            />
          ) : (
            <div className="text-center p-8">
              <p style={{ color: "var(--app-text-muted)" }}>{t("receiptViewer.noImage")}</p>
              <p className="text-sm mt-2" style={{ color: "var(--app-text-muted)" }}>
                {t("receiptViewer.previewWillAppear")}
              </p>
            </div>
          )}
        </div>
      </div>
    </ThemeCard>
  );
}
