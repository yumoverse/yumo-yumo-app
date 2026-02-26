"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useAppLocale } from "@/lib/i18n/app-context";
import { ArrowLeft, Camera, ImageIcon } from "lucide-react";

interface ReceiptScannerProps {
  onCapture: (file: File) => void;
  /** @deprecated Use app locale from context */
  locale?: string;
  className?: string;
  onClose?: () => void;
}

export function ReceiptScanner({ onCapture, className, onClose }: ReceiptScannerProps) {
  const { t, locale } = useAppLocale();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (
        file &&
        (file.type.startsWith("image/") ||
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf"))
      ) {
        onCapture(file);
      }
      e.target.value = "";
    },
    [onCapture]
  );

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  if (!mounted) return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[9999] flex flex-col",
        "bg-[var(--app-bg,#0a0a0a)]",
        className
      )}
      style={{ height: "100dvh" }}
    >
      {/* Top bar */}
      <div className="flex items-center px-4 pt-4 pb-2">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 transition-opacity hover:opacity-80"
            aria-label={locale === "tr" ? "Geri" : "Back"}
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-10">
        {/* Receipt icon */}
        <div className="w-28 h-28 rounded-3xl bg-[var(--app-primary)]/10 border-2 border-[var(--app-primary)]/25 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 48 48"
            fill="none"
            className="w-14 h-14"
          >
            <rect x="8" y="4" width="32" height="40" rx="4" fill="currentColor" className="text-[var(--app-primary)]/20" />
            <path d="M8 4h32a0 0 0 0 1 0 0v40l-4-3-4 3-4-3-4 3-4-3-4 3-4-3V4a0 0 0 0 1 0 0z" fill="currentColor" className="text-[var(--app-primary)]/10" />
            <line x1="15" y1="16" x2="33" y2="16" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-[var(--app-primary)]" />
            <line x1="15" y1="22" x2="33" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-[var(--app-primary)]" />
            <line x1="15" y1="28" x2="26" y2="28" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-[var(--app-primary)]" />
          </svg>
        </div>

        {/* Title & subtitle */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-white">
            {t("receiptScanner.uploadTitle")}
          </h2>
          <p className="text-sm text-white/55 leading-relaxed">
            {t("receiptScanner.uploadSubtitle")}
          </p>
        </div>

        {/* Action buttons */}
        <div className="w-full max-w-xs space-y-3">
          {/* Take Photo — opens native camera app */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="w-full py-4 rounded-2xl text-sm font-semibold bg-[var(--app-primary)] text-black flex items-center justify-center gap-2.5 transition-opacity hover:opacity-90 active:opacity-80"
          >
            <Camera className="w-5 h-5" />
            {t("receiptScanner.takePhoto")}
          </button>

          {/* Choose from Gallery / Files */}
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="w-full py-4 rounded-2xl text-sm font-medium border border-white/15 bg-white/5 text-white flex items-center justify-center gap-2.5 transition-opacity hover:opacity-90 active:opacity-80"
          >
            <ImageIcon className="w-5 h-5" />
            {t("receiptScanner.pickFile")}
          </button>
        </div>
      </div>

      {/* Bottom safe-area spacing */}
      <div className="h-10" />
    </div>,
    document.body
  );
}
