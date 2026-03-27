"use client";

import { useRef, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DASHBOARD_QUERY_KEY } from "@/lib/app/query-keys";
import { useTier } from "@/lib/theme/theme-context";
import { useAppLocale } from "@/lib/i18n/app-context";
import Link from "next/link";

interface HeroTotalProps {
  receiptCount?: number;
  accountLevel?: number;
  displayName?: string;
  /** Yeniden veri çekmek için artırılan anahtar */
  refreshKey?: number;
}

interface DashboardData {
  receipts: Array<{
    pricing?: { totalPaid?: number; symbol?: string; currency?: string };
    hiddenCost?: { hiddenCostCore?: number; hiddenTotal?: number };
  }>;
  totalReceiptCount: number;
}

/** Rakamı ease-out cubic ile animate eder */
function useCounter(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  const t0Ref = useRef<number | null>(null);

  useEffect(() => {
    t0Ref.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const step = (ts: number) => {
      if (!t0Ref.current) t0Ref.current = ts;
      const progress = Math.min((ts - t0Ref.current) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return value;
}

function AnimatedAmount({ amount, symbol = "₺" }: { amount: number; symbol?: string }) {
  const v = useCounter(amount, 1000);
  return (
    <span>
      {symbol}
      {v.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

async function fetchDashboard(period: string): Promise<DashboardData> {
  const res = await fetch(`/api/receipts/dashboard?period=${period}`);
  if (!res.ok) throw new Error("Dashboard fetch failed");
  return res.json();
}

export function HeroTotal({
  receiptCount = 0,
  accountLevel = 1,
  displayName,
  refreshKey = 0,
}: HeroTotalProps) {
  const tier = useTier(accountLevel);
  const { t } = useAppLocale();

  const { data, isLoading: loading } = useQuery({
    queryKey: DASHBOARD_QUERY_KEY("monthly"),
    queryFn: () => fetchDashboard("monthly"),
    staleTime: 120_000,          // 2 dakika taze — tab geçişinde anında göster
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev, // sayfa değişirken eski veriyi tut
  });

  const totalCount = data?.totalReceiptCount ?? receiptCount;
  const monthlyReceipts = data?.receipts ?? [];

  // Aylık toplam harcama
  const monthlySpending = monthlyReceipts.reduce((sum, r) => {
    return sum + (r.pricing?.totalPaid ?? 0);
  }, 0);

  // Gizli maliyet toplamı
  const monthlyHidden = monthlyReceipts.reduce((sum, r) => {
    return sum + (r.hiddenCost?.hiddenTotal ?? r.hiddenCost?.hiddenCostCore ?? 0);
  }, 0);

  const hiddenPct = monthlySpending > 0 ? Math.round((monthlyHidden / monthlySpending) * 100) : 0;
  const currency = monthlyReceipts[0]?.pricing?.symbol ?? "₺";

  // Ayın adı
  const now = new Date();
  const monthLabel = now
    .toLocaleString("tr-TR", { month: "long" })
    .toUpperCase();
  const yearLabel = now.getFullYear();

  // Skeleton yüklenirken
  if (loading) {
    return (
      <div className="px-4 pt-7 pb-5 text-center">
        <div
          className="mx-auto h-3 w-28 rounded-full animate-pulse mb-4"
          style={{ background: "var(--app-bg-surface)" }}
        />
        <div
          className="mx-auto h-12 w-52 rounded-xl animate-pulse"
          style={{ background: "var(--app-bg-surface)" }}
        />
      </div>
    );
  }

  // ── State 0: Hiç fiş yok
  if (totalCount === 0) {
    const name = displayName?.split(" ")[0] ?? t("common.user");
    return (
      <div className="px-4 pt-7 pb-5 text-center">
        <p
          className="text-[22px] font-bold leading-snug tracking-[-0.01em]"
          style={{ color: "var(--app-text-primary)" }}
        >
          {name}, ilk fişini tara.
        </p>
        <p
          className="mt-2.5 text-[14px] leading-relaxed"
          style={{ color: "var(--app-text-muted)" }}
        >
          Ekonomik kimliğin başlasın.
        </p>
        <Link
          href="/app/mine"
          className="inline-flex items-center gap-2 mt-5 px-6 py-3 rounded-xl font-bold text-sm transition-transform active:scale-95"
          style={{
            background: `linear-gradient(135deg, ${tier.accent}, ${tier.accent}99)`,
            color: "#0a0a0a",
            boxShadow: `0 4px 20px ${tier.outerGlow}`,
          }}
        >
          İlk Fişi Tara →
        </Link>
      </div>
    );
  }

  // ── State 1+: Harcama verisi var
  const insightColor =
    hiddenPct >= 60
      ? { dot: "#F87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.20)", text: "#FCA5A5" }
      : hiddenPct >= 25
      ? { dot: "#FBBF24", bg: "rgba(251,191,36,0.08)", border: "rgba(251,191,36,0.20)", text: "#FDE68A" }
      : { dot: "#34D399", bg: "rgba(52,211,153,0.08)", border: "rgba(52,211,153,0.20)", text: "#6EE7B7" };

  const subLine =
    totalCount > 5
      ? "Türkiye ortalamasının %12 üzerinde"
      : `${monthlyReceipts.length} fiş bu ay analiz edildi`;

  return (
    <div className="pt-6 pb-4 text-center">
      {/* İsim + tier badge — ortalı */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--app-text-secondary)" }}>
          {displayName ?? t("common.user")}
        </span>
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.12em",
          color: "var(--app-gold)", padding: "2px 8px", borderRadius: 999,
          background: "var(--app-gold-glow)", border: "1px solid var(--app-gold-border)",
        }}>
          Seed
        </span>
      </div>

      {/* Zaman etiketi */}
      <p style={{
        fontSize: 10, fontWeight: 700, letterSpacing: "0.16em",
        color: "var(--app-text-muted)", marginBottom: 8,
        textTransform: "uppercase",
      }}>
        {monthLabel} {yearLabel} · Toplam Harcama
      </p>

      {/* Ana rakam */}
      <p
        className="font-mono font-extrabold leading-none tracking-[-0.02em]"
        style={{
          fontSize: 40,
          color: "var(--app-gold-light)",
          textShadow: "0 0 60px rgba(201,168,76,0.25)",
        }}
      >
        <AnimatedAmount amount={monthlySpending} symbol={currency} />
      </p>

      {/* Insight bandı */}
      {monthlySpending > 0 && (
        <div className="flex justify-center mt-3">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full"
            style={{ background: insightColor.bg, border: `1px solid ${insightColor.border}` }}
          >
            <span
              className="inline-block rounded-full flex-shrink-0"
              style={{ width: 5, height: 5, background: insightColor.dot }}
            />
            <span className="text-[12px] font-semibold" style={{ color: insightColor.text }}>
              %{hiddenPct}&apos;i gizli maliyet
            </span>
          </div>
        </div>
      )}

      {/* Alt satır */}
      <p className="mt-2 text-[11px]" style={{ color: "var(--app-text-muted)" }}>
        {subLine}
      </p>
    </div>
  );
}
