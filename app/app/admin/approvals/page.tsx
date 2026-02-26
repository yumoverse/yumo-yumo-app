"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Eye, Loader2 } from "lucide-react";
import type { Receipt } from "@/lib/mock/types";
import { useAppLocale } from "@/lib/i18n/app-context";
import { useAppProfile } from "@/lib/app/profile-context";

export default function AdminApprovalsPage() {
  const router = useRouter();
  const { t } = useAppLocale();
  const { profile } = useAppProfile();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [totalReceiptsInSystem, setTotalReceiptsInSystem] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const userIsAdmin = !!profile?.isAdmin;
    setIsAdmin(userIsAdmin);

    if (!userIsAdmin && profile !== undefined) {
      setError(t("admin.approvals.error.unauthorized"));
      setIsLoading(false);
      return;
    }
    if (userIsAdmin) loadPendingReceipts();
  }, [profile?.isAdmin, profile]);

  const loadAdminStats = async () => {
    try {
      const res = await fetch("/api/admin/stats");
      if (res.ok) {
        const data = await res.json();
        setTotalReceiptsInSystem(typeof data.totalReceipts === "number" ? data.totalReceipts : null);
      }
    } catch {
      setTotalReceiptsInSystem(null);
    }
  };

  const loadPendingReceipts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      loadAdminStats();

      const response = await fetch("/api/admin/pending-receipts");

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(t("admin.approvals.error.forbidden"));
        }
        const errorData = await response.json().catch(() => ({ error: t("admin.approvals.error.load") }));
        throw new Error(errorData.error || t("admin.approvals.error.load"));
      }

      const data = await response.json();

      let receiptsData: Receipt[] = [];
      if (data.receipts && Array.isArray(data.receipts)) {
        const { convertReceiptAnalysisToReceipt } = await import("@/lib/receipt/receipt-converter");
        receiptsData = data.receipts.map((analysis: any) => {
          try {
            return convertReceiptAnalysisToReceipt(analysis);
          } catch (err) {
            console.error("Failed to convert receipt:", analysis.receiptId, err);
            return null;
          }
        }).filter((r: Receipt | null): r is Receipt => r !== null);
      }

      setReceipts(receiptsData);
    } catch (err: any) {
      console.error("[AdminApprovalsPage] Error loading pending receipts:", err);
      setError(err.message || t("admin.approvals.error.load"));
      setReceipts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (receiptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(t("admin.approvals.approveConfirm"))) {
      return;
    }

    try {
      setProcessingIds(prev => new Set(prev).add(receiptId));
      
      const response = await fetch("/api/admin/approve-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ receiptId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t("admin.approvals.error.approve"));
      }

      // Remove from local state
      setReceipts((prev) => prev.filter((r) => r.id !== receiptId));
    } catch (err: any) {
      console.error("Failed to approve receipt:", err);
      alert(err.message || t("admin.approvals.error.approve"));
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(receiptId);
        return next;
      });
    }
  };

  const handleReject = async (receiptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const reason = prompt(t("admin.approvals.rejectReason"));
    if (reason === null) {
      return; // User cancelled
    }

    if (!confirm(t("admin.approvals.rejectConfirm"))) {
      return;
    }

    try {
      setProcessingIds(prev => new Set(prev).add(receiptId));
      
      const response = await fetch("/api/admin/reject-receipt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ receiptId, reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || t("admin.approvals.error.reject"));
      }

      // Remove from local state
      setReceipts((prev) => prev.filter((r) => r.id !== receiptId));
    } catch (err: any) {
      console.error("Failed to reject receipt:", err);
      alert(err.message || t("admin.approvals.error.reject"));
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(receiptId);
        return next;
      });
    }
  };

  const handleViewReceipt = (receipt: Receipt) => {
    router.push(`/app/receipts/${receipt.id}`);
  };

  if (!isAdmin) {
    return (
      <AppShell>
        <ErrorState 
          message={t("admin.approvals.error.unauthorized")} 
          onRetry={() => router.push("/app/dashboard")} 
        />
      </AppShell>
    );
  }

  if (error && !isLoading) {
    return (
      <AppShell>
        <ErrorState message={error} onRetry={loadPendingReceipts} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t("admin.approvals.title")}</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {t("admin.approvals.description")}
            </p>
            {totalReceiptsInSystem !== null && (
              <p className="text-xs text-muted-foreground/80 mt-2">
                {t("admin.stats.totalReceipts", { count: totalReceiptsInSystem })}
              </p>
            )}
          </div>
          <Button 
            variant="outline" 
            onClick={loadPendingReceipts}
            disabled={isLoading}
            className="gap-2 w-full sm:w-auto"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span>{t("admin.approvals.refresh")}</span>
            )}
          </Button>
        </div>

        {isLoading ? (
          <DataTable
            columns={[]}
            data={[]}
            isLoading={true}
            emptyMessage={t("admin.approvals.loading")}
          />
        ) : receipts.length === 0 ? (
          <EmptyState
            title={t("admin.approvals.noPending")}
            description={t("admin.approvals.noPendingDesc")}
          />
        ) : (
          <DataTable
            columns={[
              {
                key: "merchantName",
                header: t("admin.approvals.merchant"),
                render: (r) => (
                  <span className="font-medium">{r.merchantName}</span>
                ),
              },
              {
                key: "username",
                header: t("admin.approvals.user"),
                render: (r) => (
                  <span className="text-sm text-muted-foreground">
                    {r.username || t("common.na")}
                  </span>
                ),
              },
              {
                key: "date",
                header: t("admin.approvals.date"),
                render: (r) => (
                  <span className="text-sm">{r.date}</span>
                ),
              },
              {
                key: "total",
                header: t("admin.approvals.total"),
                render: (r) => (
                  <span className="font-semibold">
                    {r.total?.toLocaleString("tr-TR", {
                      style: "currency",
                      currency: r.currency || "TRY",
                    }) || t("common.na")}
                  </span>
                ),
              },
              {
                key: "status",
                header: t("admin.approvals.status"),
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: "actions",
                header: t("admin.approvals.actions"),
                render: (r) => (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleViewReceipt(r)}
                      className="h-8 px-2"
                      title={t("admin.approvals.view")}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="default"
                      size="sm"
                      onClick={(e) => handleApprove(r.id, e)}
                      disabled={processingIds.has(r.id) || r.status !== "PENDING"}
                      className="h-8 px-2 bg-green-600 hover:bg-green-700"
                      title={r.status !== "PENDING" ? undefined : t("admin.approvals.approve")}
                    >
                      {processingIds.has(r.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => handleReject(r.id, e)}
                      disabled={processingIds.has(r.id) || r.status !== "PENDING"}
                      className="h-8 px-2"
                      title={r.status !== "PENDING" ? undefined : t("admin.approvals.reject")}
                    >
                      {processingIds.has(r.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ),
              },
            ]}
            data={receipts}
            onRowClick={handleViewReceipt}
            emptyMessage={t("admin.approvals.noPending")}
          />
        )}
      </div>
    </AppShell>
  );
}
