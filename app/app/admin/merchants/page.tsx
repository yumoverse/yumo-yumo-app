"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { DataTable } from "@/components/app/data-table";
import { EmptyState } from "@/components/app/empty-state";
import { ErrorState } from "@/components/app/error-state";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, Store, XCircle } from "lucide-react";
import { useAppLocale } from "@/lib/i18n/app-context";
import { useAppProfile } from "@/lib/app/profile-context";


type MerchantTier = "unverified" | "candidate" | "verified";

interface Merchant {
  id: string;
  canonicalName: string;
  displayName: string;
  category: string;
  tier: MerchantTier;
  countryCode: string | null;
  createdAt: string;
  patternCount: number;
}

const TIER_OPTIONS: { value: "" | MerchantTier; labelKey: string }[] = [
  { value: "", labelKey: "admin.merchants.filterAll" },
  { value: "unverified", labelKey: "admin.merchants.filterUnverified" },
  { value: "candidate", labelKey: "admin.merchants.filterCandidate" },
  { value: "verified", labelKey: "admin.merchants.filterVerified" },
];

export default function AdminMerchantsPage() {
  const router = useRouter();
  const { t } = useAppLocale();
  const { profile } = useAppProfile();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [tierFilter, setTierFilter] = useState<"" | MerchantTier>("unverified");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  useEffect(() => {
    const userIsAdmin = !!profile?.isAdmin;
    setIsAdmin(userIsAdmin);
    if (!userIsAdmin) {
      setError(t("admin.merchants.error.unauthorized"));
      setIsLoading(false);
      return;
    }
    loadMerchants();
  }, [tierFilter, profile?.isAdmin]);

  const loadMerchants = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const url = tierFilter
        ? `/api/admin/merchants?tier=${tierFilter}`
        : "/api/admin/merchants";
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 403) throw new Error(t("admin.merchants.error.forbidden"));
        throw new Error(t("admin.merchants.error.load"));
      }
      const data = await res.json();
      setMerchants(data.merchants ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("admin.merchants.error.load"));
      setMerchants([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (m: Merchant, asVerified: boolean) => {
    const tier = asVerified ? "verified" : "candidate";
    if (!confirm(t("admin.merchants.approveConfirm", { name: m.displayName, tier: t(`admin.merchants.tier.${tier}`) }))) return;
    try {
      setApprovingId(m.id);
      const res = await fetch("/api/admin/approve-merchant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId: m.id, tier }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = [data.error, data.detail].filter(Boolean).join(" — ") || t("admin.merchants.error.approve");
        throw new Error(msg);
      }
      setMerchants((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t("admin.merchants.error.approve"));
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (m: Merchant) => {
    if (!confirm(t("admin.merchants.rejectConfirm", { name: m.displayName }))) return;
    try {
      setRejectingId(m.id);
      const res = await fetch("/api/admin/reject-merchant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ merchantId: m.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = [data.error, data.detail].filter(Boolean).join(" — ") || t("admin.merchants.error.reject");
        throw new Error(msg);
      }
      setMerchants((prev) => prev.filter((x) => x.id !== m.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : t("admin.merchants.error.reject"));
    } finally {
      setRejectingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <AppShell>
        <ErrorState
          message={t("admin.merchants.error.unauthorized")}
          onRetry={() => router.push("/app/dashboard")}
        />
      </AppShell>
    );
  }

  if (error && !isLoading) {
    return (
      <AppShell>
        <ErrorState message={error} onRetry={loadMerchants} />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t("admin.merchants.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("admin.merchants.description")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter((e.target.value || "") as "" | MerchantTier)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {TIER_OPTIONS.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
            <Button variant="outline" size="sm" onClick={loadMerchants} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.merchants.refresh")}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <DataTable
            columns={[]}
            data={[]}
            isLoading
            emptyMessage={t("admin.merchants.loading")}
          />
        ) : merchants.length === 0 ? (
          <EmptyState
            icon={Store}
            title={t("admin.merchants.noMerchants")}
            description={t("admin.merchants.noMerchantsDesc")}
          />
        ) : (
          <DataTable
            columns={[
              {
                key: "displayName",
                header: t("admin.merchants.displayName"),
                render: (r) => <span className="font-medium">{r.displayName}</span>,
              },
              {
                key: "canonicalName",
                header: t("admin.merchants.canonicalName"),
                render: (r) => <span className="text-sm text-muted-foreground truncate max-w-[200px]">{r.canonicalName}</span>,
              },
              {
                key: "category",
                header: t("admin.merchants.category"),
                render: (r) => <span className="text-sm">{r.category}</span>,
              },
              {
                key: "tier",
                header: t("admin.merchants.tierLabel"),
                render: (r) => (
                  <span className="text-sm capitalize">{t(`admin.merchants.tier.${r.tier}`)}</span>
                ),
              },
              {
                key: "patternCount",
                header: t("admin.merchants.patternCount"),
                render: (r) => <span className="text-sm">{r.patternCount}</span>,
              },
              {
                key: "actions",
                header: t("admin.merchants.actions"),
                render: (r) => {
                  const isUnverified = r.tier === "unverified" || !r.tier;
                  const busy = approvingId === r.id || rejectingId === r.id;
                  return (
                    <div className="flex flex-wrap items-center gap-1">
                      {isUnverified && (
                        <>
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 gap-1 bg-green-600 hover:bg-green-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(r, false);
                            }}
                            disabled={busy}
                            title={t("admin.merchants.tooltip.candidate")}
                          >
                            {approvingId === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            {t("admin.merchants.acceptCandidate")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApprove(r, true);
                            }}
                            disabled={busy}
                            title={t("admin.merchants.tooltip.verified")}
                          >
                            {t("admin.merchants.acceptVerified")}
                          </Button>
                        </>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 border-red-500/50 text-red-600 hover:bg-red-500/10 hover:text-red-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReject(r);
                        }}
                        disabled={busy}
                        title={t("admin.merchants.tooltip.reject")}
                      >
                        {rejectingId === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        {t("admin.merchants.reject")}
                      </Button>
                    </div>
                  );
                },
              },
            ]}
            data={merchants}
            emptyMessage={t("admin.merchants.noMerchants")}
          />
        )}
      </div>
    </AppShell>
  );
}
