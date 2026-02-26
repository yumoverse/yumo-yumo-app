"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import { Eye, Loader2 } from "lucide-react";
import type { Receipt } from "@/lib/mock/types";
import { useAppLocale } from "@/lib/i18n/app-context";
import { useAppProfile } from "@/lib/app/profile-context";

export default function AdminRejectedPage() {
  const router = useRouter();
  const { t } = useAppLocale();
  const { profile } = useAppProfile();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const userIsAdmin = !!profile?.isAdmin;
    setIsAdmin(userIsAdmin);

    if (!userIsAdmin && profile !== undefined) {
      setError(t("admin.rejected.error.unauthorized"));
      setIsLoading(false);
      return;
    }
    if (userIsAdmin) loadRejectedReceipts();
  }, [profile?.isAdmin, profile]);

  const loadRejectedReceipts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/admin/rejected-receipts");

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(t("admin.rejected.error.forbidden"));
        }
        const errorData = await response.json().catch(() => ({ error: t("admin.rejected.error.load") }));
        throw new Error(errorData.error || t("admin.rejected.error.load"));
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
      console.error("[AdminRejectedPage] Error loading rejected receipts:", err);
      setError(err.message || t("admin.rejected.error.load"));
      setReceipts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewReceipt = (receipt: Receipt) => {
    router.push(`/app/receipts/${receipt.id}`);
  };

  if (!isAdmin) {
    return (
      <AppShell>
        <ErrorState
          message={t("admin.rejected.error.unauthorized")}
          onRetry={() => router.push("/app/dashboard")}
        />
      </AppShell>
    );
  }

  if (error && !isLoading) {
    return (
      <AppShell>
        <ErrorState message={error} onRetry={loadRejectedReceipts} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t("admin.rejected.title")}</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {t("admin.rejected.description")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadRejectedReceipts}
            disabled={isLoading}
            className="gap-2 w-full sm:w-auto"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span>{t("admin.rejected.refresh")}</span>
            )}
          </Button>
        </div>

        {isLoading ? (
          <DataTable
            columns={[]}
            data={[]}
            isLoading={true}
            emptyMessage={t("admin.rejected.loading")}
          />
        ) : receipts.length === 0 ? (
          <EmptyState
            title={t("admin.rejected.noRejected")}
            description={t("admin.rejected.noRejectedDesc")}
          />
        ) : (
          <DataTable
            columns={[
              {
                key: "merchantName",
                header: t("admin.rejected.merchant"),
                render: (r) => (
                  <span className="font-medium">{r.merchantName}</span>
                ),
              },
              {
                key: "username",
                header: t("admin.rejected.user"),
                render: (r) => (
                  <span className="text-sm text-muted-foreground">
                    {r.username || t("common.na")}
                  </span>
                ),
              },
              {
                key: "date",
                header: t("admin.rejected.date"),
                render: (r) => (
                  <span className="text-sm">{r.date}</span>
                ),
              },
              {
                key: "total",
                header: t("admin.rejected.total"),
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
                header: t("admin.rejected.status"),
                render: (r) => <StatusBadge status={r.status} />,
              },
              {
                key: "actions",
                header: t("admin.rejected.actions"),
                render: (r) => (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewReceipt(r);
                    }}
                    className="h-8 px-2"
                    title={t("admin.rejected.view")}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                ),
              },
            ]}
            data={receipts}
            onRowClick={handleViewReceipt}
            emptyMessage={t("admin.rejected.noRejected")}
          />
        )}
      </div>
    </AppShell>
  );
}
