"use client";

import { ThemeCard } from "@/components/app/theme-card";
import { useTier } from "@/lib/theme/theme-context";
import { cn } from "@/lib/utils";

interface TokenStripProps {
  ayumo?: number;
  ryumo?: number;
  yumo?: number;
  accountLevel?: number;
  className?: string;
}

function asNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Büyük rakamları kısaltır:
 *  >= 1 000 000  →  "1.2M"
 *  >= 10 000     →  "655K"
 *  >= 1 000      →  "6 339"  (tam sayı, virgülsüz)
 *  < 1 000       →  "0.00"   (2 ondalık)
 */
function fmtToken(value: number): string {
  if (value >= 1_000_000) return `${Math.floor(value / 1_000_000)}M`;
  if (value >= 10_000)    return `${Math.floor(value / 1_000)}K`;
  if (value >= 1_000)     return Math.round(value).toLocaleString("tr-TR");
  return value.toFixed(2);
}

export function TokenStrip({
  ayumo = 0,
  ryumo = 0,
  yumo = 0,
  accountLevel = 1,
  className,
}: TokenStripProps) {
  const tier = useTier(accountLevel);
  const a = asNumber(ayumo);
  const r = asNumber(ryumo);
  const y = asNumber(yumo);
  const total = a + r + y;

  const tokens = [
    { label: "aYUMO", value: a, color: tier.accent,           desc: "Fiş kazancı" },
    { label: "rYUMO", value: r, color: tier.accent2,          desc: "Quest ödülü" },
    { label: "YUMO",  value: y, color: "var(--app-text-muted)", desc: "Blockchain" },
  ];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Mobilde toplam ödül büyük ve ön planda */}
      <div className="text-center py-2 sm:py-0 sm:hidden">
        <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-muted)" }}>
          Toplam ödül
        </p>
        <p className="font-mono text-2xl font-bold tabular-nums mt-0.5" style={{ color: tier.accent }}>
          {fmtToken(total)}
        </p>
      </div>
      <div className={cn("flex gap-2")}>
        {tokens.map((tok) => (
          <ThemeCard key={tok.label} accountLevel={accountLevel} className="flex-1">
            <div className="text-center py-3 sm:py-4 px-2 sm:px-3">
              <p
                className="font-mono text-[15px] sm:text-[17px] tabular-nums font-bold"
                style={{ color: tok.value === 0 && tok.label === "YUMO" ? "var(--app-text-muted)" : tok.color }}
              >
                {fmtToken(tok.value)}
              </p>
              <p
                className="text-[7px] font-semibold uppercase tracking-[0.13em] mt-0.5"
                style={{ color: `${tok.color}99` }}
              >
                {tok.label}
              </p>
              <p className="text-[8px] mt-0.5" style={{ color: "var(--app-text-muted)" }}>
                {tok.desc}
              </p>
            </div>
          </ThemeCard>
        ))}
      </div>
    </div>
  );
}
