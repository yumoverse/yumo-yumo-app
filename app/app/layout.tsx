"use client";

import { AppI18nProvider } from "@/lib/i18n/app-context";
import { AppProfileProvider } from "@/lib/app/profile-context";
import { ThemeProvider } from "@/lib/theme/theme-context";
import { AppQueryProvider } from "@/lib/app/app-query-client";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppI18nProvider>
      <AppQueryProvider>
        <ThemeProvider>
          <AppProfileProvider>{children}</AppProfileProvider>
        </ThemeProvider>
      </AppQueryProvider>
    </AppI18nProvider>
  );
}
