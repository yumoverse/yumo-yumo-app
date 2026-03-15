"use client";

import { useState } from "react";
import Link from "next/link";
import { ThemeCard } from "@/components/app/theme-card";
import { IdentityCardModal } from "@/components/app/home/identity-card-modal";
import { useTier } from "@/lib/theme/theme-context";
import { useAppProfile } from "@/lib/app/profile-context";

interface ProfileCardProps {
  username?: string;
  displayName?: string;
  accountLevel?: number;
  accountXp?: number;
  accountXpNext?: number;
  accountXpPrev?: number;
  streak?: number;
  ayumo?: number;
  ryumo?: number;
  yumo?: number;
  totalReceipts?: number;
  totalHiddenCost?: number;
  leaderboardRank?: number;
  title?: string;
  joinDate?: string;
  className?: string;
}

/** Display name'den maksimum 2 karakter initial üretir. */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileCard({
  username = "",
  displayName,
  accountLevel = 1,
  accountXp = 0,
  accountXpNext = 20000,
  accountXpPrev = 0,
  streak,
  ayumo = 0,
  ryumo = 0,
  yumo = 0,
  totalReceipts,
  totalHiddenCost,
  leaderboardRank,
  title,
  joinDate,
  className,
}: ProfileCardProps) {
  const { profile: ctxProfile } = useAppProfile();
  const [idCardOpen, setIdCardOpen] = useState(false);
  const tier = useTier(accountLevel);
  const acc = tier.accent;
  const name = displayName || username || "Kullanıcı";
  const initials = getInitials(name);

  const ayumoFromCtx = ctxProfile?.ayumo ?? ayumo;
  const ryumoFromCtx = ctxProfile?.ryumo ?? ryumo;

  const xpInLevel = Math.max(0, accountXp - accountXpPrev);
  const xpRange = Math.max(1, accountXpNext - accountXpPrev);
  const xpPct = Math.min(100, Math.max(0, (xpInLevel / xpRange) * 100));
  const xpRemaining = Math.max(0, xpRange - xpInLevel);

  return (
    <>
      <ThemeCard accountLevel={accountLevel} className={className}>
        <div className="p-4 sm:p-5">
          {/* Üst satır: metin sol, avatar sağ */}
          <div className="flex items-start justify-between gap-3 mb-4">
            {/* Sol: selamlama + isim + tier */}
            <button
              type="button"
              onClick={() => setIdCardOpen(true)}
              className="flex flex-col items-start text-left min-w-0 focus:outline-none"
              aria-label="Kimlik kartını aç"
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-1"
                style={{ color: "var(--app-text-muted)" }}
              >
                Hoş Geldin
              </p>
              <p
                className="text-[26px] font-bold leading-tight tracking-[-0.01em]"
                style={{ color: "var(--app-text-primary)" }}
              >
                {name}
              </p>
              {/* Badge satırı */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
                  style={{
                    background: "var(--app-gold-glow, rgba(201,168,76,0.15))",
                    border: "1px solid var(--app-gold-border, rgba(201,168,76,0.18))",
                    color: "var(--app-gold, #C9A84C)",
                  }}
                >
                  Early Data Contributors
                </span>
                <span
                  className="text-[11px] font-medium"
                  style={{ color: "var(--app-text-muted)" }}
                >
                  {tier.name} · Seviye {accountLevel}
                  {streak != null && streak > 0 && (
                    <span style={{ color: "var(--app-text-secondary)" }}> · {streak} gün</span>
                  )}
                </span>
              </div>
            </button>

            {/* Sağ: initials avatar */}
            <button
              type="button"
              onClick={() => setIdCardOpen(true)}
              className="flex-shrink-0 focus:outline-none"
              aria-label="Kimlik kartını aç"
            >
              <div
                className="flex items-center justify-center rounded-[14px] font-bold select-none"
                style={{
                  width: 56,
                  height: 56,
                  fontSize: 20,
                  fontWeight: 800,
                  background: "linear-gradient(135deg, #1c1408, #382a10)",
                  border: `2px solid ${acc}55`,
                  boxShadow: `0 0 20px rgba(201,168,76,0.15)`,
                  color: acc,
                  letterSpacing: "0.02em",
                }}
              >
                {initials}
              </div>
            </button>
          </div>

          {/* XP bölümü */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: "var(--app-text-muted)" }}
              >
                Account XP
              </span>
              <span
                className="font-mono text-[11px] font-bold tabular-nums"
                style={{ color: acc }}
              >
                {xpInLevel} / {xpRange}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ background: `${acc}20` }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${xpPct}%`, background: acc }}
              />
            </div>
            <p
              className="mt-1.5 text-[10px]"
              style={{ color: "var(--app-text-muted)" }}
            >
              → Seviye {accountLevel + 1}&apos;e {xpRemaining} XP kaldı
            </p>
          </div>
        </div>
      </ThemeCard>

      <IdentityCardModal
        open={idCardOpen}
        onClose={() => setIdCardOpen(false)}
        displayName={displayName}
        username={username}
        accountLevel={accountLevel}
        accountXp={accountXp}
        accountXpNext={accountXpNext}
        accountXpPrev={accountXpPrev}
        streak={streak ?? 0}
        ayumo={ayumoFromCtx}
        ryumo={ryumoFromCtx}
        yumo={0}
        totalReceipts={totalReceipts}
        totalHiddenCost={totalHiddenCost}
        leaderboardRank={leaderboardRank}
        title={title}
        joinDate={joinDate}
      />
    </>
  );
}
