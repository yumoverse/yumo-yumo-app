"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Loader2 } from "lucide-react";
import { useAppLocale } from "@/lib/i18n/app-context";
import { useAppProfile } from "@/lib/app/profile-context";

interface FeedbackRow {
  id: string;
  receiptId: string;
  username: string;
  bugTypes: string[];
  createdAt: string;
  receipt?: unknown;
}

export default function AdminFeedbackPage() {
  const router = useRouter();
  const { t } = useAppLocale();
  const { profile } = useAppProfile();
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const userIsAdmin = !!profile?.isAdmin;
    setIsAdmin(userIsAdmin);

    if (!userIsAdmin && profile !== undefined) {
      setError(t("admin.feedback.error.unauthorized"));
      setIsLoading(false);
      return;
    }
    if (userIsAdmin) loadFeedback();
  }, [profile?.isAdmin, profile]);

  const loadFeedback = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/admin/feedback");

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error(t("admin.feedback.error.forbidden"));
        }
        const errorData = await response.json().catch(() => ({
          error: t("admin.feedback.error.load"),
        }));
        throw new Error(errorData.error || t("admin.feedback.error.load"));
      }

      const data = await response.json();
      setFeedbacks(data.feedbacks || []);
    } catch (err: any) {
      console.error("[AdminFeedbackPage] Error loading feedback:", err);
      setError(err.message || t("admin.feedback.error.load"));
      setFeedbacks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  if (!isAdmin) {
    return (
      <AppShell>
        <ErrorState
          message={t("admin.feedback.error.unauthorized")}
          onRetry={() => router.push("/app/dashboard")}
        />
      </AppShell>
    );
  }

  if (error && !isLoading) {
    return (
      <AppShell>
        <ErrorState message={error} onRetry={loadFeedback} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              {t("admin.feedback.title")}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {t("admin.feedback.description")}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadFeedback}
            disabled={isLoading}
            className="gap-2 w-full sm:w-auto"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <span>{t("admin.feedback.refresh")}</span>
            )}
          </Button>
        </div>

        {isLoading ? (
          <DataTable
            columns={[]}
            data={[]}
            isLoading={true}
            emptyMessage={t("admin.feedback.loading")}
          />
        ) : feedbacks.length === 0 ? (
          <EmptyState
            title={t("admin.feedback.empty")}
            description={t("admin.feedback.emptyDesc")}
          />
        ) : (
          <DataTable<FeedbackRow>
            columns={[
              {
                key: "createdAt",
                header: "Date",
                render: (row) => (
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(row.createdAt)}
                  </span>
                ),
              },
              {
                key: "receiptId",
                header: "Receipt ID",
                render: (row) => (
                  <Link
                    href={`/app/receipts/${row.receiptId}`}
                    className="text-primary hover:underline font-mono text-sm"
                  >
                    {row.receiptId.slice(0, 8)}...
                  </Link>
                ),
              },
              {
                key: "username",
                header: t("admin.feedback.reporter"),
                render: (row) => (
                  <span className="font-medium">{row.username}</span>
                ),
              },
              {
                key: "bugTypes",
                header: t("admin.feedback.bugTypes"),
                render: (row) => (
                  <div className="flex flex-wrap gap-1">
                    {[...row.bugTypes]
                      .sort((a, b) =>
                        t(`reportBug.types.${a}`).localeCompare(
                          t(`reportBug.types.${b}`),
                          undefined,
                          { sensitivity: "base" }
                        )
                      )
                      .map((key) => (
                        <Badge key={key} variant="secondary" className="text-xs">
                          {t(`reportBug.types.${key}`)}
                        </Badge>
                      ))}
                  </div>
                ),
              },
              {
                key: "actions",
                header: t("admin.feedback.viewReceipt"),
                render: (row) => (
                  <Link href={`/app/receipts/${row.receiptId}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 gap-1"
                      title={t("admin.feedback.viewReceipt")}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </Link>
                ),
              },
            ]}
            data={feedbacks}
            emptyMessage={t("admin.feedback.empty")}
          />
        )}
      </div>
    </AppShell>
  );
}
