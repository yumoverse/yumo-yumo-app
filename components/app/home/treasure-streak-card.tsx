"use client";

import { useState, useEffect } from "react";
import { Flame, CheckCircle2 } from "lucide-react";
import { ThemeCard } from "@/components/app/theme-card";
import { Button } from "@/components/ui/button";
import { useTier } from "@/lib/theme/theme-context";
import { useAppLocale } from "@/lib/i18n/app-context";
import { cn } from "@/lib/utils";

interface TreasureStreakCardProps {
  streak?: number;
  ayumo?: number;
  checkedInToday?: boolean;
  /** Admin için bugün tekrar check-in yapılabilir */
  allowRecheckIn?: boolean;
  onCheckIn?: () => Promise<{ ok: boolean; streak: number; alreadyCheckedIn?: boolean }>;
  accountLevel?: number;
  className?: string;
}

export function TreasureStreakCard({
  streak = 0,
  ayumo = 0,
  checkedInToday = false,
  allowRecheckIn = false,
  onCheckIn,
  accountLevel = 1,
  className,
}: TreasureStreakCardProps) {
  const { t } = useAppLocale();
  const [loading, setLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(checkedInToday);
  const tier = useTier(accountLevel);

  useEffect(() => {
    if (checkedInToday) setCheckedIn(true);
  }, [checkedInToday]);

  const handleCheckIn = async () => {
    if (!onCheckIn || loading || (checkedIn && !allowRecheckIn)) return;
    setLoading(true);
    try {
      const res = await onCheckIn();
      if (res.ok) setCheckedIn(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemeCard accountLevel={accountLevel} className={cn("space-y-3 p-4 sm:p-5", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, var(--app-gold-glow, rgba(201,168,76,0.15)), transparent)`,
              border: `1px solid var(--app-gold-border, rgba(201,168,76,0.18))`,
            }}
          >
            🔥
          </div>
          <div>
            <p className="text-[13px] font-semibold" style={{ color: "var(--app-text-primary)" }}>{t("quests.streak")}</p>
            <p className="text-[11px]" style={{ color: "var(--app-text-muted)" }}>{t("home.treasure")}</p>
          </div>
        </div>
        <span className="font-mono text-[22px] font-bold tabular-nums" style={{ color: tier.accent }}>
          {streak}
        </span>
      </div>

      {/* Gold divider */}
      <div
        className="h-px"
        style={{
          background: `linear-gradient(90deg, transparent, var(--app-gold-border, rgba(201,168,76,0.18)), transparent)`,
        }}
      />

      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: "var(--app-text-muted)" }}
        >
          aYUMO bakiyesi
        </span>
        <span
          className="font-mono text-[15px] font-bold tabular-nums"
          style={{ color: "var(--app-gold-light, #E8C97A)" }}
        >
          {ayumo.toFixed(2)}
        </span>
      </div>

      <Button
        onClick={handleCheckIn}
        disabled={loading || (checkedIn && !allowRecheckIn)}
        className="w-full gap-2 border-0 font-semibold text-black focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        size="sm"
        style={
          checkedIn
            ? { background: `${tier.accent}30`, color: tier.accent, border: `1px solid ${tier.accent}50` }
            : { background: tier.accent, color: "#0a0a0a" }
        }
      >
        {checkedIn ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            {t("home.checkedIn")}
          </>
        ) : (
          <>
            <Flame className="h-4 w-4" />
            {loading ? t("common.loading") : t("home.checkIn")}
          </>
        )}
      </Button>
    </ThemeCard>
  );
}
