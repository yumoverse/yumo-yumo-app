"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from "react";
import { getTier, type ThemeMode, type TierTheme } from "./tiers";

const STORAGE_KEY = "app-theme";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/** Tema seviyesi (örn. URL ?level=40). Sağlandığında tüm tier/renk bu seviyeye göre hesaplanır. */
const ThemeLevelContext = createContext<number | undefined>(undefined);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      theme: "dark",
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return ctx;
}

export function useThemeLevel(): number {
  const level = useContext(ThemeLevelContext);
  return level ?? 1;
}

export function ThemeLevelProvider({ level, children }: { level: number; children: ReactNode }) {
  return (
    <ThemeLevelContext.Provider value={level}>
      {children}
    </ThemeLevelContext.Provider>
  );
}

/**
 * Tier accent rengini CSS değişkenine yazar.
 * Sayfa arka planı artık tier'a göre değişmiyor — sabit DS slate kullanılır.
 * Yalnızca kart border rengi tier'a göre ayarlanır (kart aksanları için).
 */
export function TierVarsInjector() {
  const level = useThemeLevel();
  const { theme } = useTheme();
  const tier = useMemo(() => getTier(level, theme), [level, theme]);

  useEffect(() => {
    const root = document.documentElement;
    const isLight = theme === "light";
    // Kart border rengi tier'a göre (aksanlar için — bg değişmez)
    const borderVal = isLight ? (tier.cardBorderLight ?? tier.cardBorder) : tier.cardBorder;
    root.style.setProperty("--app-border", borderVal);
    root.style.setProperty("--app-border-strong", borderVal);
    // Light theme: arka planı tier'ın açık değerine çek
    if (isLight && tier.baseLight) {
      root.style.setProperty("--app-bg-shell", tier.baseLight);
      root.style.setProperty("--app-bg-base", tier.baseLight);
      root.style.setProperty("--app-bg-elevated", tier.cardBgLight ?? tier.cardBg);
      root.style.setProperty("--app-bg-surface", tier.cardBgLight ?? tier.cardBg);
    } else {
      // Dark: arka plan sabit slate, sadece border tier'a göre
      root.style.removeProperty("--app-bg-shell");
      root.style.removeProperty("--app-bg-base");
      root.style.removeProperty("--app-bg-elevated");
      root.style.removeProperty("--app-bg-surface");
    }
    return () => {
      root.style.removeProperty("--app-bg-shell");
      root.style.removeProperty("--app-bg-base");
      root.style.removeProperty("--app-bg-elevated");
      root.style.removeProperty("--app-bg-surface");
      root.style.removeProperty("--app-border");
      root.style.removeProperty("--app-border-strong");
    };
  }, [tier, theme]);

  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (stored === "light" || stored === "dark") setThemeState(stored);
    } catch {}
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (theme === "light") {
      root.classList.add("app-theme-light");
    } else {
      root.classList.remove("app-theme-light");
    }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme, mounted]);

  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const value: ThemeContextValue = { theme, setTheme, toggleTheme };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Tier renkleri tema (dark/light) ile birlikte döner.
 *  Şimdilik milestone tema değişimi devre dışı — her zaman Seed (altın) tier döner.
 *  İleride aktifleştirmek için: `getTier(level, theme)` satırını geri getir. */
export function useTier(_accountLevel?: number): TierTheme {
  const { theme } = useTheme();
  return useMemo(() => getTier(1, theme), [theme]);
}
