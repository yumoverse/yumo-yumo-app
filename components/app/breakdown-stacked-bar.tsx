"use client";

import { useMemo } from "react";
import { useTier } from "@/lib/theme/theme-context";
import { ThemeCard } from "@/components/app/theme-card";
import { useAppLocale } from "@/lib/i18n/app-context";
import type { HiddenCost } from "@/lib/mock/types";
import { cn } from "@/lib/utils";

/** Pie ile aynı tonlar — tutarlı görünüm */
const STACK_COLORS = {
  productValue: "#22c55e",
  importSystem: "#0ea5e9",
  retailBrand: "#f59e0b",
  state: "#8b5cf6",
};

interface BreakdownStackedBarProps {
  hiddenCost: HiddenCost;
  currency: string;
  accountLevel?: number;
  className?: string;
}

interface CostRow {
  key: string;
  labelKey: string;
  descKey: string;
  value: number;
  color: string;
}

export function BreakdownStackedBar({
  hiddenCost,
  currency,
  accountLevel = 1,
  className,
}: BreakdownStackedBarProps) {
  const tier = useTier(accountLevel);
  const acc = tier.accent;
  const { t } = useAppLocale();

  const rows = useMemo((): CostRow[] => {
    const items: CostRow[] = [
      { key: "productValue", labelKey: "breakdown.productValue", descKey: "breakdown.productValueDesc", value: hiddenCost.productValue, color: STACK_COLORS.productValue },
      { key: "importSystem", labelKey: "breakdown.importSystem", descKey: "breakdown.importSystemDesc", value: hiddenCost.importSystem, color: STACK_COLORS.importSystem },
      { key: "retailBrand", labelKey: "breakdown.retailBrand", descKey: "breakdown.retailBrandDesc", value: hiddenCost.retailBrand, color: STACK_COLORS.retailBrand },
      { key: "state", labelKey: "breakdown.stateLayer", descKey: "breakdown.stateLayerDesc", value: hiddenCost.state, color: STACK_COLORS.state },
    ];
    return items.filter((r) => r.value > 0);
  }, [hiddenCost]);

  const total = hiddenCost.productValue + hiddenCost.importSystem + hiddenCost.retailBrand + (hiddenCost.state || 0);
  const maxVal = Math.max(...rows.map((r) => r.value), 1);

  return (
    <ThemeCard accountLevel={accountLevel} className={cn("p-4", className)}>
      <h3 className="text-base font-semibold mb-1" style={{ color: "var(--app-text-primary)" }}>
        {t("breakdown.distributionTitle")}
      </h3>
      <p className="text-sm mb-4" style={{ color: "var(--app-text-muted)" }}>
        {t("breakdown.distributionSubtitle")}
      </p>
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.key}
            className="rounded-xl p-3 overflow-hidden"
            style={{
              background: "var(--app-bg-elevated)",
              border: "1px solid var(--app-border)",
            }}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: row.color }}
                />
                <div>
                  <p className="font-medium text-sm" style={{ color: "var(--app-text-primary)" }}>
                    {t(row.labelKey)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--app-text-muted)" }}>
                    {t(row.descKey)}
                  </p>
                </div>
              </div>
              <p className="font-mono font-semibold tabular-nums flex-shrink-0" style={{ color: row.color }}>
                {row.value.toFixed(2)} {currency}
              </p>
            </div>
            <div
              className="h-2 rounded-full overflow-hidden"
              style={{ background: "var(--app-bg)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(row.value / maxVal) * 100}%`,
                  backgroundColor: row.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div
        className="flex items-center justify-between pt-4 mt-4 border-t"
        style={{ borderColor: "var(--app-border)" }}
      >
        <span className="text-sm font-medium" style={{ color: "var(--app-text-primary)" }}>
          {t("breakdown.total")}
        </span>
        <span className="text-lg font-bold tabular-nums" style={{ color: acc }}>
          {total.toFixed(2)} {currency}
        </span>
      </div>
    </ThemeCard>
  );
}
