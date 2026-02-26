"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { ReceiptDetailHero } from "@/components/app/receipt-detail-hero";
import { ReceiptViewer } from "@/components/app/receipt-viewer";
import { EvidencePanel } from "@/components/app/evidence-panel";
import { BreakdownDonut } from "@/components/app/breakdown-donut";
import { BreakdownStackedBar } from "@/components/app/breakdown-stacked-bar";
import { ThemeCard } from "@/components/app/theme-card";
import { ErrorState } from "@/components/app/error-state";
import { EconomicsBanner } from "@/components/app/economics-banner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, Link as LinkIcon, Trash2, Info, Bug, Download } from "lucide-react";
import { useAppProfile } from "@/lib/app/profile-context";
import type { Receipt } from "@/lib/mock/types";
import { generateSyntheticReceiptBlob } from "@/lib/receipt/synthetic-receipt";
import { useAppLocale } from "@/lib/i18n/app-context";
import { ReportBugModal } from "@/components/app/report-bug-modal";
import Link from "next/link";

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syntheticReceiptUrl, setSyntheticReceiptUrl] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImageDownloading, setIsImageDownloading] = useState(false);
  const [reportBugOpen, setReportBugOpen] = useState(false);
  const { t } = useAppLocale();
  const { profile } = useAppProfile();
  const accountLevel = profile?.accountLevel ?? 1;
  const isAdmin = profile?.isAdmin ?? false;

  useEffect(() => {
    if (params.id) {
      loadReceipt((params.id as string).trim());
    }
  }, [params.id]);

  const loadReceipt = async (id: string) => {
    const idTrimmed = id?.trim() ?? id;
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/receipts/${encodeURIComponent(idTrimmed)}`, { credentials: "include" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const msg = body?.error === "Receipt not found"
          ? (body.receiptId
            ? `Receipt not found (ID: ${body.receiptId}). It may have been deleted.`
            : "Receipt not found. It may have been deleted.")
          : (body?.error || "Failed to load receipt");
        setError(msg);
        return;
      }
      const analysis = await response.json();
      const { convertReceiptAnalysisToReceipt } = await import("@/lib/receipt/receipt-converter");
      const data = convertReceiptAnalysisToReceipt(analysis);
      if (!data) {
        setError("Receipt not found");
      } else {
        setReceipt(data);
        
        // Generate synthetic receipt image
        try {
          const syntheticBlob = await generateSyntheticReceiptBlob({
            merchantName: data.merchantName,
            date: data.date,
            time: data.time, // Time from receipt data (if available)
            category: data.category || "other",
            total: data.total,
            vat: data.vat,
            currency: data.currency,
            receiptNumber: data.id, // Use receipt ID as receipt number
          });
          const syntheticUrl = URL.createObjectURL(syntheticBlob);
          setSyntheticReceiptUrl(syntheticUrl);
        } catch (err) {
          console.error("Failed to generate synthetic receipt:", err);
        }
      }
    } catch (err) {
      setError("Failed to load receipt");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup synthetic receipt URL on unmount
  useEffect(() => {
    return () => {
      if (syntheticReceiptUrl) {
        URL.revokeObjectURL(syntheticReceiptUrl);
      }
    };
  }, [syntheticReceiptUrl]);

  const handleDelete = async () => {
    if (!receipt) return;
    
    if (!confirm("Are you sure you want to delete this receipt? This action cannot be undone.")) {
      return;
    }

    try {
      setIsDeleting(true);
      const response = await fetch(`/api/receipts/${receipt.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete receipt");
      }

      // Redirect to receipts list
      router.push("/app/receipts");
    } catch (err: any) {
      console.error("Failed to delete receipt:", err);
      alert(err.message || "Failed to delete receipt");
      setIsDeleting(false);
    }
  };

  const imageDownloadFilename = (r: Receipt): string => {
    if (r.blobFilename) return r.blobFilename;
    const sanitize = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 30);
    const merchant = sanitize(r.merchantName || "receipt");
    const date = (r.date || "").split("T")[0] || "unknown-date";
    const amount = (r.total ?? r.totalPaid ?? 0).toFixed(2);
    const currency = r.currency || "TRY";
    return `${merchant}-${date}-${amount}-${currency}-${r.id}.jpg`;
  };

  const handleShare = async () => {
    if (!receipt) return;
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    const title = `${receipt.merchantName} · ${receipt.total.toFixed(2)} ${receipt.currency}`;
    const text = `${t("receiptDetail.total")}: ${receipt.total.toFixed(2)} ${receipt.currency} · ${t("receiptDetail.hiddenCost")}: ${receipt.hiddenCost.totalHidden.toFixed(2)}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        alert(t("common.linkCopied") || "Link kopyalandı");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") console.error(err);
    }
  };

  const handleImageDownload = async () => {
    if (!receipt?.id) return;
    setIsImageDownloading(true);
    try {
      if (isAdmin) {
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
      } else if (receipt.imageUrl) {
        const res = await fetch(receipt.imageUrl);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = imageDownloadFilename(receipt);
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Failed to download receipt image:", err);
      alert(err instanceof Error ? err.message : "Failed to download image");
    } finally {
      setIsImageDownloading(false);
    }
  };

  if (error || (isLoading === false && !receipt)) {
    const isNotFound = !receipt && (error?.toLowerCase().includes("not found") || error?.toLowerCase().includes("bulunamadı"));
    return (
      <AppShell>
        <div className="max-w-md mx-auto px-4 pt-8">
          <ErrorState
            message={error || t("errors.receiptDetail.notFound")}
            onRetry={() => params.id && loadReceipt(params.id as string)}
          />
          {isNotFound && (
            <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={() => router.push("/app/receipts")}
                className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
                style={{
                  background: "var(--app-bg-elevated)",
                  border: "1px solid var(--app-border)",
                  color: "var(--app-text-primary)",
                }}
              >
                {t("errors.receiptDetail.backToList")}
              </button>
              <button
                type="button"
                onClick={() => router.push("/app/rewards")}
                className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
                style={{
                  background: "var(--app-bg-elevated)",
                  border: "1px solid var(--app-border)",
                  color: "var(--app-text-primary)",
                }}
              >
                {t("errors.receiptDetail.goToRewards")}
              </button>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  if (isLoading || !receipt) {
    return (
      <AppShell>
        <div className="space-y-4">
          <div className="h-8 bg-muted animate-pulse rounded w-1/3" />
          <div className="h-64 bg-muted animate-pulse rounded" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6 pb-24 lg:pb-8">
        {/* Hero: Vektör fiş + Özet */}
        <ReceiptDetailHero
          receipt={receipt}
          accountLevel={accountLevel}
          onBack={() => router.back()}
          onShare={handleShare}
          showVectorReceipt
          compact
        />

        {/* Admin delete butonu */}
        {isAdmin && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
              style={{
                background: "rgba(239,68,68,0.2)",
                border: "1px solid rgba(239,68,68,0.5)",
                color: "#ef4444",
              }}
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        )}

        <Tabs defaultValue="summary" className="space-y-4">
          <TabsList
            className="rounded-xl p-1 gap-0.5 bg-[var(--app-bg-elevated)] border border-[var(--app-border)]"
          >
            <TabsTrigger
              value="summary"
              className="rounded-lg transition-colors data-[state=active]:bg-[var(--app-bg-elevated)] data-[state=active]:text-[var(--app-text-primary)] data-[state=inactive]:text-[var(--app-text-muted)]"
            >
              Summary
            </TabsTrigger>
            <TabsTrigger
              value="breakdown"
              className="rounded-lg transition-colors data-[state=active]:bg-[var(--app-bg-elevated)] data-[state=active]:text-[var(--app-text-primary)] data-[state=inactive]:text-[var(--app-text-muted)]"
            >
              Breakdown
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger
                value="evidence"
                className="rounded-lg transition-colors data-[state=active]:bg-[var(--app-bg-elevated)] data-[state=active]:text-[var(--app-text-primary)] data-[state=inactive]:text-[var(--app-text-muted)]"
              >
                Evidence (Admin)
              </TabsTrigger>
            )}
            <TabsTrigger
              value="history"
              className="rounded-lg transition-colors data-[state=active]:bg-[var(--app-bg-elevated)] data-[state=active]:text-[var(--app-text-primary)] data-[state=inactive]:text-[var(--app-text-muted)]"
            >
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="space-y-4">
            {isAdmin && (
              <ThemeCard accountLevel={accountLevel} className="p-4 border-destructive/50">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <p className="font-medium mb-1" style={{ color: "var(--app-text-primary)" }}>Admin Actions</p>
                    <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                      Delete this receipt permanently from the system
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleImageDownload}
                      disabled={isImageDownloading || (!isAdmin && !receipt.imageUrl)}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                      style={{
                        background: "var(--app-bg-elevated)",
                        border: "1px solid var(--app-border)",
                        color: "var(--app-text-primary)",
                      }}
                    >
                      <Download className="h-4 w-4" />
                      {isImageDownloading ? "Downloading..." : "Download Image"}
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                      style={{
                        background: "rgba(239,68,68,0.2)",
                        border: "1px solid rgba(239,68,68,0.5)",
                        color: "#ef4444",
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      {isDeleting ? "Deleting..." : "Delete Receipt"}
                    </button>
                  </div>
                </div>
              </ThemeCard>
            )}

            <div className="grid lg:grid-cols-2 gap-4">
              <BreakdownDonut
                hiddenCost={receipt.hiddenCost}
                currency={receipt.currency}
                accountLevel={accountLevel}
              />
              <BreakdownStackedBar
                hiddenCost={receipt.hiddenCost}
                currency={receipt.currency}
                accountLevel={accountLevel}
              />
            </div>

            {receipt.duplicateCheck.isDuplicate && (
              <ThemeCard accountLevel={accountLevel} className="p-4 border-amber-500/50">
                <div className="p-0">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium mb-1">Duplicate Receipt</p>
                      <p className="text-sm text-muted-foreground">
                        This receipt was previously uploaded.
                      </p>
                      {receipt.duplicateCheck.matchedReceiptId && (
                        <Link
                          href={`/app/receipts/${receipt.duplicateCheck.matchedReceiptId}`}
                          className="text-sm flex items-center gap-1 mt-2 hover:underline"
                          style={{ color: "var(--app-primary)" }}
                        >
                          <LinkIcon className="h-3 w-3" />
                          View original receipt
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </ThemeCard>
            )}

          </TabsContent>

          <TabsContent value="breakdown" className="space-y-4">
            <EconomicsBanner merchantChannel={receipt.merchantChannel} accountLevel={accountLevel} />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setReportBugOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium"
                style={{
                  background: "var(--app-bg-elevated)",
                  border: "1px solid var(--app-border)",
                  color: "var(--app-text-primary)",
                }}
              >
                <Bug className="w-4 h-4" />
                {t("reportBug.button")}
              </button>
            </div>
            
            {/* Margin Violation Warning - Show to all users (friendly reminder) */}
            {receipt.marginViolation && receipt.marginViolation.hasViolation && (
              <ThemeCard accountLevel={accountLevel} className="p-4 border-blue-500/50">
                  <div className="flex items-start gap-3">
                    <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium mb-2 text-blue-600">📸 Fotoğraf İpucu</p>
                      <p className="text-sm text-muted-foreground mb-2">
                        {receipt.marginViolation.violationCount >= 3
                          ? "Fişinizin etrafında yeterli boşluk yok. Lütfen bir sonraki fotoğrafta fişi koyu bir yüzeye yerleştirip tüm kenarlardan boşluk bırakın. Bu, daha iyi okuma kalitesi sağlar. (3. uyarı - bir sonraki fotoğrafta dikkat edin)"
                          : receipt.marginViolation.violationCount >= 2
                          ? "Fişinizin etrafında yeterli boşluk yok. Lütfen bir sonraki fotoğrafta fişi koyu bir yüzeye yerleştirip tüm kenarlardan boşluk bırakın. Bu, daha iyi okuma kalitesi sağlar."
                          : "Fişinizin etrafında biraz daha boşluk bırakırsanız, okuma kalitesi daha iyi olur. Lütfen fişi koyu bir yüzeye yerleştirip tüm kenarlardan boşluk bırakın."}
                      </p>
                      <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                        💡 İpucu: Fişi koyu bir zemin üzerine koyun ve tüm kenarlardan en az 2-3 cm boşluk bırakın.
                      </div>
                    </div>
                  </div>
              </ThemeCard>
            )}
            
            {/* Admin Warnings - All warnings and rejection reasons */}
            {isAdmin && receipt.fraudInfo && (
              <>
                {/* All Admin Warnings */}
                {receipt.fraudInfo.warnings && receipt.fraudInfo.warnings.length > 0 && (
                  <ThemeCard accountLevel={accountLevel} className="p-4 border-amber-500/50">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium mb-1 text-amber-600">Admin Warnings</p>
                          <p className="text-sm text-muted-foreground mb-2">
                            This receipt had issues but was allowed for admin review.
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-xs text-amber-700 dark:text-amber-400">
                            {receipt.fraudInfo.warnings.map((warning: string, idx: number) => (
                              <li key={idx}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                  </ThemeCard>
                )}
                
                {/* Rejection Reasons Warning */}
                {receipt.fraudInfo.rejectionReasons && receipt.fraudInfo.rejectionReasons.length > 0 && (
                  <ThemeCard accountLevel={accountLevel} className="p-4 border-red-500/50">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium mb-1 text-red-600">Rejection Reasons (Admin Override)</p>
                          <p className="text-sm text-muted-foreground mb-2">
                            This receipt would normally be rejected but was allowed for admin review.
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-xs text-red-700 dark:text-red-400">
                            {receipt.fraudInfo.rejectionReasons.map((reason: string, idx: number) => (
                              <li key={idx}>{reason}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                  </ThemeCard>
                )}
              </>
            )}
            
            <ThemeCard accountLevel={accountLevel} className="p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--app-text-primary)" }}>Cost Breakdown</h3>
              <div className="space-y-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: "var(--app-bg-elevated)" }}>
                    <div>
                      <p className="font-medium" style={{ color: "var(--app-text-primary)" }}>Product Value</p>
                      <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                        The actual value of what you received
                      </p>
                    </div>
                    <p className="font-mono font-semibold tabular-nums" style={{ color: "var(--app-text-primary)" }}>
                      {receipt.hiddenCost.productValue.toFixed(2)}{" "}
                      {receipt.currency}
                    </p>
                  </div>

                  <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: "var(--app-bg-elevated)" }}>
                    <div>
                      <p className="font-medium" style={{ color: "var(--app-text-primary)" }}>Import & System</p>
                      <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                        Costs from import systems and infrastructure
                      </p>
                    </div>
                    <p className="font-mono font-semibold tabular-nums" style={{ color: "var(--app-primary)" }}>
                      {receipt.hiddenCost.importSystem.toFixed(2)}{" "}
                      {receipt.currency}
                    </p>
                  </div>

                  {receipt.hiddenCost.systemSubsidy !== undefined &&
                    receipt.hiddenCost.systemSubsidy > 0 && (
                      <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: "var(--app-bg-elevated)" }}>
                        <div>
                          <p className="font-medium" style={{ color: "var(--app-text-primary)" }}>System Subsidy</p>
                          <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                            Discounts, promotions or margin compression
                          </p>
                        </div>
                        <p className="font-mono font-semibold tabular-nums" style={{ color: "var(--app-primary)" }}>
                          {receipt.hiddenCost.systemSubsidy.toFixed(2)}{" "}
                          {receipt.currency}
                        </p>
                      </div>
                    )}

                  <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: "var(--app-bg-elevated)" }}>
                    <div>
                      <p className="font-medium" style={{ color: "var(--app-text-primary)" }}>Retail/Brand</p>
                      <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                        Brand markup and retail margins
                      </p>
                    </div>
                    <p className="font-mono font-semibold tabular-nums" style={{ color: "var(--app-primary)" }}>
                      {receipt.hiddenCost.retailBrand.toFixed(2)}{" "}
                      {receipt.currency}
                    </p>
                  </div>

                  <div className="flex justify-between items-center p-4 rounded-xl" style={{ background: "var(--app-bg-elevated)" }}>
                    <div>
                      <p className="font-medium" style={{ color: "var(--app-text-primary)" }}>State (VAT)</p>
                      <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                        Value-added tax and government fees
                      </p>
                    </div>
                    <p className="font-mono font-semibold tabular-nums" style={{ color: "var(--app-primary)" }}>
                      {receipt.hiddenCost.state.toFixed(2)} {receipt.currency}
                    </p>
                  </div>

                  <div
                    className="flex justify-between items-center p-4 rounded-xl"
                    style={{
                      background: "var(--app-bg-elevated)",
                      border: "1px solid var(--app-border)",
                    }}
                  >
                    <div>
                      <p className="font-semibold" style={{ color: "var(--app-text-primary)" }}>Total Hidden Cost</p>
                      <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                        Sum of all hidden costs
                      </p>
                    </div>
                    <p className="font-mono font-bold text-lg tabular-nums" style={{ color: "var(--app-primary)" }}>
                      {receipt.hiddenCost.totalHidden.toFixed(2)}{" "}
                      {receipt.currency}
                    </p>
                  </div>
                </div>
              </div>
            </ThemeCard>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="evidence">
              <div className="grid lg:grid-cols-2 gap-4">
                <ReceiptViewer
                  imageUrl={syntheticReceiptUrl || undefined}
                  accountLevel={accountLevel}
                />
                <EvidencePanel
                  accountLevel={accountLevel}
                  receipt={receipt}
                />
              </div>
            </TabsContent>
          )}

          <TabsContent value="history" className="space-y-4">
            <ThemeCard accountLevel={accountLevel} className="p-6">
              <h3 className="text-lg font-semibold mb-4" style={{ color: "var(--app-text-primary)" }}>Timeline</h3>
                <div className="space-y-4">
                  {[
                    {
                      event: "Receipt Uploaded",
                      time: new Date(receipt.createdAt).toLocaleString(),
                      status: "completed",
                    },
                    {
                      event: "OCR Processing",
                      time: new Date(
                        new Date(receipt.createdAt).getTime() + 1000 * 60
                      ).toLocaleString(),
                      status: "completed",
                    },
                    {
                      event: "Verification",
                      time:
                        receipt.status === "VERIFIED"
                          ? new Date(
                              new Date(receipt.createdAt).getTime() +
                                1000 * 60 * 2
                            ).toLocaleString()
                          : "Pending",
                      status: receipt.status === "VERIFIED" ? "completed" : "pending",
                    },
                    {
                      event: "Mined",
                      time:
                        receipt.status === "VERIFIED"
                          ? new Date(
                              new Date(receipt.createdAt).getTime() +
                                1000 * 60 * 3
                            ).toLocaleString()
                          : "Pending",
                      status: receipt.status === "VERIFIED" ? "completed" : "pending",
                    },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-start gap-4">
                      <div
                        className="w-2 h-2 rounded-full mt-2"
                        style={{
                          backgroundColor:
                            item.status === "completed"
                              ? "var(--app-primary)"
                              : "var(--app-text-muted)",
                        }}
                      />
                      <div className="flex-1">
                        <p className="font-medium" style={{ color: "var(--app-text-primary)" }}>{item.event}</p>
                        <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
                          {item.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
            </ThemeCard>
          </TabsContent>
        </Tabs>

        {receipt?.id && (
          <ReportBugModal
            open={reportBugOpen}
            onOpenChange={setReportBugOpen}
            receiptId={receipt.id}
          />
        )}
      </div>
    </AppShell>
  );
}
