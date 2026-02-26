"use client";

import { useState } from "react";
import { ThemeCard } from "@/components/app/theme-card";
import { ConfidenceMeter } from "./confidence-meter";
import { CheckCircle2, Info, Download, ImageDown, Loader2, FileJson } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppLocale } from "@/lib/i18n/app-context";
import type { Receipt } from "@/lib/mock/types";

/** Build image download filename from blobFilename or generate from receipt. */
function imageDownloadFilename(receipt: Receipt): string {
  if (receipt.blobFilename) {
    return receipt.blobFilename;
  }
  const sanitize = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 30);
  const merchant = sanitize(receipt.merchantName || "receipt");
  const date = (receipt.date || "").split("T")[0] || "unknown-date";
  const amount = (receipt.total ?? receipt.totalPaid ?? 0).toFixed(2);
  const currency = receipt.currency || "TRY";
  return `${merchant}-${date}-${amount}-${currency}-${receipt.id}.jpg`;
}

/** Build log download filename: same as blob storage name but .log extension (e.g. m-migros-2026-01-23-773.35-TRY-iQxxMwTiubV1yNGN6EDnuyXRMGLCPQ.log). */
function logDownloadFilename(receipt: Receipt): string {
  if (receipt.blobFilename) {
    return receipt.blobFilename.replace(/\.[^.]+$/i, ".log");
  }
  const sanitize = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .substring(0, 30);
  const merchant = sanitize(receipt.merchantName || "receipt");
  const date = (receipt.date || "").split("T")[0] || "unknown-date";
  const amount = (receipt.total ?? receipt.totalPaid ?? 0).toFixed(2);
  const currency = receipt.currency || "TRY";
  return `${merchant}-${date}-${amount}-${currency}-${receipt.id}.log`;
}

/** Build Vision JSON download filename (admin). */
function visionJsonDownloadFilename(receipt: Receipt): string {
  return `vision-${receipt.id}.json`;
}

interface EvidencePanelProps {
  receipt: Receipt;
  accountLevel?: number;
  className?: string;
}

