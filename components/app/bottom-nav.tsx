"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme, useTier } from "@/lib/theme/theme-context";
import { useAppLocale } from "@/lib/i18n/app-context";
import { ReceiptText } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { href: string; labelKey: string; icon: string; scan?: boolean }[] = [
  { href: "/app", labelKey: "nav.homeMenu", icon: "home" },
  { href: "/app/receipts", labelKey: "nav.receipts", icon: "receipt" },
  { href: "/app/mine", labelKey: "nav.mine", icon: "scan", scan: true },
  { href: "/app/leaderboard", labelKey: "nav.leaderboard", icon: "trophy" },
  { href: "/app/profile", labelKey: "nav.profile", icon: "user" },
];

interface BottomNavProps {
  accountLevel?: number;
  className?: string;
}

function NavIcon({ name, size = 19, color, stroke = 1.5 }: { name: string; size?: number; color: string; stroke?: number }) {
  const s = { width: size, height: size, display: "block" as const };
  const p = { fill: "none" as const, stroke: color, strokeWidth: stroke, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return <svg style={s} viewBox="0 0 24 24"><path {...p} d="M3 10L12 3l9 7v10a1 1 0 01-1 1H4a1 1 0 01-1-1V10z" /><path {...p} d="M9 21V12h6v9" /></svg>;
    case "receipt":
      return <ReceiptText size={size} strokeWidth={stroke} color={color} style={s} />;
    case "scan":
      return <svg style={s} viewBox="0 0 24 24"><circle {...p} cx="12" cy="13" r="3" /><path {...p} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>;
    case "quest":
      return <svg style={s} viewBox="0 0 24 24"><path {...p} d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" /></svg>;
    case "trophy":
      return <svg style={s} viewBox="0 0 24 24"><path {...p} d="M6 4h12v6a6 6 0 01-12 0V4z" /><path {...p} d="M6 7H3v2a3 3 0 003 3M18 7h3v2a3 3 0 01-3 3" /><path {...p} d="M12 16v4M8 21h8" /></svg>;
    case "user":
      return <svg style={s} viewBox="0 0 24 24"><circle {...p} cx="12" cy="8" r="4" /><path {...p} d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>;
    default:
      return null;
  }
}

export function BottomNav({ accountLevel = 1, className }: BottomNavProps) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const { t } = useAppLocale();
  const tier = useTier(accountLevel);
  const acc = tier.accent;
  const [orb1, orb2] = tier.orbBg.split(",");
  const isLight = theme === "light";
  const navBg = isLight ? (tier.baseLight ?? tier.cardBgLight ?? "var(--app-nav-bg)") : "var(--app-nav-bg)";
  const navBorder = isLight ? (tier.cardBorderLight ?? tier.cardBorder) : "var(--app-header-nav-border)";
  const navIconInactive = isLight ? "var(--app-text-muted)" : "var(--app-header-nav-icon)";

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around pt-[clamp(0.35rem,1.2vh,0.55rem)] pb-[clamp(0.7rem,2.2vh,1rem)] safe-area-pb backdrop-blur-[20px] transition-[border-color,background] duration-[.6s]",
        className
      )}
      style={{
        height: "clamp(56px, 9.2svh, 66px)",
        background: navBg,
        borderTop: `1px solid ${navBorder}`,
      }}
    >
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/app"
            ? pathname === "/app" || pathname === "/app/dashboard"
            : pathname.startsWith(item.href);
        const c = isActive ? acc : navIconInactive;

        if (item.scan) {
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
            >
              <div
                className="w-[clamp(2.2rem,9.5vw,2.6rem)] h-[clamp(2.2rem,9.5vw,2.6rem)] rounded-[12px] flex items-center justify-center transition-all duration-[.6s] shrink-0 -mt-[clamp(0.6rem,1.7vh,1rem)]"
                style={{
                  background: `linear-gradient(135deg, ${acc}, ${tier.accent2 ?? acc}99)`,
                  border: `1px solid ${acc}55`,
                  boxShadow: `0 4px 16px ${acc}40`,
                }}
              >
                <NavIcon name={item.icon} size={16} color="#0a0a0a" />
              </div>
              <span className="text-[clamp(6px,1.7vw,8px)] font-medium uppercase tracking-[.06em]" style={{ color: c }}>{t(item.labelKey)}</span>
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center gap-0.5 cursor-pointer"
          >
            <NavIcon name={item.icon} size={16} color={c} stroke={isActive ? 2 : 1.5} />
            <span className="text-[clamp(6px,1.7vw,8px)] font-medium uppercase tracking-[.06em]" style={{ color: c }}>{t(item.labelKey)}</span>
            {isActive && (
              <div
                className="w-0.5 h-0.5 rounded-full"
                style={{ background: acc, boxShadow: `0 0 5px ${acc}` }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
