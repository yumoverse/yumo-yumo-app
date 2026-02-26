"use client";

import { AppShell } from "@/components/app/app-shell";
import { QuestsScreen } from "@/components/app/quests-screen";
import { useAppProfile } from "@/lib/app/profile-context";

export default function TasksPage() {
  const { profile } = useAppProfile();
  const accountLevel = profile?.accountLevel ?? 1;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24 lg:pb-8">
        <QuestsScreen accountLevel={accountLevel} />
      </div>
    </AppShell>
  );
}
