"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app/app-shell";
import { ErrorState } from "@/components/app/error-state";
import { useAppLocale } from "@/lib/i18n/app-context";
import { useAppProfile } from "@/lib/app/profile-context";
import { HeroTotal } from "@/components/app/home/hero-total";
import { QuickActions } from "@/components/app/home/quick-actions";
import { StreakRow } from "@/components/app/home/streak-row";
import { TokenCards } from "@/components/app/home/token-cards";
import { QuestsScreen } from "@/components/app/quests-screen";
import { ACCOUNT_LEVEL_XP_THRESHOLDS } from "@/config/account-level-config";
import { DASHBOARD_QUERY_KEY } from "@/lib/app/query-keys";

export default function HomePage() {
  const { t } = useAppLocale();
  const { profile: ctxProfile, loading, error: profileError, refresh } = useAppProfile();
  const queryClient = useQueryClient();
  const [questsRefreshKey, setQuestsRefreshKey] = useState(0);

  const profile = useMemo(() => {
    const p = ctxProfile;
    const lvl = p?.accountLevel ?? 1;
    const nextTh = ACCOUNT_LEVEL_XP_THRESHOLDS[lvl] ?? ACCOUNT_LEVEL_XP_THRESHOLDS[ACCOUNT_LEVEL_XP_THRESHOLDS.length - 1];
    const prevTh = ACCOUNT_LEVEL_XP_THRESHOLDS[lvl - 1] ?? 0;
    return {
      accountLevel: lvl,
      accountXp: p?.accountXp ?? 0,
      seasonLevel: p?.seasonLevel ?? 1,
      seasonXp: p?.seasonXp ?? 0,
      ayumo: p?.ayumo ?? 0,
      ryumo: p?.ryumo ?? 0,
      streak: p?.streak ?? 0,
      checkedInToday: p?.checkedInToday ?? false,
      username: p?.username ?? "",
      displayName: p?.displayName ?? "",
      accountXpNext: nextTh,
      accountXpPrev: prevTh,
    };
  }, [ctxProfile]);

  const error = profileError ? t("dashboard.error.load") : null;

  if (error) {
    return (
      <AppShell>
        <ErrorState message={error} onRetry={() => refresh().then(() => {})} />
      </AppShell>
    );
  }

  const handleCheckIn = async () => {
    const res = await fetch("/api/check-in", { method: "POST" });
    const data = await res.json();
    if (data.ok) {
      await refresh();
      // Dashboard harcama verisi artık React Query cache'de — invalidate et
      queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY("monthly") });
      setQuestsRefreshKey(k => k + 1);
    }
    return data;
  };

  if (loading && !ctxProfile) {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-12 text-white/50">{t("common.loading")}</div>
      </AppShell>
    );
  }

  const displayName = profile.displayName || profile.username;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto pb-28 lg:pb-8" style={{ display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Hero — isim + tier + aylık harcama */}
        <HeroTotal
          accountLevel={profile.accountLevel}
          displayName={displayName}
          refreshKey={questsRefreshKey}
        />

        {/* Hızlı işlemler — card yok, direkt arka plan */}
        <QuickActions />

        {/* Streak + Check-in — tek satır */}
        <StreakRow
          streak={profile.streak}
          checkedInToday={profile.checkedInToday}
          allowRecheckIn={ctxProfile?.isAdmin}
          onCheckIn={handleCheckIn}
        />

        {/* Token bakiyeleri — her biri ayrı card */}
        <TokenCards
          ayumo={profile.ayumo}
          ryumo={profile.ryumo}
          yumo={0}
        />

        {/* Görevler — preview (2 görev + tüm görevlere git) */}
        <QuestsScreen accountLevel={profile.accountLevel} refreshKey={questsRefreshKey} preview />

      </div>
    </AppShell>
  );
}
