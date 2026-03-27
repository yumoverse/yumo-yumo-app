"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTier } from "@/lib/theme/theme-context";
import { useAppProfile } from "@/lib/app/profile-context";
import { useAppLocale } from "@/lib/i18n/app-context";
import { MOD, SIDEBAR_MODS } from "@/lib/theme/modules";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { cn } from "@/lib/utils";
import {
  ReceiptText,
  Store,
  Upload,
  FileSearch,
  MessageCircle,
  XCircle,
  Download,
  FileText as FileTextIcon,
  FileCode,
  CheckSquare,
  ListChecks,
  ListTree,
  Package,
} from "lucide-react";


function ModuleIcon({ name, size = 20, color }: { name: string; size?: number; color: string }) {
  const s = { width: size, height: size, display: "block" as const, flexShrink: 0 };
  const p = { fill: "none" as const, stroke: color, strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "economy":
    case "insights":
      return <svg style={s} viewBox="0 0 24 24"><polyline {...p} points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline {...p} points="17 6 23 6 23 12" /></svg>;
    case "games":
      return <svg style={s} viewBox="0 0 24 24"><rect {...p} x="2" y="6" width="20" height="12" rx="3" /><line {...p} x1="8" y1="12" x2="12" y2="12" /><line {...p} x1="10" y1="10" x2="10" y2="14" /><circle cx="16" cy="11" r="1" fill={color} stroke="none" /><circle cx="18" cy="13" r="1" fill={color} stroke="none" /></svg>;
    case "home":
      return <svg style={s} viewBox="0 0 24 24"><path {...p} d="M3 10L12 3l9 7v10a1 1 0 01-1 1H4a1 1 0 01-1-1V10z" /><path {...p} d="M9 21V12h6v9" /></svg>;
    case "receipt":
      return <ReceiptText size={size} strokeWidth={1.5} color={color} style={s} />;
    case "trophy":
      return <svg style={s} viewBox="0 0 24 24"><path {...p} d="M6 4h12v6a6 6 0 01-12 0V4z" /><path {...p} d="M6 7H3v2a3 3 0 003 3M18 7h3v2a3 3 0 01-3 3" /><path {...p} d="M12 16v4M8 21h8" /></svg>;
    case "user":
      return <svg style={s} viewBox="0 0 24 24"><circle {...p} cx="12" cy="8" r="4" /><path {...p} d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>;
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

/** Desktop-only sidebar: profile summary + nav (no Mine/Upload). Rendered in AppShell on lg. */
export function DesktopSidebar() {
  const pathname = usePathname();
  const { profile } = useAppProfile();
  const { t } = useAppLocale();
  const accountLevel = profile?.accountLevel ?? 1;
  const tier = useTier(accountLevel);
  const acc = tier.accent;
  const [bg1, bg2] = tier.avatarBg.split(",");
  const name = profile?.displayName || profile?.username || t("sidebar.defaultUser");
  const initials = name.slice(0, 2).toUpperCase();
  const ayumo = profile?.ayumo ?? 0;
  const ryumo = profile?.ryumo ?? 0;
  const isAdmin = !!profile?.isAdmin;

  const isActive = (href: string) => {
    if (href === "/app" || href === "/app/dashboard") return pathname === "/app" || pathname === "/app/dashboard";
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="hidden lg:flex lg:flex-col lg:w-56 lg:fixed lg:left-0 lg:top-0 lg:h-screen lg:border-r lg:z-30 overflow-y-auto"
      style={{ background: "var(--app-bg-shell)", borderColor: "var(--app-border)" }}
    >
      <div className="p-4 border-b flex-shrink-0" style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold"
            style={{
              background: `linear-gradient(135deg,${bg1},${bg2})`,
              border: `1px solid ${acc}50`,
              color: acc,
            }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--app-text-primary)" }}>{name}</p>
            <p className="text-[11px]" style={{ color: "var(--app-text-muted)" }}>{tier.name} · Lv{accountLevel}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <div className="flex-1 rounded-lg py-2 px-2.5 border" style={{ background: "var(--app-bg-elevated)", borderColor: "var(--app-border)" }}>
            <span className="font-mono text-xs font-medium tabular-nums" style={{ color: acc }}>{Number(ayumo).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
            <span className="ml-0.5 text-[10px]" style={{ color: "var(--app-text-muted)" }}>aYUMO</span>
          </div>
          <div className="flex-1 rounded-lg py-2 px-2.5 border" style={{ background: "var(--app-bg-elevated)", borderColor: "var(--app-border)" }}>
            <span className="font-mono text-xs font-medium tabular-nums" style={{ color: tier.accent2 }}>{Number(ryumo).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
            <span className="ml-0.5 text-[10px]" style={{ color: "var(--app-text-muted)" }}>rYUMO</span>
          </div>
        </div>
        <div className="mt-3">
          <ThemeToggle showLabel />
        </div>
      </div>

      <nav className="flex-1 py-4 px-2 space-y-0.5 min-w-0">
        <Link
          href="/app/dashboard"
          className={cn(
            "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors text-sm",
            isActive("/app/dashboard") ? "bg-white/[0.08]" : "hover:bg-white/[0.06]"
          )}
          style={{ color: isActive("/app/dashboard") ? acc : "var(--app-text-primary)" }}
        >
          <ModuleIcon name="home" size={20} color={isActive("/app/dashboard") ? acc : "var(--app-text-muted)"} />
          <span>{t("nav.homeMenu")}</span>
        </Link>
        <Link
          href="/app/receipts"
          className={cn(
            "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors text-sm",
            isActive("/app/receipts") ? "bg-white/[0.08]" : "hover:bg-white/[0.06]"
          )}
          style={{ color: isActive("/app/receipts") ? acc : "var(--app-text-primary)" }}
        >
          <ModuleIcon name="receipt" size={20} color={isActive("/app/receipts") ? acc : "var(--app-text-muted)"} />
          <span>{t("nav.receipts")}</span>
        </Link>
        {SIDEBAR_MODS.filter((m) => m.key === "insights" || m.key === "games").map((m) => {
          const mod = MOD[m.key];
          if (!mod) return null;
          const href = menuHref(m.key, m.comingSoon);
          const active = isActive(href);
          const iconColor = active ? acc : "var(--app-text-muted)";
          return (
            <Link
              key={m.key}
              href={href}
              className={cn(
                "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors text-sm",
                active ? "bg-white/[0.08]" : "hover:bg-white/[0.06]"
              )}
              style={{ color: active ? acc : "var(--app-text-primary)" }}
            >
              <ModuleIcon name={mod.icon} size={20} color={iconColor} />
              <span>{t(`nav.sidebar.${m.key}`)}</span>
            </Link>
          );
        })}
        <Link
          href="/app/leaderboard"
          className={cn(
            "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors text-sm",
            isActive("/app/leaderboard") ? "bg-white/[0.08]" : "hover:bg-white/[0.06]"
          )}
          style={{ color: isActive("/app/leaderboard") ? acc : "var(--app-text-primary)" }}
        >
          <ModuleIcon name="trophy" size={20} color={isActive("/app/leaderboard") ? acc : "var(--app-text-muted)"} />
          <span>{t("nav.leaderboard")}</span>
        </Link>
        <Link
          href="/app/profile"
          className={cn(
            "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors text-sm",
            isActive("/app/profile") ? "bg-white/[0.08]" : "hover:bg-white/[0.06]"
          )}
          style={{ color: isActive("/app/profile") ? acc : "var(--app-text-primary)" }}
        >
          <ModuleIcon name="user" size={20} color={isActive("/app/profile") ? acc : "var(--app-text-muted)"} />
          <span>{t("nav.profile")}</span>
        </Link>

        {isAdmin && (
          <>
            <div className="my-3 mx-3 border-t" style={{ borderColor: "var(--app-border)" }} />
            <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--app-text-muted)" }}>
              ADMIN
            </p>
            {[
              { href: "/app/upload", label: t("nav.admin.fileUpload"), Icon: Upload },
              { href: "/app/admin/merchants", label: t("nav.merchants"), Icon: Store },
              { href: "/app/admin/scraped-products", label: "Kazınan Ürünler", Icon: Package },
              { href: "/app/admin/receipt-line-items", label: "Fiş satırları", Icon: ListTree },
              { href: "/app/admin/approvals", label: t("admin.approvals.title"), Icon: CheckSquare },
              { href: "/app/admin/bulk-upload", label: t("nav.admin.bulkUpload"), Icon: Upload },
              { href: "/app/admin/analyze-file", label: t("nav.admin.analyzeFile"), Icon: FileSearch },
              { href: "/app/admin/feedback", label: t("nav.feedback"), Icon: MessageCircle },
              { href: "/app/admin/rejected", label: t("admin.rejected.title"), Icon: XCircle },
              { href: "/app/admin/blob-download", label: t("nav.admin.downloadReceipt"), Icon: Download },
              { href: "/app/admin/log-download", label: t("nav.admin.downloadLog"), Icon: FileTextIcon },
              { href: "/app/admin/ocr-download", label: t("nav.admin.downloadRawOcr"), Icon: FileCode },
              { href: "/app/admin/quest-test", label: "Test: 180 XP görev", Icon: ListChecks },
            ].map(({ href, label, Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors text-sm",
                    active ? "bg-white/[0.08]" : "hover:bg-white/[0.06]"
                  )}
                  style={{ color: active ? acc : "var(--app-text-primary)" }}
                >
                  <Icon size={20} style={{ color: active ? acc : "var(--app-text-muted)", flexShrink: 0 }} />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </>
        )}
      </nav>
    </aside>
  );
}
