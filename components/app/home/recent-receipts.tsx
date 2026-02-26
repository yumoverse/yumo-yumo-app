"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ThemeCard } from "@/components/app/theme-card";
import { useAppLocale } from "@/lib/i18n/app-context";
import { ReceiptText, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReceiptItem {
  receiptId: string;
  totalPaid?: number;
  hiddenCost?: { totalHidden?: number };
  merchantName?: string;
  createdAt?: string;
  currency?: string;
  status?: string;
}

interface RecentReceiptsProps {
  accountLevel?: number;
  limit?: number;
  className?: string;
}

export function RecentReceipts({ accountLevel = 1, limit = 5, className }: RecentReceiptsProps) {
  const { t } = useAppLocale();
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/receipts/dashboard?period=weekly")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(async (data) => {
        const { convertReceiptAnalysisToReceipt } = await import("@/lib/receipt/receipt-converter");
        const list = (data.receipts || [])
          .slice(0, limit)
          .map((a: any) => {
            try {
              const r = convertReceiptAnalysisToReceipt(a);
              return {
                receiptId: r.id ?? a.receipt_id,
                totalPaid: r.totalPaid ?? r.total,
                hiddenCost: r.hiddenCost,
                merchantName: r.merchantName ?? a.merchant_name,
                createdAt: r.createdAt ?? a.created_at,
                currency: r.currency ?? "TRY",
                status: r.status,
              };
            } catch {
              return {
                receiptId: a.receipt_id ?? a.receiptId,
                totalPaid: a.pricing?.total_paid ?? a.pricing?.totalPaid,
                hiddenCost: a.hidden_cost ? { totalHidden: a.hidden_cost?.hidden_cost_core ?? a.hidden_cost?.totalHidden } : undefined,
                merchantName: a.merchant?.name ?? a.merchant_name,
                createdAt: a.created_at,
                currency: a.pricing?.currency ?? "TRY",
              };
            }
          });
        setReceipts(list);
      })
      .catch(() => setReceipts([]))
      .finally(() => setLoading(false));
  }, [limit]);

  if (loading) {
    return (
      <ThemeCard accountLevel={accountLevel} className={cn("animate-pulse", className)}>
        <div className="p-4 h-24 rounded bg-muted/50" />
      </ThemeCard>
    );
  }

  if (receipts.length === 0) {
    return (
      <ThemeCard accountLevel={accountLevel} className={className}>
        <div className="p-4 flex flex-col items-center justify-center py-6 gap-2">
          <ReceiptText className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("home.receiptsEmpty")}</p>
          <Link
            href="/app/mine"
            className="text-sm font-medium text-primary hover:underline"
          >
            {t("home.addWithScan")}
          </Link>
        </div>
      </ThemeCard>
    );
  }

  return (
    <ThemeCard accountLevel={accountLevel} className={className}>
      <div className="p-4 flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{t("home.recentReceipts")}</h3>
        <Link
          href="/app/receipts"
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-0.5"
        >
          {t("home.viewAll")}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <ul className="space-y-2 px-4 pb-4">
        {receipts.map((r) => (
          <li key={r.receiptId}>
            <Link
              href={`/app/receipts/${r.receiptId}`}
              className="flex items-center justify-between py-2 border-b border-border/50 last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.merchantName ?? "Fiş"}</p>
                <p className="text-xs text-muted-foreground">
                  {r.totalPaid != null ? `${r.totalPaid.toFixed(0)} ${r.currency ?? "TRY"}` : ""}
                  {r.hiddenCost?.totalHidden != null && (
                    <span className="ml-1 text-primary">+{r.hiddenCost.totalHidden.toFixed(0)} gizli</span>
                  )}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </ThemeCard>
  );
}