export function EvidencePanel({ receipt, accountLevel = 1, className }: EvidencePanelProps) {
  const { t } = useAppLocale();
  const [imageDownloading, setImageDownloading] = useState(false);
  const [visionJsonDownloading, setVisionJsonDownloading] = useState(false);
  const [visionJsonError, setVisionJsonError] = useState<string | null>(null);
  const [visionJsonDebugUrl, setVisionJsonDebugUrl] = useState<string | null>(null);

  const handleVisionJsonDownload = async () => {
    setVisionJsonError(null);
    setVisionJsonDebugUrl(null);
    setVisionJsonDownloading(true);
    try {
      const apiUrl = new URL(`/api/receipts/${encodeURIComponent(receipt.id)}/vision-json`, window.location.origin);
      // Do not pass imageUrl from client: API uses only DB (visionRawJson, receipt_vision_raw, blob_url)
      // so we always get the original receipt's Vision JSON, never from synthetic/vector image.
      const res = await fetch(apiUrl.toString(), { credentials: "include" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 404) {
          setVisionJsonError("Bu fiş için Vision JSON yok.");
          setVisionJsonDebugUrl(`${window.location.origin}/api/receipts/${encodeURIComponent(receipt.id)}/vision-json?debug=1`);
          return;
        }
        if (res.status === 403) {
          setVisionJsonError("Access denied.");
          return;
        }
        if (res.status === 503 && body.hint) {
          setVisionJsonError(body.error + ". " + body.hint);
          return;
        }
        setVisionJsonError((body.error || body.details) || "Failed to load Vision JSON.");
        return;
      }
      if (body && (body as { _noVision?: boolean })._noVision) {
        setVisionJsonError((body as { message?: string }).message || "Bu fiş için Vision JSON yok.");
        return;
      }
      const json = body;
      const blob = new Blob([JSON.stringify(json, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = visionJsonDownloadFilename(receipt);
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Vision JSON download failed:", err);
      setVisionJsonError("Download failed.");
    } finally {
      setVisionJsonDownloading(false);
    }
  };

  const handleImageDownload = async () => {
    if (!receipt.id) return;
    setImageDownloading(true);
    try {
      const res = await fetch(`/api/receipts/${encodeURIComponent(receipt.id)}/image`, { credentials: "include" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = [body?.error, body?.details].filter(Boolean).join(" — ") || "Failed to download image";
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = imageDownloadFilename(receipt);
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Fiş görseli indirilemedi:", err);
    } finally {
      setImageDownloading(false);
    }
  };

  return (
    <ThemeCard accountLevel={accountLevel} className={cn("p-6", className)}>
      <h3 className="flex items-center gap-2 font-semibold" style={{ color: "var(--app-text-primary)" }}>
        <Info className="h-5 w-5" style={{ color: "var(--app-text-secondary)" }} />
        {t("evidence.title")}
      </h3>
      <p className="text-xs mt-1" style={{ color: "var(--app-text-muted)" }}>
        {t("evidence.visionJsonIntro")}
      </p>
      <div className="space-y-6 mt-4">
        <ConfidenceMeter confidence={receipt.confidence ?? 0} />

        {/* Google Vision JSON — en üstte, admin için her zaman görünsün */}
        <div
          className="rounded-xl p-4"
          style={{
            background: "var(--app-bg-elevated)",
            border: "1px solid var(--app-border)",
          }}
        >
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: "var(--app-text-primary)" }}>
            <FileJson className="h-4 w-4" />
            {t("evidence.visionJsonSectionTitle")}
          </h4>
          <p className="text-xs mb-3" style={{ color: "var(--app-text-muted)" }}>
            {t("evidence.visionJsonSectionDesc")}
          </p>
          <button
            type="button"
            onClick={handleVisionJsonDownload}
            disabled={visionJsonDownloading}
            className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              background: "var(--app-bg-elevated)",
              border: "1px solid var(--app-border)",
              color: "var(--app-text-primary)",
            }}
          >
            {visionJsonDownloading ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <FileJson className="h-4 w-4 mr-1.5" />
            )}
            {t("evidence.visionJsonDownloadBtn")}
          </button>
          {visionJsonError && (
            <div className="text-xs mt-2 space-y-1">
              <p style={{ color: "var(--destructive)" }}>{visionJsonError}</p>
              {visionJsonDebugUrl && (
                <a href={visionJsonDebugUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: "var(--app-primary)" }}>
                  Teşhis için tıkla (debug çıktısı)
                </a>
              )}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--app-text-primary)" }}>{t("evidence.receiptImageTitle")}</h4>
          <button
              type="button"
              onClick={handleImageDownload}
              disabled={imageDownloading}
              className="inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                background: "var(--app-bg-elevated)",
                border: "1px solid var(--app-border)",
                color: "var(--app-text-primary)",
              }}
            >
              {imageDownloading ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <ImageDown className="h-4 w-4 mr-1.5" />
              )}
              {t("evidence.downloadImage")}
            </button>
        </div>

        {receipt.pickedTotalCandidate != null && (
          <div>
            <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--app-text-primary)" }}>{t("evidence.selectedTotal")}</h4>
            <div className="rounded-xl p-4 space-y-2" style={{ background: "var(--app-bg-elevated)" }}>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--app-text-muted)" }}>{t("evidence.value")}</span>
                <span className="font-mono font-semibold tabular-nums">
                  {(receipt.pickedTotalCandidate?.value ?? 0).toFixed(2)} {receipt.currency}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--app-text-muted)" }}>{t("evidence.score")}</span>
                <span className="font-mono text-sm">
                  {((receipt.pickedTotalCandidate?.score ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "var(--app-text-muted)" }}>{t("evidence.fromLine")}</span>
                <span className="font-mono text-sm">
                  {receipt.pickedTotalCandidate?.fromLine ?? "—"}
                </span>
              </div>
            </div>
          </div>
        )}

        {receipt.pickedTotalCandidate?.reasons != null && receipt.pickedTotalCandidate.reasons.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--app-text-primary)" }}>{t("evidence.reasons")}</h4>
            <div className="space-y-2">
              {receipt.pickedTotalCandidate.reasons.map((reason, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 text-sm rounded-xl p-3"
                  style={{ background: "var(--app-bg-elevated)" }}
                >
                  <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: "var(--app-primary)" }} />
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {Array.isArray(receipt.ocrLines) && receipt.ocrLines.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--app-text-primary)" }}>{t("evidence.ocrLines")}</h4>
            <div className="rounded-xl p-4 max-h-64 overflow-y-auto" style={{ background: "var(--app-bg-elevated)" }}>
              <div className="space-y-1 font-mono text-xs">
                {receipt.ocrLines.map((line) => (
                  <div
                    key={line.lineNo}
                    className={cn(
                      "flex gap-4 py-1 rounded px-2",
                      line.lineNo === receipt.pickedTotalCandidate?.fromLine
                    )}
                    style={
                      line.lineNo === receipt.pickedTotalCandidate?.fromLine
                        ? { background: "var(--app-primary)20" }
                        : undefined
                    }
                  >
                    <span className="w-8" style={{ color: "var(--app-text-muted)" }}>
                      {line.lineNo}:
                    </span>
                    <span>{line.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {receipt.ocrRawText && (
          <div>
            <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--app-text-primary)" }}>{t("evidence.rawOcrText")}</h4>
            <div className="rounded-xl p-4 max-h-64 overflow-y-auto" style={{ background: "var(--app-bg-elevated)" }}>
              <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                {receipt.ocrRawText}
              </pre>
            </div>
          </div>
        )}

        {Array.isArray(receipt.reasons) && receipt.reasons.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold mb-3" style={{ color: "var(--app-text-primary)" }}>{t("evidence.verificationReasons")}</h4>
            <div className="flex flex-wrap gap-2">
              {receipt.reasons.map((reason, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-0.5 rounded-lg"
                  style={{
                    border: "1px solid var(--app-border)",
                    color: "var(--app-text-secondary)",
                  }}
                >
                  {reason}
                </span>
              ))}
            </div>
          </div>
        )}

        {receipt.pipelineLog && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h4 className="text-sm font-semibold" style={{ color: "var(--app-text-primary)" }}>Pipeline / Analysis Log</h4>
              <button
                type="button"
                className="shrink-0 inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium"
                style={{
                  background: "var(--app-bg-elevated)",
                  border: "1px solid var(--app-border)",
                  color: "var(--app-text-primary)",
                }}
                onClick={() => {
                  const filename = logDownloadFilename(receipt);
                  const blob = new Blob([receipt.pipelineLog!], { type: "text/plain;charset=utf-8" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = filename;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-4 w-4 mr-1.5" />
                İndir
              </button>
            </div>
            <div className="rounded-xl p-4" style={{ background: "var(--app-bg-elevated)" }}>
              <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                {receipt.pipelineLog}
              </pre>
            </div>
          </div>
        )}
      </div>
    </ThemeCard>
  );
}







