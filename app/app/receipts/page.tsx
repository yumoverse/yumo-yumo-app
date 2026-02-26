"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { ThemeCard } from "@/components/app/theme-card";
import { ErrorState } from "@/components/app/error-state";
import { StatusBadge } from "@/components/app/status-badge";
import { useTier } from "@/lib/theme/theme-context";
import { cn } from "@/lib/utils";
import type { Receipt, ReceiptFilters } from "@/lib/mock/types";
import { useAppLocale, translateApiError } from "@/lib/i18n/app-context";
import { useAppProfile } from "@/lib/app/profile-context";
import { Pagination } from "@/components/app/pagination";
import { Search, ReceiptText, Trash2, ChevronRight } from "lucide-react";


export default function ReceiptsPage() {
  const router = useRouter();
  const { t, locale } = useAppLocale();
  const { profile } = useAppProfile();
  const accountLevel = profile?.accountLevel ?? 1;
  const tier = useTier(accountLevel);
  const acc = tier.accent;

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ReceiptFilters>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  useEffect(() => {
    setIsAdmin(!!profile?.isAdmin);
    setCurrentPage(1);
  }, [filters, profile?.isAdmin]);

  useEffect(() => {
    loadReceipts();
  }, [currentPage, filters]);

  const loadReceipts = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        pageSize: pageSize.toString(),
      });
      if (filters.search?.trim()) params.set("search", filters.search.trim());
      if (filters.verifiedOnly) {
        params.set("statusFilter", "verifiedOnly");
      } else if (filters.status) {
        params.set("statusFilter", filters.status);
      }
      const res = await fetch(`/api/receipts?${params.toString()}`, { cache: "no-store" });

      if (!res.ok) {
        if (res.status === 401) setError(t("receipts.error.login") + " (401)");
        else setError(t("receipts.error.load"));
        setReceipts([]);
        return;
      }

      const data = await res.json();
      if (data.pagination) {
        setTotalPages(data.pagination.totalPages || 1);
        setTotalCount(data.pagination.total || 0);
        setCurrentPage(data.pagination.page || 1);
      }

      let list: Receipt[] = [];
      if (data.receipts && Array.isArray(data.receipts)) {
        const { convertReceiptAnalysisToReceipt } = await import("@/lib/receipt/receipt-converter");
        list = data.receipts
          .map((a: any) => {
            try {
              return convertReceiptAnalysisToReceipt(a);
            } catch {
              return null;
            }
          })
          .filter((r: Receipt | null): r is Receipt => r !== null);

        if (filters.dateFrom) list = list.filter((r) => r.date >= filters.dateFrom!);
        if (filters.dateTo) list = list.filter((r) => r.date <= filters.dateTo!);
      }
      setReceipts(list);
    } catch (err: any) {
      if (err?.message?.includes("Failed to fetch") || err?.name === "TypeError") {
        setError(t("receipts.error.network"));
      } else {
        setError(t("receipts.error.load"));
      }
      setReceipts([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (receiptId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(t("receipts.deleteConfirm"))) return;
    try {
      setDeletingId(receiptId);
      const response = await fetch(`/api/receipts/${receiptId}`, { method: "DELETE" });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || t("receipts.error.delete"));
      }
      setReceipts((prev) => prev.filter((r) => r.id !== receiptId));
    } catch (err: any) {
      alert(translateApiError(err.message, t) || t("receipts.error.delete"));
    } finally {
      setDeletingId(null);
    }
  };

  const hasActiveFilters = filters.search || filters.status || filters.verifiedOnly;

  if (error) {
    return (
      <AppShell>
        <ErrorState message={error} onRetry={loadReceipts} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto pb-24 lg:pb-8 space-y-6">
        {/* Hero */}
        <div className="text-center space-y-1">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-2"
            style={{
              background: tier.cardBg,
              border: `2px solid ${acc}44`,
              boxShadow: `0 0 20px ${acc}25`,
            }}
          >
            <ReceiptText className="h-7 w-7" style={{ color: acc }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--app-text-primary)" }}>
            {t("receipts.title")}
          </h1>
          <p className="text-sm text-white/50">{t("receipts.description")}</p>
          {isAdmin && totalCount > 0 && (
            <p className="text-xs font-mono text-white/40" title={t("admin.stats.totalReceipts", { count: totalCount })}>
              Toplam {totalCount} fiş
            </p>
          )}
        </div>

        {/* Filtre */}
        <ThemeCard accountLevel={accountLevel} className="p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
              <input
                type="text"
                placeholder={t("filter.search.placeholder")}
                value={filters.search || ""}
                onChange={(e) => setFilters({ ...filters, search: e.target.value || undefined })}
                className="w-full rounded-lg border pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                style={{ background: "var(--app-bg-elevated)", borderColor: "var(--app-border)", color: "var(--app-text-primary)" }}
              />
            </div>
            <select
              value={filters.status || ""}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  status: (e.target.value as ReceiptFilters["status"]) || undefined,
                })
              }
              className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              style={{ background: "var(--app-bg-elevated)", borderColor: "var(--app-border)", color: "var(--app-text-primary)" }}
            >
              <option value="">{t("filter.status.all")}</option>
              <option value="VERIFIED">{t("filter.status.verified")}</option>
              <option value="analyzed">{t("status.analyzed")}</option>
              <option value="scanned">{t("status.scanned")}</option>
              <option value="REJECTED">{t("filter.status.rejected")}</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-white/70 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={filters.verifiedOnly || false}
                onChange={(e) => setFilters({ ...filters, verifiedOnly: e.target.checked || undefined })}
                className="rounded border-white/20 bg-white/5"
              />
              {t("filter.verifiedOnly")}
            </label>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    ...filters,
                    search: undefined,
                    status: undefined,
                    verifiedOnly: undefined,
                  })
                }
                className="text-xs text-white/50 hover:text-white/80 underline"
              >
                {t("filter.clear")}
              </button>
            )}
          </div>
        </ThemeCard>

        {/* İçerik */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <ThemeCard key={i} accountLevel={accountLevel} className="p-4">
                <div className="flex gap-3">
                  <div className="h-12 w-12 rounded-xl bg-white/10 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 rounded bg-white/10 animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-white/10 animate-pulse" />
                    <div className="h-3 w-1/3 rounded bg-white/10 animate-pulse" />
                  </div>
                </div>
              </ThemeCard>
            ))}
          </div>
        ) : receipts.length === 0 ? (
          <ThemeCard accountLevel={accountLevel} className="p-8 text-center">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
              style={{ background: `${acc}15`, border: `1px solid ${acc}30` }}
            >
              <ReceiptText className="h-7 w-7" style={{ color: acc }} />
            </div>
            <h3 className="text-lg font-semibold text-white/90 mb-2">{t("receipts.empty")}</h3>
            <p className="text-sm text-white/50 max-w-sm mx-auto mb-6">{t("receipts.emptyDesc")}</p>
            <button
              type="button"
              onClick={() => router.push("/app/mine")}
              className="rounded-xl px-5 py-2.5 font-medium text-sm transition-all"
              style={{
                background: `linear-gradient(135deg,${acc},${tier.accent2})`,
                color: "#0a0a0a",
                boxShadow: `0 0 16px ${acc}40`,
              }}
            >
              {t("receipts.upload")}
            </button>
          </ThemeCard>
        ) : (
          <>
            <div className="space-y-2">
              {receipts.map((r) => {
                const hiddenPct = r.total > 0 ? (r.hiddenCost.totalHidden / r.total) * 100 : 0;
                return (
                  <ThemeCard
                    key={r.id}
                    accountLevel={accountLevel}
                    onClick={() => router.push(`/app/receipts/${r.id}`)}
                    className="p-4 cursor-pointer hover:opacity-95 transition-opacity active:scale-[0.99]"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: `${acc}12`,
                          border: `1px solid ${acc}28`,
                        }}
                      >
                        <ReceiptText className="h-5 w-5" style={{ color: acc }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-white/95 truncate">{r.merchantName}</p>
                            <p className="text-xs text-white/45 mt-0.5">
                              {r.date}
                              {r.time ? ` · ${r.time}` : ""}
                              {r.category && r.category !== "other" ? ` · ${r.category}` : ""}
                            </p>
                          </div>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={(e) => handleDelete(r.id, e)}
                              disabled={deletingId === r.id}
                              className="p-1.5 rounded-lg text-red-400/80 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs">
                          <span className="font-mono text-white/70">
                            {r.total.toFixed(2)} {r.currency}
                          </span>
                          <span className="text-white/40">·</span>
                          <span className="font-mono" style={{ color: acc }}>
                            {r.hiddenCost.totalHidden.toFixed(2)} {r.currency} gizli
                          </span>
                          {hiddenPct > 0 && (
                            <>
                              <span className="text-white/40">·</span>
                              <span className="text-white/40">%{hiddenPct.toFixed(0)}</span>
                            </>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <StatusBadge status={r.status} />
                          <span className="font-mono text-xs tabular-nums" style={{ color: tier.accent2 }}>
                            +{r.reward.amount.toFixed(2)} {r.reward.symbol}
                          </span>
                          {r.reward.ryumo != null && r.reward.ryumo > 0 && (
                            <span className="font-mono text-xs tabular-nums text-emerald-400">
                              +{r.reward.ryumo.toFixed(2)} rYUMO
                            </span>
                          )}
                          {isAdmin && (r.displayName || r.username) && (
                            <span className="text-[10px] text-white/40">{r.displayName || `@${r.username}`}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-white/30 shrink-0 mt-0.5" />
                    </div>
                  </ThemeCard>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="pt-2">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={(page) => {
                    setCurrentPage(page);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  locale={locale || "tr"}
                />
              </div>
            )}

            {totalCount > 0 && (
              <p className="text-center text-xs text-white/40">
                {locale === "tr"
                  ? `Gösterilen: ${(currentPage - 1) * pageSize + 1} – ${Math.min(currentPage * pageSize, totalCount)} / ${totalCount} fiş`
                  : `Showing: ${(currentPage - 1) * pageSize + 1} – ${Math.min(currentPage * pageSize, totalCount)} of ${totalCount} receipts`}
              </p>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
