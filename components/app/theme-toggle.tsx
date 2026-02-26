"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme/theme-context";
import { useAppLocale } from "@/lib/i18n/app-context";
import { cn } from "@/lib/utils";

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className, showLabel }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const { t } = useAppLocale();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? t("settings.themeDark") : t("settings.themeLight")}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-all duration-300 hover:opacity-90 active:scale-[0.98]",
        className
      )}
      style={{
        background: "var(--app-bg-elevated)",
        borderColor: "var(--app-border)",
        color: "var(--app-text-primary)",
      }}
    >
      {isLight ? (
        <Moon className="h-5 w-5" strokeWidth={2} />
      ) : (
        <Sun className="h-5 w-5" strokeWidth={2} />
      )}
      {showLabel && (
        <span className="text-sm font-medium">
          {isLight ? t("settings.themeDark") : t("settings.themeLight")}
        </span>
      )}
    </button>
  );
}
