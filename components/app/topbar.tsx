"use client";

import { useState } from "react";
import { useTheme, useTier } from "@/lib/theme/theme-context";
import { Bell, Volume2, VolumeX } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppLocale } from "@/lib/i18n/app-context";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/app/use-notifications";
import { useSound } from "@/lib/audio/sound-context";

interface TopbarProps {
  title?: string;
  onMenu?: () => void;
  onBack?: () => void;
  accountLevel?: number;
  streak?: number;
  initials?: string;
  unreadCount?: number;
  notifications?: AppNotification[];
  onNotificationsOpen?: () => void;
  onMarkNotificationRead?: (id: number) => void;
  onMarkAllNotificationsRead?: () => void;
  onNavigateToReceipt?: (receiptId: string) => void;
  onNavigateToNotification?: (notification: AppNotification) => void;
  onAvatarClick?: () => void;
  /** Ana ekran modu: logo, locale toggle ve streak pill gizlenir */
  homeVariant?: boolean;
  className?: string;
}

export function Topbar({
  title = "YUMO",
  onMenu,
  onBack,
  accountLevel = 1,
  streak = 0,
  initials = "?",
  unreadCount = 0,
  notifications = [],
  onNotificationsOpen,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onNavigateToReceipt,
  onNavigateToNotification,
  onAvatarClick,
  homeVariant = false,
  className,
}: TopbarProps) {
  const { theme } = useTheme();
  const { t, locale, setLocale } = useAppLocale();
  const tier = useTier(accountLevel);
  const acc = tier.accent;
  const { prefs, toggleEnabled } = useSound();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleOpenChange = (open: boolean) => {
    if (open) onNotificationsOpen?.();
    setNotificationsOpen(open);
  };
  const isLight = theme === "light";
  const headerBg = isLight ? (tier.baseLight ?? tier.cardBgLight ?? "var(--app-header-bg)") : "var(--app-header-bg)";
  const headerBorder = isLight ? (tier.cardBorderLight ?? tier.cardBorder) : "var(--app-header-nav-border)";
  const headerIcon = isLight ? acc : "var(--app-header-nav-icon)";

  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex items-center justify-between gap-2 px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] border-b backdrop-blur-[22px] transition-[border-color,background] duration-[.6s] min-w-0",
        className
      )}
      style={{
        background: headerBg,
        borderColor: headerBorder,
      }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center justify-center w-10 h-10 -ml-1 rounded-lg border-none bg-transparent cursor-pointer hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors"
          aria-label={t("common.back")}
        >
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={headerIcon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
      ) : onMenu ? (
        <button
          type="button"
          onClick={onMenu}
          className="flex items-center justify-center w-10 h-10 -ml-1 rounded-lg border-none bg-transparent cursor-pointer hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors"
          aria-label={t("nav.menu")}
        >
          <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={headerIcon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      ) : (
        <div className="w-10 h-10 -ml-1 flex-shrink-0" />
      )}

      {title === "YUMO" || title === undefined ? (
        <div className="flex items-center gap-2 min-w-0 shrink">
          <div
            className={cn("yumo-lockup-topbar", "light-tier")}
            style={
              ({ "--logo-accent": acc, "--logo-accent2": tier.accent2, fontSize: "13px" } as React.CSSProperties)
            }
          >
            <span className="yumo-word yumo-word-gold">YUMO</span>
            <div className="yumo-sep" />
            <span className="yumo-word yumo-word-silver">YUMO</span>
          </div>
        </div>
      ) : (
        <span
          className="text-[17px] font-bold uppercase tracking-[.12em]"
          style={{ color: isLight ? acc : "var(--app-text-primary)" }}
        >
          {title}
        </span>
      )}


      <div className="flex items-center gap-2">
        {/* Quick mute */}
        <button
          type="button"
          onClick={toggleEnabled}
          className="relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-90"
          style={{
            background: isLight ? `${acc}12` : "color-mix(in srgb, var(--app-header-nav-icon) 12%, transparent)",
            border: `1px solid ${headerBorder}`,
            color: headerIcon,
          }}
          aria-label={prefs.enabled ? t("settings.sound.mute") : t("settings.sound.unmute")}
          title={prefs.enabled ? t("settings.sound.mute") : t("settings.sound.unmute")}
        >
          {prefs.enabled ? <Volume2 className="w-4 h-4" strokeWidth={2} /> : <VolumeX className="w-4 h-4" strokeWidth={2} />}
        </button>

        {/* Locale toggle — home variant'ta gizli */}
        {!homeVariant && (
          <button
            type="button"
            onClick={() => setLocale(locale === "tr" ? "en" : "tr")}
            className="rounded-lg px-2 py-1.5 min-w-[2rem] border-none cursor-pointer transition-colors hover:opacity-90 font-medium text-xs uppercase tracking-wide"
            style={{
              background: isLight ? `${acc}18` : "color-mix(in srgb, var(--app-header-nav-icon) 12%, transparent)",
              border: `1px solid ${headerBorder}`,
              color: headerIcon,
            }}
            aria-label={t("topbar.language.aria")}
            title={locale === "tr" ? t("topbar.language.tr") : t("topbar.language.en")}
          >
            {locale === "tr" ? "TR" : "EN"}
          </button>
        )}

        {/* Streak pill — home variant'ta gizli (streak-row'da gösterilir) */}
        {!homeVariant && streak > 0 && (
          <div
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
            style={{
              background: isLight ? `${acc}18` : "var(--app-gold-glow, rgba(201,168,76,0.15))",
              border: `1px solid ${isLight ? `${acc}30` : "var(--app-gold-border, rgba(201,168,76,0.18))"}`,
            }}
          >
            <span className="text-[11px] leading-none">🔥</span>
            <span
              className="font-mono text-[11px] font-bold tabular-nums"
              style={{ color: acc }}
            >
              {streak}
            </span>
          </div>
        )}

        <Popover open={notificationsOpen} onOpenChange={handleOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-90"
              style={{
                background: isLight ? `${acc}12` : "color-mix(in srgb, var(--app-header-nav-icon) 12%, transparent)",
                border: `1px solid ${headerBorder}`,
                color: headerIcon,
              }}
              aria-label={t("topbar.notifications.willAppear")}
            >
              <Bell className="w-4 h-4" strokeWidth={2} />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: acc, color: "#0a0a0a" }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            sideOffset={8}
            className="w-[min(calc(100vw-2rem),320px)] p-4 border-[var(--app-border)] bg-[var(--app-bg-elevated)]"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-sm font-semibold" style={{ color: "var(--app-text-primary)" }}>
                {t("topbar.notifications.title")}
              </h3>
              {unreadCount > 0 && onMarkAllNotificationsRead && (
                <button
                  type="button"
                  onClick={onMarkAllNotificationsRead}
                  className="text-xs font-medium rounded px-2 py-1 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                  style={{ color: "var(--app-text-muted)" }}
                >
                  {t("topbar.notifications.markAllRead")}
                </button>
              )}
            </div>
            {notifications.length > 0 ? (
              <ul className="space-y-1 max-h-[280px] overflow-y-auto -mx-1 px-1">
                {notifications.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigateToNotification) {
                          onMarkNotificationRead?.(n.id);
                          setNotificationsOpen(false);
                          onNavigateToNotification(n);
                          return;
                        }
                        if (n.receiptId && onNavigateToReceipt) {
                          onMarkNotificationRead?.(n.id);
                          setNotificationsOpen(false);
                          onNavigateToReceipt(n.receiptId);
                        } else {
                          onMarkNotificationRead?.(n.id);
                        }
                      }}
                      className={cn(
                        "w-full text-left rounded-lg p-2.5 transition-colors border-none",
                        "hover:bg-black/5 dark:hover:bg-white/5",
                        !n.readAt && "bg-black/[0.03] dark:bg-white/[0.03]"
                      )}
                      style={{ color: "var(--app-text-primary)" }}
                    >
                      <p className="text-sm font-medium truncate">{n.title || n.type}</p>
                      {n.body && (
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--app-text-muted)" }}>
                          {n.body}
                        </p>
                      )}
                      <p className="text-[10px] mt-1 opacity-70" style={{ color: "var(--app-text-muted)" }}>
                        {new Date(n.createdAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="py-6 text-center" style={{ color: "var(--app-text-muted)" }}>
                <Bell className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium mb-1">{t("topbar.notifications.empty")}</p>
                <p className="text-xs">{t("topbar.notifications.emptyDesc")}</p>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Avatar butonu — profil modalini açar */}
        <button
          type="button"
          onClick={onAvatarClick}
          className="flex-shrink-0 flex items-center justify-center rounded-full transition-all"
          style={{
            width: 34, height: 34,
            background: "linear-gradient(135deg, #1c1a12, #2e2510)",
            border: `2px solid rgba(201,168,76,0.35)`,
            cursor: "pointer",
            fontSize: 12, fontWeight: 800,
            color: "#E8C97A",
            fontFamily: "inherit",
            letterSpacing: "-0.01em",
            boxShadow: "0 0 0 0 rgba(201,168,76,0.5)",
            animation: "avatarPulse 3.5s ease-in-out infinite",
          }}
          aria-label="Profil"
        >
          {initials}
        </button>
      </div>

      <style>{`
        @keyframes avatarPulse {
          0%, 100% { box-shadow: 0 0 0 0px rgba(201,168,76,0.45); }
          55%       { box-shadow: 0 0 0 4px rgba(201,168,76,0); }
        }
      `}</style>
    </header>
  );
}
