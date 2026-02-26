"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app/app-shell";
import { MOD, SIDEBAR_MODS } from "@/lib/theme/modules";
import { useTier } from "@/lib/theme/theme-context";
import { useAppProfile } from "@/lib/app/profile-context";
import { useAppLocale } from "@/lib/i18n/app-context";
import { useIsDesktop } from "@/lib/hooks/use-is-desktop";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { Coins, CheckSquare, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function ModuleIcon({ name, size = 20, color }: { name: string; size?: number; color: string }) {
  const s = { width: size, height: size, display: "block" as const, flexShrink: 0 };
  const p = { fill: "none" as const, stroke: color, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "economy":
    case "insights":
      return <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline {...p} points="17 6 23 6 23 12" /></svg>;
    case "guild":
      return <svg style={s} viewBox="0 0 24 24"><circle {...p} cx="12" cy="8" r="3" /><circle {...p} cx="5" cy="16" r="3" /><circle {...p} cx="19" cy="16" r="3" /><path {...p} d="M12 11v2M7.5 15l2.5-2M16.5 15l-2.5-2" /></svg>;
    case "games":
      return <svg style={s} viewBox="0 0 24 24"><rect {...p} x="2" y="6" width="20" height="12" rx="3" /><line {...p} x1="8" y1="12" x2="12" y2="12" /><line {...p} x1="10" y1="10" x2="10" y2="14" /><circle cx="16" cy="11" r="1" fill={color} stroke="none" /><circle cx="18" cy="13" r="1" fill={color} stroke="none" /></svg>;
    case "ai":
      return <svg style={s} viewBox="0 0 24 24"><path {...p} d="M12 2a9 9 0 100 18A9 9 0 0012 2z" /><path {...p} d="M8 12h8M12 8v8" /><circle cx="12" cy="12" r="2" fill={color} stroke="none" /></svg>;
    case "market":
      return <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="2 12 6 7 10 14 14 5 18 10 22 6" /></svg>;
    case "social":
      return <svg style={s} viewBox="0 0 24 24"><path {...p} d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" /></svg>;
    case "basket":
      return <svg style={s} viewBox="0 0 24 24"><path {...p} d="M6 2l3 6h6l3-6" /><path {...p} d="M3 8h18l-1.5 10H4.5L3 8z" /><circle cx="10" cy="14" r="1" fill={color} stroke="none" /><circle cx="14" cy="14" r="1" fill={color} stroke="none" /></svg>;
    default:
      return null;
  }
}

function menuHref(key: string, comingSoon?: boolean): string {
  if (comingSoon) return "/app/coming-soon";
  switch (key) {
    case "insights": return "/app/insights";
    case "games": return "/app/tasks";
    case "economy": return "/app/receipts";
    default: return "/app/receipts";
  }
}

export default function MenuPage() {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const { profile, refresh } = useAppProfile();
  const { t } = useAppLocale();
  const accountLevel = profile?.accountLevel ?? 1;
  const tier = useTier(accountLevel);
  const acc = tier.accent;
  const [bg1, bg2] = tier.avatarBg.split(",");
  const name = profile?.displayName || profile?.username || t("sidebar.defaultUser");
  const initials = name.slice(0, 2).toUpperCase();
  const ayumo = profile?.ayumo ?? 0;
  const ryumo = profile?.ryumo ?? 0;

  useEffect(() => {
    if (isDesktop) router.replace("/app/dashboard");
  }, [isDesktop, router]);

  // Ödül tutarlılığı: menü açıldığında profili yenile ki ayumo/ryumo dashboard ile aynı görünsün
  useEffect(() => {
    refresh();
  }, [refresh]);

  if (isDesktop) return null;

  return (
    <AppShell>
      <div className="min-h-full flex flex-col bg-[var(--app-bg-shell)] text-[var(--app-text-primary)]">
      {/* Profil özeti — header AppShell Topbar’da (geri + Menü) */}
      <div className="px-4 py-4 border-b" style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold"
            style={{
              background: `linear-gradient(135deg,${bg1},${bg2})`,
              border: `1px solid ${acc}50`,
              color: acc,
            }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold truncate" style={{ color: "var(--app-text-primary)" }}>{name}</p>
            <p className="text-[11px]" style={{ color: "var(--app-text-muted)" }}>{tier.name} · Lv{accountLevel}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <div className="flex-1 rounded-lg py-2 px-3 border" style={{ background: "var(--app-bg-elevated)", borderColor: "var(--app-border)" }}>
            <span className="font-mono text-sm font-medium tabular-nums" style={{ color: acc }}>{Number(ayumo).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
            <span className="ml-1 text-xs" style={{ color: "var(--app-text-muted)" }}>aYUMO</span>
          </div>
          <div className="flex-1 rounded-lg py-2 px-3 border" style={{ background: "var(--app-bg-elevated)", borderColor: "var(--app-border)" }}>
            <span className="font-mono text-sm font-medium tabular-nums" style={{ color: tier.accent2 }}>{Number(ryumo).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
            <span className="ml-1 text-xs" style={{ color: "var(--app-text-muted)" }}>rYUMO</span>
          </div>
        </div>
        <div className="mt-3">
          <ThemeToggle showLabel />
        </div>
      </div>

      {/* Rewards & Tasks (önceki temadaki gibi) */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-2 space-y-0.5">
          <Link
            href="/app/rewards"
            className={cn(
              "flex items-center gap-4 py-3.5 px-4 rounded-xl transition-colors",
              "hover:bg-white/[0.06] active:bg-white/[0.08]"
            )}
          >
            <div
              className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ background: "#00ff8820", border: "1px solid #00ff8840" }}
            >
              <Coins className="w-5 h-5" style={{ color: "#00ff88" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-white/95">{t("nav.rewards")}</p>
              <p className="text-[12px] text-white/45 mt-0.5">
                {Number(ayumo).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} aYUMO · {Number(ryumo).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} rYUMO
              </p>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0 text-white/30" />
          </Link>
          <Link
            href="/app/tasks"
            className={cn(
              "flex items-center gap-4 py-3.5 px-4 rounded-xl transition-colors",
              "hover:bg-white/[0.06] active:bg-white/[0.08]"
            )}
          >
            <div
              className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
              style={{ background: "#ff6b0020", border: "1px solid #ff6b0040" }}
            >
              <CheckSquare className="w-5 h-5" style={{ color: "#ff6b00" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium text-white/95">{t("nav.tasks")}</p>
              <p className="text-[12px] text-white/45 mt-0.5">Günlük görevler · Demo</p>
            </div>
            <ChevronRight className="w-5 h-5 shrink-0 text-white/30" />
          </Link>

          {/* Tüm modüller */}
          {SIDEBAR_MODS.map((m) => {
            const mod = MOD[m.key];
            if (!mod) return null;
            const href = menuHref(m.key, m.comingSoon);
            return (
              <Link
                key={m.key}
                href={href}
                className={cn(
                  "flex items-center gap-4 py-3.5 px-4 rounded-xl transition-colors",
                  "hover:bg-white/[0.06] active:bg-white/[0.08]"
                )}
              >
                <div
                  className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
                  style={{ background: mod.dim, border: `1px solid ${mod.mid}` }}
                >
                  <ModuleIcon name={mod.icon} size={20} color={mod.neon} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-white/95">{t(`nav.sidebar.${m.key}`)}</p>
                  <p className="text-[12px] text-white/45 mt-0.5">{t(`nav.sidebar.${m.key}Sub`)}</p>
                </div>
                {m.comingSoon ? (
                  <span className="text-[10px] font-medium px-2 py-1 rounded" style={{ background: "var(--app-bg-elevated)", color: "var(--app-text-muted)" }}>{t("comingSoon.short")}</span>
                ) : (
                  <svg width={18} height={18} className="shrink-0 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
      </div>
    </AppShell>
  );
}
