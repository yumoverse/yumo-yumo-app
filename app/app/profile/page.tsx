"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { ThemeCard } from "@/components/app/theme-card";
import { YumoLogo } from "@/components/app/home/yumo-logo";
import { useTier, useTheme } from "@/lib/theme/theme-context";
import { useAppProfile } from "@/lib/app/profile-context";
import { useAppLocale } from "@/lib/i18n/app-context";
import { ACCOUNT_LEVEL_XP_THRESHOLDS } from "@/config/account-level-config";
import { ChevronRight, Lock, Check, Coins } from "lucide-react";
import { cn } from "@/lib/utils";

const MILESTONES = [
  { level: 40, title: "Ekonomi Dedektifi", desc: "Günlük limit +1", unlocked: true },
  { level: 45, title: "Veri Mimarı", desc: "Kategori slotu açılır", unlocked: false },
  { level: 50, title: "Piyasa Kâşifi", desc: "Özel rYUMO bonusu", unlocked: false },
];

export default function ProfilePage() {
  const { theme } = useTheme();
  const { t } = useAppLocale();
  const { profile: ctxProfile, loading, refresh } = useAppProfile();
  const [expanded, setExpanded] = useState(false);
  const isLight = theme === "light";

  // Ödül tutarlılığı: sayfa açıldığında profili yenile ki Token özeti ana sayfayla aynı ayumo/ryumo göstersin
  useEffect(() => {
    refresh();
  }, [refresh]);

  const profile = useMemo(() => {
    const p = ctxProfile;
    const lvl = p?.accountLevel ?? 1;
    const nextTh = ACCOUNT_LEVEL_XP_THRESHOLDS[lvl] ?? 20000;
    const prevTh = ACCOUNT_LEVEL_XP_THRESHOLDS[lvl - 1] ?? 0;
    return {
      accountLevel: lvl,
      accountXp: p?.accountXp ?? 0,
      accountXpNext: nextTh,
      accountXpPrev: prevTh,
      streak: p?.streak ?? 0,
      ayumo: p?.ayumo ?? 0,
      ryumo: p?.ryumo ?? 0,
      yumo: 0, // YUMO token şu an yok
      username: p?.username ?? "",
      displayName: p?.displayName ?? "",
      totalReceipts: 0,
    };
  }, [ctxProfile]);

  const tier = useTier(profile.accountLevel);
  const acc = tier.accent;
  const name = profile.displayName || profile.username || "Kullanıcı";
  const xpInLevel = profile.accountXp - profile.accountXpPrev;
  const xpNeeded = Math.max(1, profile.accountXpNext - profile.accountXpPrev);
  const acctPct = xpNeeded > 0 ? Math.min((xpInLevel / xpNeeded) * 100, 100) : 0;
  const nextMilestone = MILESTONES.find((m) => !m.unlocked);

  if (loading && !ctxProfile) {
    return (
      <AppShell>
        <div className="max-w-2xl mx-auto space-y-6 pb-24">
          <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
          <div className="h-24 animate-pulse rounded-xl bg-white/5" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto space-y-6 pb-24 lg:pb-8">
        {/* Hero: logo + name + title + GENESIS — light mode'da tema rengi */}
        <div
          className="relative overflow-hidden rounded-2xl border px-5 py-5"
          style={{
            background: isLight
              ? "var(--app-bg-elevated)"
              : "linear-gradient(135deg, #080f0a 0%, #08080f 100%)",
            borderColor: "var(--app-border)",
          }}
        >
          <div
            className="absolute -top-12 -right-12 h-40 w-40 rounded-full opacity-100"
            style={{ background: `radial-gradient(circle, ${tier.accent}15 0%, transparent 65%)` }}
          />
          <div className="relative flex items-center gap-4">
            <div
              className="flex h-[88px] w-[88px] flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border"
              style={{ borderColor: `${acc}33`, background: "var(--app-bg-base)" }}
            >
              <YumoLogo accountLevel={profile.accountLevel} size={88} className="p-2" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-extrabold tracking-tight" style={{ color: "var(--app-text-primary)" }}>{name}</h1>
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--app-text-muted)" }}>Ekonomi Dedektifi</p>
              <div
                className="mt-2 inline-flex items-center rounded px-2 py-0.5 text-[9px] font-bold tracking-wide"
                style={{ background: acc, color: "#000" }}
              >
                GENESIS
              </div>
            </div>
          </div>
          {/* 3-col stats */}
          <div
            className="relative mt-4 grid grid-cols-3 gap-0 border-t"
            style={{ borderColor: isLight ? "var(--app-border)" : "rgba(255,255,255,0.05)" }}
          >
            {[
              { l: "FİŞ", v: profile.totalReceipts, c: tier.accent },
              { l: "STREAK", v: `${profile.streak}g`, c: tier.accent2 },
              { l: "TRUST", v: "A Tier", c: "#00aaff" },
            ].map((s, i) => (
              <div
                key={s.l}
                className="py-3 text-center"
                style={{ borderLeft: i > 0 ? "1px solid var(--app-border)" : "none" }}
              >
                <span className="font-mono text-lg font-bold tabular-nums" style={{ color: s.c }}>
                  {typeof s.v === "number" ? s.v.toLocaleString("tr-TR") : s.v}
                </span>
                <div className="mt-1 text-[9px] font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-muted)" }}>
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Account level card */}
        <ThemeCard accountLevel={profile.accountLevel}>
          <div className="p-4">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <div
                  className="mb-1 text-[9px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--app-text-muted)" }}
                >
                  HESAP SEVİYESİ
                </div>
                <span
                  className="font-mono text-4xl font-bold tabular-nums"
                  style={{ color: acc }}
                >
                  {profile.accountLevel}
                </span>
              </div>
            </div>
            <div
              className="mb-2 h-1.5 overflow-hidden rounded-full"
              style={{ background: "var(--app-bg-elevated)" }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${acctPct}%`,
                  background: `linear-gradient(90deg, ${acc}99, ${acc})`,
                }}
              />
            </div>
            <div className="flex justify-between text-[9px] text-white/30">
              <span>Lv {profile.accountLevel}</span>
              <span>
                {(profile.accountXpNext - profile.accountXp).toLocaleString("tr-TR")} XP kaldı
              </span>
            </div>
            {nextMilestone && (
              <>
                <div className="my-3 h-px bg-white/5" />
                <div className="flex items-center gap-3">
                  <Lock className="h-3.5 w-3.5 text-white/25" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-white/90">{nextMilestone.title}</div>
                    <div className="text-[10px] text-white/30">{nextMilestone.desc}</div>
                  </div>
                  <span className="font-mono text-[11px] font-medium" style={{ color: acc }}>
                    Lv {nextMilestone.level}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="mt-3 flex items-center gap-1 text-[11px] text-white/25 hover:text-white/40"
                >
                  <ChevronRight
                    className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-90")}
                  />
                  {expanded ? "Gizle" : "Tüm milestone'lar"}
                </button>
                {expanded &&
                  MILESTONES.map((m) => (
                    <div
                      key={m.level}
                      className="flex items-center gap-3 border-t border-white/5 py-2.5"
                      style={{ opacity: m.unlocked ? 1 : 0.5 }}
                    >
                      {m.unlocked ? (
                        <Check className="h-3.5 w-3.5" style={{ color: acc }} />
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-white/20" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white/90">{m.title}</div>
                        <div className="text-[10px] text-white/30">{m.desc}</div>
                      </div>
                      <span
                        className="font-mono text-[10px]"
                        style={{ color: m.unlocked ? acc : "var(--app-text-muted)" }}
                      >
                        {m.unlocked ? "✓" : `Lv ${m.level}`}
                      </span>
                    </div>
                  ))}
              </>
            )}
          </div>
        </ThemeCard>

        {/* Token summary */}
        <ThemeCard accountLevel={profile.accountLevel}>
          <div className="px-4 pt-4">
            <div
              className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: `${acc}99` }}
            >
              {t("profile.tokenSummary")}
            </div>
          </div>
          {[
            { k: "aYUMO", v: profile.ayumo, sub: t("profile.fromReceipts"), c: acc },
            { k: "rYUMO", v: profile.ryumo, sub: t("profile.questRewards"), c: tier.accent2 },
            { k: "YUMO", v: profile.yumo, sub: t("profile.free"), c: "var(--app-text-secondary)" },
          ].map((row, i, arr) => (
            <div key={row.k}>
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: `${row.c}18`, border: `1px solid ${row.c}33` }}
                  >
                    <Coins className="h-4 w-4" style={{ color: row.c }} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white/95">{row.k}</div>
                    <div className="text-[10px] text-white/30">{row.sub}</div>
                  </div>
                </div>
                <span
                  className="font-mono text-base font-bold tabular-nums"
                  style={{ color: row.c }}
                >
                  {(typeof row.v === "number" ? row.v : Number(row.v) || 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
                </span>
              </div>
              {i < arr.length - 1 && <div className="mx-4 h-px bg-white/5" />}
            </div>
          ))}
        </ThemeCard>

        {/* Ayarlar (ayrı bölüm) */}
        <Link
          href="/app/settings"
          className="flex items-center justify-between rounded-xl border px-4 py-3 transition hover:bg-white/5"
          style={{ borderColor: tier.cardBorder, background: tier.cardBg }}
        >
          <span className="text-sm font-medium text-white/90">{t("nav.settings")}</span>
          <ChevronRight className="h-5 w-5 text-white/30" />
        </Link>
      </div>
    </AppShell>
  );
}
