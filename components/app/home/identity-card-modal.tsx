"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { YumoLogo } from "@/components/app/home/yumo-logo";
import { useTier } from "@/lib/theme/theme-context";
import { useAppProfile } from "@/lib/app/profile-context";
import { cn } from "@/lib/utils";

export interface IdentityCardModalProps {
  open: boolean;
  onClose: () => void;
  displayName?: string;
  username?: string;
  accountLevel?: number;
  accountXp?: number;
  accountXpNext?: number;
  accountXpPrev?: number;
  streak?: number;
  ayumo?: number;
  ryumo?: number;
  yumo?: number;
  /** Optional stats for grid */
  totalReceipts?: number;
  totalHiddenCost?: number;
  leaderboardRank?: number;
  title?: string;
  joinDate?: string;
}

export function IdentityCardModal({
  open,
  onClose,
  displayName,
  username,
  accountLevel = 1,
  accountXp = 0,
  accountXpNext = 20000,
  accountXpPrev = 0,
  streak = 0,
  ayumo = 0,
  ryumo = 0,
  yumo = 0,
  totalReceipts,
  totalHiddenCost,
  leaderboardRank,
  title,
  joinDate,
}: IdentityCardModalProps) {
  const { profile: ctxProfile, refresh } = useAppProfile();
  const tier = useTier(accountLevel);
  const accent = tier.accent;
  const name = displayName || username || "Kullanıcı";
  const xpInLevel = accountXp - accountXpPrev;
  const xpNeeded = Math.max(1, accountXpNext - accountXpPrev);
  const acctPct = xpNeeded > 0 ? Math.min((xpInLevel / xpNeeded) * 100, 100) : 0;

  // Modal açıldığında profili yenile; ödüller sadece context'ten (ana sayfayla aynı kaynak)
  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  // Açıkken sadece context kullan. YUMO henüz yok — rYUMO ile karıştırma, 0 göster.
  const displayAyumo = open ? (ctxProfile?.ayumo ?? ayumo) : ayumo;
  const displayRyumo = open ? (ctxProfile?.ryumo ?? ryumo) : ryumo;
  const displayYumo = 0; // YUMO token şu an yok; ileride API'den gelecek

  useEffect(() => {
    if (open) {
      const onEscape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
      document.addEventListener("keydown", onEscape);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", onEscape);
        document.body.style.overflow = "";
      };
    }
  }, [open, onClose]);

  if (!open) return null;

  const stats = [
    ...(totalReceipts != null
      ? [{ label: "Toplam Fiş", val: totalReceipts, color: accent, unit: "" }]
      : []),
    ...(totalHiddenCost != null
      ? [
          {
            label: "Gizli Maliyet",
            val: `₺${totalHiddenCost.toLocaleString("tr-TR")}`,
            color: "#ef4444",
            unit: "",
          },
        ]
      : []),
    { label: "Hesap Seviye", val: accountLevel, color: accent, unit: "" },
    { label: "Streak", val: `${streak} gün`, color: tier.accent2, unit: "" },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Kimlik kartı"
    >
      <div
        className={cn(
          "w-full max-w-[420px] max-h-[85dvh] overflow-y-auto rounded-2xl",
          "border border-white/[0.08] shadow-2xl scrollbar-none",
          "animate-in zoom-in-95 duration-300"
        )}
        style={{
          background: `linear-gradient(135deg, ${tier.base} 0%, #080a18 40%, #12080a 100%)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* BG orbs */}
        <div
          className="pointer-events-none absolute -top-12 -right-12 h-48 w-48 rounded-full opacity-100"
          style={{
            background: `radial-gradient(circle, ${accent}20 0%, transparent 65%)`,
          }}
        />
        <div
          className="pointer-events-none absolute -bottom-8 -left-8 h-40 w-40 rounded-full"
          style={{
            background: `radial-gradient(circle, ${tier.accent2}18 0%, transparent 65%)`,
          }}
        />
        {/* Scan line */}
        <div
          className="animate-scan-down pointer-events-none absolute left-0 right-0 h-0.5"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}50, transparent)`,
          }}
        />

        <div className="relative px-5 pt-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-white/5 transition hover:bg-white/10"
            aria-label="Kapat"
          >
            <X className="h-3.5 w-3.5 text-white/60" />
          </button>

          {/* Header: logo + info */}
          <div className="mb-5 flex gap-4">
            <div className="relative flex h-[100px] w-[100px] flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <YumoLogo accountLevel={accountLevel} size={100} className="p-2" />
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <h2 className="text-xl font-extrabold tracking-tight text-white">
                {name}
              </h2>
              {title && (
                <p className="mt-0.5 text-xs text-white/50">{title}</p>
              )}
              <div
                className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1"
                style={{
                  background: `${accent}14`,
                  borderColor: `${accent}33`,
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ background: accent }}
                />
                <span
                  className="text-[10px] font-semibold tracking-wide"
                  style={{ color: accent }}
                >
                  GENESIS{joinDate ? ` · ${joinDate}'den beri` : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="mb-4 grid grid-cols-2 gap-2">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-3"
              >
                <div
                  className="mb-1 text-[9px] font-semibold uppercase tracking-wider"
                  style={{ color: "var(--app-text-muted)" }}
                >
                  {s.label}
                </div>
                <span
                  className="font-mono text-base font-bold tabular-nums"
                  style={{ color: s.color }}
                >
                  {typeof s.val === "number" ? s.val.toLocaleString("tr-TR") : s.val}
                </span>
                {s.unit && (
                  <span className="ml-1 text-xs text-white/25">{s.unit}</span>
                )}
              </div>
            ))}
          </div>

          {/* Account XP bar — belirgin level ilerlemesi */}
          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <div className="mb-2 flex justify-between items-baseline">
              <span
                className="text-[11px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--app-text-muted)" }}
              >
                Hesap seviyesi · Lv {accountLevel}
              </span>
              <span
                className="font-mono text-sm font-bold tabular-nums"
                style={{ color: accent }}
              >
                {xpInLevel} / {xpNeeded} XP
              </span>
            </div>
            <div
              className="h-4 overflow-hidden rounded-full"
              style={{ background: "rgba(0,0,0,0.35)" }}
            >
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${acctPct}%`,
                  background: `linear-gradient(90deg, ${accent}cc, ${accent})`,
                  boxShadow: `0 0 12px ${accent}40`,
                }}
              />
            </div>
            <p className="mt-1.5 text-[10px] font-medium" style={{ color: "var(--app-text-muted)" }}>
              Bir sonraki seviyeye %{acctPct.toFixed(0)} ilerleme
            </p>
          </div>

          {/* Token row — context'ten (ana sayfayla aynı) */}
          <div className="flex gap-2">
            {[
              { k: "aYUMO", v: displayAyumo, c: accent },
              { k: "rYUMO", v: displayRyumo, c: tier.accent2 },
              { k: "YUMO", v: displayYumo, c: "var(--app-text-secondary)" },
            ].map((t) => (
              <div
                key={t.k}
                className="flex-1 rounded-lg border border-white/5 bg-white/[0.03] py-2 text-center"
              >
                <span
                  className="font-mono text-sm font-bold tabular-nums"
                  style={{ color: t.c }}
                >
                  {(typeof t.v === "number" ? t.v : Number(t.v) || 0).toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                </span>
                <div
                  className="mt-0.5 text-[8px] font-medium tracking-wider"
                  style={{ color: "var(--app-text-muted)" }}
                >
                  {t.k}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
