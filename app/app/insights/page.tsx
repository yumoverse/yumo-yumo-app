"use client";

import { useEffect, useState, useMemo, useRef, lazy, Suspense } from "react";
import { AppShell } from "@/components/app/app-shell";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { ThemeCard } from "@/components/app/theme-card";
import { TrendingUp } from "lucide-react";
import { useAppLocale } from "@/lib/i18n/app-context";
import { useAppProfile } from "@/lib/app/profile-context";
import { TruthMetricHero } from "@/components/insights/truth-metric-hero";
import { MoneyFlowBreakdown } from "@/components/insights/money-flow-breakdown";
import { WhatIfSimulator } from "@/components/insights/what-if-simulator";
import { FiltersBar } from "@/components/insights/filters-bar";
import {
  receiptToSummary,
  aggregateReceipts,
  filterReceipts,
} from "@/lib/insights/compute";
import type { ReceiptSummary, InsightsAggregate, InsightsFilters } from "@/lib/insights/types";

const MerchantTables = lazy(() => import("@/components/insights/merchant-tables").then((m) => ({ default: m.MerchantTables })));
const SpendingPulse = lazy(() => import("@/components/insights/spending-pulse").then((m) => ({ default: m.SpendingPulse })));
const BehaviorTrapDetector = lazy(() => import("@/components/insights/behavior-trap-detector").then((m) => ({ default: m.BehaviorTrapDetector })));
const TimePatterns = lazy(() => import("@/components/insights/time-patterns").then((m) => ({ default: m.TimePatterns })));

export default function InsightsPage() {
  const { t } = useAppLocale();
  const { profile } = useAppProfile();
  const accountLevel = profile?.accountLevel ?? 1;
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<InsightsFilters>({
    timeRange: "all",
  });

  const loadInsights = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const tr = filters.timeRange || "all";
      const url =
        tr === "all"
          ? "/api/receipts?page=1&pageSize=500&timeRange=all&forInsights=true"
          : `/api/receipts?timeRange=${tr}&forInsights=true`;
      const receiptsResponse = await fetch(url);
      let receiptsData: ReceiptSummary[] = [];

      if (receiptsResponse.ok) {
        const data = await receiptsResponse.json();
        if (data.insightsFormat && Array.isArray(data.receipts)) {
          receiptsData = data.receipts;
        } else {
          receiptsData = (data.receipts || [])
            .map((analysis: any) => {
              try { return receiptToSummary(analysis); } catch { return null; }
            })
            .filter((r: ReceiptSummary | null): r is ReceiptSummary => r !== null);
        }
      }
      
      setReceipts(receiptsData);
    } catch (err) {
      setError(t("insights.error"));
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const lastFetchedAt = useRef<number>(0);
  const STALE_MS = 2 * 60 * 1000; // 2 min

  useEffect(() => {
    loadInsights().then(() => { lastFetchedAt.current = Date.now(); });
  }, [filters.timeRange]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && Date.now() - lastFetchedAt.current > STALE_MS) {
        loadInsights().then(() => { lastFetchedAt.current = Date.now(); });
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // Re-aggregate when filters change (data is already loaded)
  // No need to reload from API, just recompute aggregates

  const filteredReceipts = useMemo(() => filterReceipts(receipts, filters), [receipts, filters]);

  const aggregate = useMemo(() => aggregateReceipts(receipts, filters), [receipts, filters]);

  const availableCountries = useMemo(
    () => Array.from(new Set(receipts.map((r) => r.country))).sort(),
    [receipts]
  );
  const availableCategories = useMemo(
    () => Array.from(new Set(receipts.map((r) => r.category || "other").filter(Boolean))).sort(),
    [receipts]
  );

  // Get default currency
  const defaultCurrency =
    receipts.length > 0 && receipts[0].currency
      ? receipts[0].currency
      : "USD";

  // Get time range label
  const timeRangeLabel =
    filters.timeRange === "7d"
      ? t("insights.timeRange.7d")
      : filters.timeRange === "30d"
      ? t("insights.timeRange.30d")
      : filters.timeRange === "90d"
      ? t("insights.timeRange.90d")
      : t("insights.timeRange.all");

  if (error) {
    return (
      <AppShell>
        <ErrorState message={error} onRetry={loadInsights} />
      </AppShell>
    );
  }

  if (!isLoading && receipts.length === 0) {
    return (
      <AppShell>
        <ThemeCard accountLevel={accountLevel} className="p-8">
          <EmptyState
            title={t("insights.empty")}
            description={t("insights.emptyDesc")}
            icon={TrendingUp}
          />
        </ThemeCard>
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
              background: "var(--app-bg-elevated)",
              border: "2px solid var(--app-border)",
              boxShadow: "0 0 20px rgba(0,0,0,.2)",
            }}
          >
            <TrendingUp className="h-7 w-7" style={{ color: "var(--app-primary)" }} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "var(--app-text-primary)" }}>
            {t("insights.title")}
          </h1>
          <p className="text-sm" style={{ color: "var(--app-text-muted)" }}>
            {t("insights.description")}
          </p>
        </div>

        {/* Filters */}
        <FiltersBar
          accountLevel={accountLevel}
          filters={filters}
          onFiltersChange={setFilters}
          availableCountries={availableCountries}
          availableCategories={availableCategories}
          defaultCurrency={defaultCurrency}
        />

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <ThemeCard key={i} accountLevel={accountLevel} className="h-64 animate-pulse" />
            ))}
          </div>
        ) : filteredReceipts.length === 0 ? (
          <ThemeCard accountLevel={accountLevel} className="p-8">
            <EmptyState
              title={t("insights.noMatch")}
              description={t("insights.noMatchDesc")}
              icon={TrendingUp}
            />
          </ThemeCard>
        ) : (
          <>
            <TruthMetricHero
              aggregate={aggregate}
              currency={defaultCurrency}
              timeRange={timeRangeLabel}
              accountLevel={accountLevel}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MoneyFlowBreakdown
                aggregate={aggregate}
                currency={defaultCurrency}
                accountLevel={accountLevel}
              />
              <WhatIfSimulator
                aggregate={aggregate}
                currency={defaultCurrency}
                accountLevel={accountLevel}
              />
            </div>

            <Suspense fallback={<ThemeCard accountLevel={accountLevel} className="h-48 animate-pulse" />}>
              <MerchantTables
                aggregate={aggregate}
                currency={defaultCurrency}
                accountLevel={accountLevel}
              />
            </Suspense>

            <Suspense fallback={<ThemeCard accountLevel={accountLevel} className="h-64 animate-pulse" />}>
            <SpendingPulse
              receipts={filteredReceipts}
              currency={defaultCurrency}
              filters={filters}
              accountLevel={accountLevel}
            />
            </Suspense>

            <Suspense fallback={<ThemeCard accountLevel={accountLevel} className="h-64 animate-pulse" />}>
            <BehaviorTrapDetector
              receipts={filteredReceipts}
              currency={defaultCurrency}
              accountLevel={accountLevel}
            />
            </Suspense>

            <Suspense fallback={<ThemeCard accountLevel={accountLevel} className="h-64 animate-pulse" />}>
              <TimePatterns aggregate={aggregate} currency={defaultCurrency} accountLevel={accountLevel} />
            </Suspense>
          </>
        )}
      </div>
    </AppShell>
  );
}
