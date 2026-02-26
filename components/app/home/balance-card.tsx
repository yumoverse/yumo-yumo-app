"use client";

import { ThemeCard } from "@/components/app/theme-card";
import { useTier } from "@/lib/theme/theme-context";
import { cn } from "@/lib/utils";

interface BalanceCardProps {
  ayumo?: number;
  /** Optional line under main balance e.g. "▲ +142 bu hafta" or "X gün streak" */
  subline?: string;
  accountLevel?: number;
  className?: string;
}

export function BalanceCard({
  ayumo = 0,
  subline,
  accountLevel = 1,
  className,
}: BalanceCardProps) {
  const tier = useTier(accountLevel);
  const value = Number.isFinite(ayumo) ? ayumo : 0;

  return (
    <ThemeCard
      accountLevel={accountLevel}
      className={cn("overflow-hidden", className)}
    >
      <div className="relative p-5">
        <div
          className="absolute -top-10 -right-10 h-36 w-36 rounded-full opacity-[0.06]"
          style={{ background: tier.accent }}
        />
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.15em]"
          style={{ color: tier.accent }}
        >
          aYUMO Bakiye
        </p>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span
            className="font-mono text-[32px] font-bold tabular-nums leading-none"
            style={{ color: tier.accent }}
          >
            {value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[14px] font-medium text-muted-foreground">
            aYUMO
          </span>
        </div>
        {subline != null && subline !== "" && (
          <p className="mt-2 flex items-center gap-1 text-xs text-emerald-500/90">
            ▲ {subline}
          </p>
        )}
      </div>
    </ThemeCard>
  );
}
