"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReceiptText, CheckCircle2, ArrowUpDown, Clock, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Receipt } from "@/lib/mock/types";
import { useAppLocale } from "@/lib/i18n/app-context";
import { useAppProfile } from "@/lib/app/profile-context";

export default function RewardsPage() {
  const router = useRouter();
  const { t } = useAppLocale();
  const { profile, refresh: refreshProfile } = useAppProfile();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Fetch only user's receipts from API (no mock data)
      const receiptsResponse = await fetch("/api/receipts");
      let receiptsData: Receipt[] = [];
      if (receiptsResponse.ok) {
        const data = await receiptsResponse.json();
        // Convert ReceiptAnalysis[] to Receipt[]
        const { convertReceiptAnalysisToReceipt } = await import("@/lib/receipt/receipt-converter");
        receiptsData = (data.receipts || []).map((analysis: any) => {
          try {
            return convertReceiptAnalysisToReceipt(analysis);
          } catch (err) {
            console.error("Failed to convert receipt:", analysis.receiptId, err);
            return null;
          }
        }).filter((r: Receipt | null): r is Receipt => r !== null);
      }
      
      setReceipts(receiptsData);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // aYUMO: profil API'deki tek kaynak (SUM(hidden_cost_core)) — Rewards, ana sayfa ve profil kartı aynı değeri gösterir
  const aYUMOBalance = Number(profile?.ayumo ?? 0) || 0;
  const rYUMOBalance = Number(profile?.ryumo ?? 0) || 0;
  
  // Generate activity log from receipts
  type ActivityLogItem = {
    id: string;
    type: "RECEIPT_VERIFIED" | "TASK_COMPLETED" | "ADJUSTMENT" | "CLAIM";
    description: string;
    amount: number;
    currency: "aYUMO" | "rYUMO";
    status: "COMPLETED" | "PENDING";
    date: string;
  };
  
  const activities: ActivityLogItem[] = receipts
    .filter(r => r.status === "VERIFIED" || r.status === "analyzed")
    .map((r) => ({
      id: r.id,
      type: "RECEIPT_VERIFIED" as const,
      description: t("rewards.receiptFrom", { merchant: r.merchantName }),
      amount: r.reward.ryumo != null && r.reward.ryumo > 0
        ? r.reward.ryumo
        : (r.reward.amount || r.hiddenCost?.totalHidden || 0),
      currency: (r.reward.ryumo != null && r.reward.ryumo > 0 ? "rYUMO" : "aYUMO") as "aYUMO" | "rYUMO",
      status: "COMPLETED" as const,
      date: r.createdAt || r.date,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 50);

  const getActivityIcon = (type: "RECEIPT_VERIFIED" | "TASK_COMPLETED" | "ADJUSTMENT" | "CLAIM") => {
    switch (type) {
      case "RECEIPT_VERIFIED":
        return ReceiptText;
      case "TASK_COMPLETED":
        return CheckCircle2;
      case "ADJUSTMENT":
        return ArrowUpDown;
      case "CLAIM":
        return ArrowUpDown;
      default:
        return Clock;
    }
  };

  const getActivityLabel = (type: "RECEIPT_VERIFIED" | "TASK_COMPLETED" | "ADJUSTMENT" | "CLAIM") => {
    switch (type) {
      case "RECEIPT_VERIFIED":
        return t("rewards.receiptVerified");
      case "TASK_COMPLETED":
        return t("rewards.taskCompleted");
      case "ADJUSTMENT":
        return t("rewards.adjustment");
      case "CLAIM":
        return t("rewards.claim");
      default:
        return "Activity";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).replace(/\//g, '.');
  };

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">{t("rewards.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("rewards.description")}
          </p>
        </div>

        {/* Balances */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* aYUMO Balance */}
          <Card className="card-cinematic card-secondary border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t("rewards.aYUMO")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-2xl sm:text-3xl font-bold tabular-nums text-primary">
                    {aYUMOBalance.toFixed(2)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="opacity-50 cursor-not-allowed flex-shrink-0"
                  >
                    <Download className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">{t("rewards.claim")}</span>
                  </Button>
                </div>
                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  <p className="text-xs font-medium text-foreground">{t("rewards.awarenessToken")}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("rewards.awarenessDesc")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* rYUMO Balance */}
          <Card className="card-cinematic card-secondary border-emerald-500/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t("rewards.rYUMO")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-2xl sm:text-3xl font-bold tabular-nums text-emerald-400/70">
                    {rYUMOBalance.toFixed(2)}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="opacity-50 cursor-not-allowed flex-shrink-0"
                  >
                    <Download className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">{t("rewards.claim")}</span>
                  </Button>
                </div>
                <div className="space-y-1.5 pt-2 border-t border-border/50">
                  <p className="text-xs font-medium text-foreground">{t("rewards.rewardToken")}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("rewards.rewardDesc")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Log */}
        <Card className="card-cinematic card-secondary">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">{t("rewards.activity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {t("rewards.noActivity")}
              </div>
            ) : (
              <div className="space-y-0 divide-y divide-border/50">
                {activities.map((activity) => {
                  const Icon = getActivityIcon(activity.type);
                  const isPositive = activity.amount > 0;
                  
                  return (
                    <div
                      key={activity.id}
                      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 w-full sm:w-auto">
                        <div className={cn(
                          "p-1.5 sm:p-2 rounded-md flex-shrink-0",
                          activity.type === "RECEIPT_VERIFIED" && "bg-primary/10",
                          activity.type === "TASK_COMPLETED" && "bg-green-500/10",
                          activity.type === "ADJUSTMENT" && "bg-blue-500/10",
                          activity.type === "CLAIM" && "bg-orange-500/10",
                        )}>
                          <Icon className={cn(
                            "h-3.5 w-3.5 sm:h-4 sm:w-4",
                            activity.type === "RECEIPT_VERIFIED" && "text-primary",
                            activity.type === "TASK_COMPLETED" && "text-green-500",
                            activity.type === "ADJUSTMENT" && "text-blue-500",
                            activity.type === "CLAIM" && "text-orange-500",
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs sm:text-sm font-medium truncate">
                            {activity.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-1 sm:gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {getActivityLabel(activity.type)}
                            </span>
                            <span className="text-xs text-muted-foreground hidden sm:inline">•</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(activity.date)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-left sm:text-right flex-shrink-0 ml-0 sm:ml-4 w-full sm:w-auto">
                        <div className={cn(
                          "text-xs sm:text-sm font-semibold tabular-nums",
                          activity.currency === "aYUMO" && isPositive && "text-primary",
                          activity.currency === "rYUMO" && isPositive && "text-emerald-400",
                          !isPositive && "text-muted-foreground"
                        )}>
                          {isPositive ? "+" : ""}{activity.amount.toFixed(2)} {activity.currency}
                        </div>
                        <div className={cn(
                          "text-xs mt-0.5",
                          activity.status === "COMPLETED" ? "text-muted-foreground" : "text-orange-500"
                        )}>
                          {activity.status === "COMPLETED" ? t("rewards.completed") : t("rewards.pending")}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
