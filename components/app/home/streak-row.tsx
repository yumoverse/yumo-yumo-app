"use client";

import { useState, useEffect } from "react";

interface StreakRowProps {
  streak?: number;
  checkedInToday?: boolean;
  allowRecheckIn?: boolean;
  onCheckIn?: () => Promise<{ ok: boolean; streak?: number; alreadyCheckedIn?: boolean }>;
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function StreakRow({
  streak = 0,
  checkedInToday = false,
  allowRecheckIn = false,
  onCheckIn,
}: StreakRowProps) {
  const [loading, setLoading]   = useState(false);
  const [checkedIn, setCheckedIn] = useState(checkedInToday);

  useEffect(() => { if (checkedInToday) setCheckedIn(true); }, [checkedInToday]);

  const handleCheckIn = async () => {
    if (!onCheckIn || loading || (checkedIn && !allowRecheckIn)) return;
    setLoading(true);
    try {
      const res = await onCheckIn();
      if (res.ok) setCheckedIn(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "2px 2px",
    }}>
      {/* Sol: ateş + streak sayısı */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 16 }}>🔥</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--app-text-primary)" }}>Streak</span>
        <span style={{ fontSize: 11, color: "var(--app-text-muted)" }}>Treasure</span>
      </div>

      {/* Sağ: büyük sayı + buton */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
          <span style={{
            fontSize: 22, fontWeight: 800, fontFamily: "monospace",
            color: "var(--app-gold)",
          }}>
            {streak}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: "var(--app-text-muted)" }}>
            days
          </span>
        </div>

        <button
          type="button"
          onClick={handleCheckIn}
          disabled={loading || (checkedIn && !allowRecheckIn)}
          style={{
            padding: "7px 14px", borderRadius: 999, border: "none",
            cursor: loading || (checkedIn && !allowRecheckIn) ? "default" : "pointer",
            background: checkedIn
              ? "var(--app-bg-surface)"
              : "linear-gradient(135deg, #C9A84C, #A07830)",
            color: checkedIn ? "var(--app-text-muted)" : "#0F1117",
            fontSize: 12, fontWeight: 700,
            display: "flex", alignItems: "center", gap: 6,
            transition: "all 0.2s ease",
            opacity: loading ? 0.7 : 1,
          }}
        >
          <CheckIcon color={checkedIn ? "var(--app-text-muted)" : "#0F1117"} />
          {checkedIn ? "Checked in" : loading ? "…" : "Check in"}
        </button>
      </div>
    </div>
  );
}
