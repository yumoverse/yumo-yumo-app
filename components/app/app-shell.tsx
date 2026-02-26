"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Topbar } from "./topbar";
import { BottomNav } from "./bottom-nav";
import { DesktopSidebar } from "./desktop-sidebar";
import { ThemeBg } from "./theme-bg";
import { ProfileModal } from "./profile-modal";
import { useAppProfile } from "@/lib/app/profile-context";
import { useNotifications } from "@/lib/app/use-notifications";
import { ThemeLevelProvider, TierVarsInjector } from "@/lib/theme/theme-context";
import { SoundProvider } from "@/lib/audio/sound-context";
import { useIsDesktop } from "@/lib/hooks/use-is-desktop";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

function AppShellFallback() {
  return (
    <div className="min-h-screen bg-[var(--app-bg-shell)] flex items-center justify-center text-[var(--app-text-muted)]">
      Yükleniyor...
    </div>
  );
}

export function AppShell({ children, className }: AppShellProps) {
  return (
    <Suspense fallback={<AppShellFallback />}>
      <AppShellInner children={children} className={className} />
    </Suspense>
  );
}

function AppShellInner({ children, className }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile: ctxProfile } = useAppProfile();
  const { notifications, unreadCount, refetch: refetchNotifications, markRead, markAllRead } = useNotifications();
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const levelParam = searchParams.get("level");
  const levelOverride =
    levelParam != null ? Math.max(1, Math.min(999, parseInt(levelParam, 10) || 1)) : null;
  const accountLevel = levelOverride ?? ctxProfile?.accountLevel ?? 1;
  const initials = (ctxProfile?.displayName || ctxProfile?.username || "?").slice(0, 2).toUpperCase();
  const streak = ctxProfile?.streak ?? 0;
  const isDesktop = useIsDesktop();
  const isMenuPage = pathname === "/app/menu";
  const showMenuButton = !isDesktop;

  return (
    <ThemeLevelProvider level={accountLevel}>
      <TierVarsInjector />
      <SoundProvider>
        <div className="min-h-screen bg-[var(--app-bg-shell)] text-[var(--app-text-primary)] relative font-sans transition-[background-color] duration-500">
          <ThemeBg accountLevel={accountLevel} />
          <DesktopSidebar />
          <div className="lg:pl-56 min-h-screen flex flex-col">
            <Topbar
              title={undefined}
              onBack={undefined}
              onMenu={showMenuButton && !isMenuPage ? () => router.push("/app/menu") : undefined}
              accountLevel={accountLevel}
              streak={streak}
              initials={initials}
              unreadCount={unreadCount}
              notifications={notifications}
              onNotificationsOpen={refetchNotifications}
              onMarkNotificationRead={markRead}
              onMarkAllNotificationsRead={markAllRead}
              onNavigateToReceipt={(id) => router.push(`/app/receipts/${id}`)}
              onAvatarClick={() => setProfileModalOpen(true)}
              homeVariant={true}
            />
            {profileModalOpen && (
              <ProfileModal onClose={() => setProfileModalOpen(false)} />
            )}
            <main className={cn("relative z-10 w-full min-w-0 flex-1 p-3 sm:p-4 pb-24 lg:pb-8 max-w-[430px] lg:max-w-4xl mx-auto", className)}>
              {children}
            </main>
            <div className="lg:hidden">
              <BottomNav accountLevel={accountLevel} />
            </div>
          </div>
        </div>
      </SoundProvider>
    </ThemeLevelProvider>
  );
}
