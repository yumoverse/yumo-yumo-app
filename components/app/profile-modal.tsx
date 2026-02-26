"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAppProfile } from "@/lib/app/profile-context";
import { useAppLocale } from "@/lib/i18n/app-context";
import { ACCOUNT_LEVEL_XP_THRESHOLDS } from "@/config/account-level-config";

// ── Sayı kısaltıcı ──────────────────────────────────────────────
function fmtToken(value: number): string {
  if (value >= 1_000_000) return `${Math.floor(value / 1_000_000)}M`;
  if (value >= 10_000)    return `${Math.floor(value / 1_000)}K`;
  if (value >= 1_000)     return Math.round(value).toLocaleString("tr-TR");
  return value.toFixed(2);
}

// ── Sabit renk değerleri (dark theme fixed, CSS var'larla aynı) ──
const C = {
  bg:         "#0F1117",
  surface:    "#161B27",
  surface2:   "#1E2537",
  surface3:   "#252D3D",
  gold:       "#C9A84C",
  goldLight:  "#E8C97A",
  goldDim:    "#A07830",
  goldGlow:   "rgba(201,168,76,0.15)",
  goldBorder: "rgba(201,168,76,0.22)",
  success:    "#34D399",
  warn:       "#FBBF24",
  danger:     "#F87171",
  text1:      "#F0F0FF",
  text2:      "#9BA8C0",
  text3:      "#5A6680",
  border:     "rgba(255,255,255,0.07)",
};

// ── Kategori normalizasyon: DB ham değeri → {label, icon} ───────
interface CatDisplay { label: string; icon: string }

const CAT_MAP: Record<string, CatDisplay> = {
  // Market / gıda
  grocery:         { label: "Market",    icon: "🛒" },
  groceries:       { label: "Market",    icon: "🛒" },
  groceries_fmcg:  { label: "Market",    icon: "🛒" },
  supermarket:     { label: "Market",    icon: "🛒" }, // supermarket → Market
  fmcg:            { label: "Market",    icon: "🛒" },
  market:          { label: "Market",    icon: "🛒" },
  gıda:            { label: "Market",    icon: "🛒" },
  gida:            { label: "Market",    icon: "🛒" },
  // Yemek & restoran
  restaurant:       { label: "Restoran",  icon: "🍽️" },
  food:             { label: "Restoran",  icon: "🍽️" },
  food_delivery:    { label: "Restoran",  icon: "🍽️" },
  yemek:            { label: "Restoran",  icon: "🍽️" },
  restoran:         { label: "Restoran",  icon: "🍽️" },
  // Kafe
  cafe:             { label: "Kafe",      icon: "☕" },
  coffee:           { label: "Kafe",      icon: "☕" },
  kahve:            { label: "Kafe",      icon: "☕" },
  // Fatura / utility
  utilities:        { label: "Fatura",    icon: "⚡" },
  utility:          { label: "Fatura",    icon: "⚡" },
  fatura:           { label: "Fatura",    icon: "⚡" },
  elektrik:         { label: "Fatura",    icon: "⚡" },
  electricity:      { label: "Fatura",    icon: "⚡" },
  su:               { label: "Fatura",    icon: "⚡" },
  water:            { label: "Fatura",    icon: "⚡" },
  gas:              { label: "Fatura",    icon: "⚡" },
  doğalgaz:         { label: "Fatura",    icon: "⚡" },
  // Ulaşım
  transportation:   { label: "Ulaşım",   icon: "🚌" },
  transport:        { label: "Ulaşım",   icon: "🚌" },
  ulaşım:           { label: "Ulaşım",   icon: "🚌" },
  // Yakıt
  fuel:             { label: "Yakıt",    icon: "⛽" },
  petrol:           { label: "Yakıt",    icon: "⛽" },
  yakıt:            { label: "Yakıt",    icon: "⛽" },
  akaryakıt:        { label: "Yakıt",    icon: "⛽" },
  // Elektronik
  electronics:      { label: "Elektronik", icon: "📱" },
  elektronik:       { label: "Elektronik", icon: "📱" },
  technology:       { label: "Elektronik", icon: "📱" },
  teknoloji:        { label: "Elektronik", icon: "📱" },
  // Giyim
  apparel:          { label: "Giyim",    icon: "👕" },
  apparel_fashion:  { label: "Giyim",    icon: "👕" },
  fashion:          { label: "Giyim",    icon: "👕" },
  giyim:            { label: "Giyim",    icon: "👕" },
  kıyafet:          { label: "Giyim",    icon: "👕" },
  ayakkabı:         { label: "Giyim",    icon: "👕" },
  // Kozmetik
  beauty:                { label: "Kozmetik", icon: "✨" },
  beauty_personal_care:  { label: "Kozmetik", icon: "✨" },
  cosmetics:             { label: "Kozmetik", icon: "✨" },
  kozmetik:              { label: "Kozmetik", icon: "✨" },
  güzellik:              { label: "Kozmetik", icon: "✨" },
  // Sağlık
  health:           { label: "Sağlık",   icon: "🩺" },
  sağlık:           { label: "Sağlık",   icon: "🩺" },
  hastane:          { label: "Sağlık",   icon: "🩺" },
  pharmacy:         { label: "Eczane",   icon: "💊" },
  eczane:           { label: "Eczane",   icon: "💊" },
  ilaç:             { label: "Eczane",   icon: "💊" },
  // Eğlence
  entertainment:    { label: "Eğlence",  icon: "🎭" },
  eğlence:          { label: "Eğlence",  icon: "🎭" },
  cinema:           { label: "Eğlence",  icon: "🎭" },
  sinema:           { label: "Eğlence",  icon: "🎭" },
  gaming:           { label: "Eğlence",  icon: "🎮" },
  // Online / e-ticaret
  online:           { label: "Online",   icon: "📦" },
  ecommerce:        { label: "Online",   icon: "📦" },
  "e-commerce":     { label: "Online",   icon: "📦" },
  "e-ticaret":      { label: "Online",   icon: "📦" },
  // Spor
  sports:           { label: "Spor",     icon: "🏋️" },
  spor:             { label: "Spor",     icon: "🏋️" },
  fitness:          { label: "Spor",     icon: "🏋️" },
  // Kitap / kırtasiye
  books:            { label: "Kitap",    icon: "📚" },
  kitap:            { label: "Kitap",    icon: "📚" },
  kırtasiye:        { label: "Kitap",    icon: "📎" },
  // Ev & yaşam
  home:             { label: "Ev",       icon: "🏠" },
  home_living:      { label: "Ev",       icon: "🏠" },
  mobilya:          { label: "Ev",       icon: "🏠" },
  // Seyahat
  travel:           { label: "Seyahat",  icon: "✈️" },
  travel_ticket:    { label: "Seyahat",  icon: "✈️" },
  seyahat:          { label: "Seyahat",  icon: "✈️" },
  // Konaklama
  hotel:            { label: "Konaklama", icon: "🏨" },
  hospitality_lodging: { label: "Konaklama", icon: "🏨" },
  konaklama:        { label: "Konaklama", icon: "🏨" },
  // Dijital servisler
  digital:          { label: "Dijital",  icon: "💻" },
  services_digital: { label: "Dijital",  icon: "💻" },
  dijital:          { label: "Dijital",  icon: "💻" },
};

/** Ham DB değerini normalize eder, display bilgisi döner */
function normalizeCat(raw: string): CatDisplay {
  const key = raw.toLowerCase().trim();
  return CAT_MAP[key] ?? { label: raw.charAt(0).toUpperCase() + raw.slice(1), icon: "🧾" };
}

// ── SVG İkon sistemi ─────────────────────────────────────────────
type IconName =
  | "bell" | "globe" | "pin" | "lock" | "logout"
  | "user" | "shield" | "wallet" | "id" | "chevron"
  | "fire" | "edit" | "x";

function Icon({
  name,
  size = 18,
  color = C.text2,
  strokeWidth = 1.5,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const ss: React.CSSProperties = { width: size, height: size, display: "block", flexShrink: 0 };
  const p = { fill: "none" as const, stroke: color, strokeWidth, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icons: Record<IconName, React.ReactElement> = {
    bell:    <svg style={ss} viewBox="0 0 24 24"><path {...p} d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>,
    globe:   <svg style={ss} viewBox="0 0 24 24"><circle {...p} cx="12" cy="12" r="10"/><path {...p} d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>,
    pin:     <svg style={ss} viewBox="0 0 24 24"><path {...p} d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle {...p} cx="12" cy="10" r="3"/></svg>,
    lock:    <svg style={ss} viewBox="0 0 24 24"><rect {...p} x="3" y="11" width="18" height="11" rx="2" ry="2"/><path {...p} d="M7 11V7a5 5 0 0110 0v4"/></svg>,
    logout:  <svg style={ss} viewBox="0 0 24 24"><path {...p} d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
    user:    <svg style={ss} viewBox="0 0 24 24"><path {...p} d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle {...p} cx="12" cy="7" r="4"/></svg>,
    shield:  <svg style={ss} viewBox="0 0 24 24"><path {...p} d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    wallet:  <svg style={ss} viewBox="0 0 24 24"><path {...p} d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/><path {...p} d="M16 3l-4 4-4-4"/><circle {...p} cx="16" cy="14" r="1" fill={color}/></svg>,
    id:      <svg style={ss} viewBox="0 0 24 24"><rect {...p} x="2" y="5" width="20" height="14" rx="2"/><path {...p} d="M8 10a2 2 0 100 4 2 2 0 000-4zM14 10h4M14 14h3"/></svg>,
    chevron: <svg style={ss} viewBox="0 0 24 24"><path {...p} d="M9 18l6-6-6-6"/></svg>,
    fire:    <svg style={ss} viewBox="0 0 24 24"><path {...p} d="M12 2c0 4-4 5.5-4 9.5a4 4 0 008 0C16 7.5 12 6 12 2zM8.5 14.5A3.5 3.5 0 0012 18a3.5 3.5 0 001.5-6.7"/></svg>,
    edit:    <svg style={ss} viewBox="0 0 24 24"><path {...p} d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path {...p} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    x:       <svg style={ss} viewBox="0 0 24 24"><path {...p} d="M18 6L6 18M6 6l12 12"/></svg>,
  };
  return icons[name] ?? null;
}

// ── Alt bileşenler ──────────────────────────────────────────────
function ProgressBar({ value, max, color = C.gold }: { value: number; max: number; color?: string }) {
  const pct = Math.min((value / Math.max(max, 1)) * 100, 100);
  return (
    <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
      <div style={{
        height: "100%", width: `${pct}%`, borderRadius: 999,
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        boxShadow: `0 0 8px ${color}44`,
        transition: "width 1s cubic-bezier(0.4,0,0.2,1)",
      }} />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.16em",
      color: C.text3, marginBottom: 10, marginTop: 4,
      textTransform: "uppercase",
    }}>
      {children}
    </p>
  );
}

function SettingsRow({
  icon, label, value, danger, onClick, last,
}: {
  icon: IconName;
  label: string;
  value?: string;
  danger?: boolean;
  onClick?: () => void;
  last?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={onClick}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => setPressed(true)}
      onTouchEnd={() => setPressed(false)}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "13px 16px",
        background: pressed ? C.surface3 : "transparent",
        borderBottom: last ? "none" : `1px solid ${C.border}`,
        cursor: onClick ? "pointer" : "default",
        transition: "background 0.12s ease",
      }}
    >
      <div style={{ width: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={17} color={danger ? C.danger : C.text3} strokeWidth={1.6} />
      </div>
      <span style={{ fontSize: 14, color: danger ? C.danger : C.text1, flex: 1, fontWeight: 500 }}>{label}</span>
      {value && <span style={{ fontSize: 12, color: C.text3 }}>{value}</span>}
      {onClick && !danger && <Icon name="chevron" size={14} color={C.text3} strokeWidth={2} />}
    </div>
  );
}

function MonogramAvatar({ name, size = 58 }: { name: string; size?: number }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 999,
      background: "linear-gradient(135deg, #1c1a12, #2e2510)",
      border: `2px solid ${C.goldBorder}`,
      boxShadow: `0 0 24px rgba(201,168,76,0.20)`,
      display: "flex", alignItems: "center", justifyContent: "center",
      position: "relative", flexShrink: 0,
    }}>
      <span style={{
        fontSize: size * 0.32, fontWeight: 800,
        color: C.goldLight, letterSpacing: "-0.02em",
        fontFamily: "-apple-system, sans-serif",
        userSelect: "none",
      }}>
        {initials}
      </span>
    </div>
  );
}

// ── Kategori tipi ────────────────────────────────────────────────
interface SpendingCategory {
  id: string;
  label: string;
  /** Bar genişliği: bu kategorinin en büyük kategoriye oranı (0–1) */
  weight: number;
  /** Toplam harcamadaki gerçek pay (0–100) */
  pct: number;
  icon: string;
}

// ── Ana ProfileModal bileşeni ────────────────────────────────────
interface ProfileModalProps {
  onClose: () => void;
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const router = useRouter();
  const { profile, refresh } = useAppProfile();
  const { locale, setLocale } = useAppLocale();

  const [visible,    setVisible]    = useState(false);
  const [editName,   setEditName]   = useState(false);
  const [draftName,  setDraftName]  = useState("");
  const [savingName, setSavingName] = useState(false);
  const [notifOn,    setNotifOn]    = useState(true);
  const [categories, setCategories] = useState<SpendingCategory[]>([]);
  const [loggingOut, setLoggingOut] = useState(false);

  // Giriş animasyonu
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // İsim taslağını profille başlat
  useEffect(() => {
    setDraftName(profile?.displayName || profile?.username || "");
  }, [profile?.displayName, profile?.username]);

  // Harcama kategorilerini çek — denormalize merchant_category kolonu kullanılır
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/user/spending-categories?months=12");
      if (!res.ok) return;
      const data = await res.json();

      const rows: { category: string; totalPaid: number }[] = data.categories ?? [];
      if (rows.length === 0) return;

      // Canonical label'a göre grupla (örn. "supermarket" + "grocery" → "Market")
      const spending: Record<string, number> = {};
      for (const row of rows) {
        const raw = row.category.trim();
        if (!raw || raw.toLowerCase() === "other") continue;
        const { label } = normalizeCat(raw);
        spending[label] = (spending[label] ?? 0) + row.totalPaid;
      }

      if (Object.keys(spending).length === 0) return;

      const totalSpending = Object.values(spending).reduce((a, b) => a + b, 0);
      if (totalSpending === 0) return;

      const sorted = Object.entries(spending)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 7);

      setCategories(
        sorted.map(([label, amount]) => {
          const entry = Object.values(CAT_MAP).find(v => v.label === label);
          return {
            id: label.toLowerCase().replace(/\s+/g, "-"),
            label,
            weight: amount / (sorted[0][1] ?? 1),
            pct: Math.round((amount / totalSpending) * 100),
            icon: entry?.icon ?? "🧾",
          };
        })
      );
    } catch { /* sessizce geç */ }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 320);
  };

  const handleSaveName = async () => {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === (profile?.displayName || profile?.username)) {
      setEditName(false);
      return;
    }
    setSavingName(true);
    try {
      await fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: trimmed }),
      });
      await refresh();
    } finally {
      setSavingName(false);
      setEditName(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    setVisible(false);
    setTimeout(async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } finally {
        router.push("/");
      }
    }, 280);
  };

  // Profil verileri
  const displayName  = profile?.displayName || profile?.username || "?";
  const accountLevel = profile?.accountLevel ?? 1;
  const accountXp    = profile?.accountXp ?? 0;
  // accountXpNext/Prev her zaman threshold config'den türet; API'dan gelmeyen optional alana güvenme
  const accountXpNext = ACCOUNT_LEVEL_XP_THRESHOLDS[accountLevel] ?? ACCOUNT_LEVEL_XP_THRESHOLDS[ACCOUNT_LEVEL_XP_THRESHOLDS.length - 1];
  const accountXpPrev = ACCOUNT_LEVEL_XP_THRESHOLDS[accountLevel - 1] ?? 0;
  const xpInLevel = Math.max(0, accountXp - accountXpPrev);
  const xpRange   = Math.max(1, accountXpNext - accountXpPrev);
  const xpLeft    = Math.max(0, accountXpNext - accountXp);
  const xpPct     = Math.round(Math.min(1, xpInLevel / xpRange) * 100);
  const streak  = profile?.streak ?? 0;
  const ayumo   = profile?.ayumo ?? 0;
  const ryumo   = profile?.ryumo ?? 0;
  const langLabel = locale === "tr" ? "Türkçe" : "English";

  return (
    <>
      <style>{`
        @keyframes pmFadeIn  { from { opacity: 0 } to { opacity: 1 } }
        .pm-sheet { transition: transform .32s cubic-bezier(.32,.72,0,1), opacity .28s ease; }
        .pm-toggle-thumb { transition: transform .2s ease; }
        .pm-row-hover:hover { background: ${C.surface3}; }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: "fixed", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.68)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          animation: "pmFadeIn .22s ease",
        }}
      />

      {/* Sheet */}
      <div
        className="pm-sheet scroll-hide"
        style={{
          position: "fixed",
          // Topbar yüksekliği: py-3.5 (14px×2) + içerik h-10 (40px) = 68px
          top: 68,
          left: "50%",
          transform: visible
            ? "translateX(-50%) translateY(0)"
            : "translateX(-50%) translateY(-12px)",
          opacity: visible ? 1 : 0,
          zIndex: 51,
          width: "100%",
          maxWidth: 480,
          background: C.surface,
          borderRadius: "0 0 20px 20px",
          border: `1px solid ${C.goldBorder}`,
          borderTop: `1px solid ${C.border}`,
          boxShadow: "0 16px 48px rgba(0,0,0,0.55)",
          maxHeight: "78vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── Sabit header ── */}
        <div style={{ flexShrink: 0, position: "relative" }}>
          {/* Kapat butonu */}
          <button
            onClick={handleClose}
            style={{
              position: "absolute", top: 10, right: 14,
              width: 28, height: 28, borderRadius: 999,
              background: C.surface3, border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: 0,
            }}
            aria-label="Kapat"
          >
            <Icon name="x" size={14} color={C.text3} strokeWidth={2} />
          </button>

          {/* Avatar + isim satırı */}
          <div style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "12px 20px 14px",
            borderBottom: `1px solid ${C.border}`,
          }}>
            {/* Avatar — tıklanınca isim düzenlemeye geç */}
            <div
              style={{ position: "relative", cursor: "pointer", flexShrink: 0 }}
              onClick={() => { setDraftName(displayName); setEditName(true); }}
            >
              <MonogramAvatar name={displayName} size={58} />
              <div style={{
                position: "absolute", bottom: -1, right: -1,
                width: 20, height: 20, borderRadius: 999,
                background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
                border: `1.5px solid ${C.surface}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9,
                pointerEvents: "none",
              }}>
                ✏️
              </div>
            </div>

            {/* İsim + tier */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {editName ? (
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <input
                    autoFocus
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleSaveName()}
                    maxLength={32}
                    style={{
                      background: C.surface2, border: `1px solid ${C.goldBorder}`,
                      borderRadius: 8, padding: "6px 10px",
                      color: C.text1, fontSize: 16, fontWeight: 700,
                      outline: "none", flex: 1, minWidth: 0,
                      fontFamily: "inherit",
                    }}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={savingName}
                    style={{
                      padding: "6px 12px", borderRadius: 8, border: "none",
                      background: C.gold, color: C.bg,
                      fontSize: 12, fontWeight: 700,
                      cursor: savingName ? "wait" : "pointer",
                      flexShrink: 0, opacity: savingName ? 0.7 : 1,
                    }}
                  >
                    {savingName ? "…" : "✓"}
                  </button>
                  <button
                    onClick={() => setEditName(false)}
                    style={{
                      padding: "6px 8px", borderRadius: 8, border: "none",
                      background: C.surface3, color: C.text3,
                      fontSize: 12, cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <p style={{
                    fontSize: 20, fontWeight: 700, color: C.text1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {displayName}
                  </p>
                  <button
                    onClick={() => { setDraftName(displayName); setEditName(true); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2, flexShrink: 0 }}
                    aria-label="İsim düzenle"
                  >
                    <Icon name="edit" size={13} color={C.text3} strokeWidth={1.6} />
                  </button>
                </div>
              )}

              {/* Tier + streak */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
                  color: C.gold, padding: "2px 8px", borderRadius: 999,
                  background: C.goldGlow, border: `1px solid ${C.goldBorder}`,
                }}>
                  Seed
                </span>
                {streak > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Icon name="fire" size={12} color={C.warn} strokeWidth={1.6} />
                    <span style={{ fontSize: 11, color: C.text3 }}>{streak} gün streak</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Kaydırılabilir içerik ── */}
        <div
          className="scroll-hide"
          style={{ flex: 1, overflowY: "auto", padding: "16px 20px 48px" }}
        >
          {/* HESAP SEVİYESİ */}
          <SectionLabel>Hesap Seviyesi</SectionLabel>
          <div style={{
            background: C.surface2, borderRadius: 12,
            border: `1px solid ${C.goldBorder}`,
            padding: "14px 16px", marginBottom: 20,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span style={{ fontSize: 26, fontWeight: 800, color: C.goldLight, lineHeight: 1 }}>
                  Lv {accountLevel}
                </span>
                <span style={{ fontSize: 12, color: C.text3 }}>Seed</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: C.gold }}>
                  {xpInLevel} / {xpRange} XP
                </span>
                <p style={{ fontSize: 10, color: C.text3, marginTop: 2 }}>
                  {xpLeft} XP → Lv {accountLevel + 1}
                </p>
              </div>
            </div>
            <ProgressBar value={xpInLevel} max={xpRange} />
            <p style={{ fontSize: 10, color: C.text3, marginTop: 6 }}>%{xpPct} tamamlandı</p>
          </div>

          {/* TOKEN BAKİYELERİ */}
          <SectionLabel>Token Bakiyeleri</SectionLabel>
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8, marginBottom: 20,
          }}>
            {[
              { label: "aYUMO", value: ayumo,  color: C.gold,    desc: "Fiş kazancı" },
              { label: "rYUMO", value: ryumo,  color: C.success, desc: "Quest ödülü" },
              { label: "YUMO",  value: 0,       color: C.text3,   desc: "Blockchain" },
            ].map(tok => (
              <div key={tok.label} style={{
                background: C.surface2, borderRadius: 12,
                border: `1px solid ${C.border}`,
                padding: "12px 10px", textAlign: "center",
              }}>
                <p style={{
                  fontSize: 15, fontWeight: 700,
                  fontFamily: "monospace", color: tok.color, marginBottom: 2,
                }}>
                  {fmtToken(tok.value)}
                </p>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", color: tok.color, opacity: 0.7 }}>
                  {tok.label}
                </p>
                <p style={{ fontSize: 9, color: C.text3, marginTop: 2 }}>{tok.desc}</p>
              </div>
            ))}
          </div>

          {/* HARCAMA PROFİLİ */}
          {categories.length > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, marginTop: 4 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", color: C.text3, textTransform: "uppercase" }}>
                  Harcama Profili
                </p>
                <p style={{ fontSize: 9, color: C.text3 }}>toplam harcamadan pay</p>
              </div>
              <div style={{
                background: C.surface2, borderRadius: 12,
                border: `1px solid ${C.border}`,
                padding: "14px 16px", marginBottom: 20,
              }}>
                {categories.map((cat, i) => (
                  <div key={cat.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    marginBottom: i < categories.length - 1 ? 10 : 0,
                  }}>
                    <span style={{ fontSize: 13, width: 18, textAlign: "center", flexShrink: 0 }}>
                      {cat.icon}
                    </span>
                    <span style={{
                      fontSize: 12, color: C.text2,
                      width: 72, flexShrink: 0,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {cat.label}
                    </span>
                    <div style={{ flex: 1, height: 4, borderRadius: 999, background: "rgba(255,255,255,0.06)" }}>
                      <div style={{
                        height: "100%", width: `${cat.weight * 100}%`, borderRadius: 999,
                        background: `linear-gradient(90deg, ${C.goldDim}88, ${C.goldLight})`,
                        boxShadow: cat.weight > 0.6 ? `0 0 6px ${C.goldGlow}` : "none",
                      }} />
                    </div>
                    <span style={{
                      fontSize: 11, fontFamily: "monospace",
                      color: cat.weight > 0.6 ? C.gold : C.text3,
                      width: 28, textAlign: "right", flexShrink: 0,
                    }}>
                      {cat.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* AYARLAR */}
          <SectionLabel>Ayarlar</SectionLabel>
          <div style={{
            background: C.surface2, borderRadius: 12,
            border: `1px solid ${C.border}`,
            overflow: "hidden", marginBottom: 12,
          }}>
            {/* Bildirimler toggle */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "13px 16px",
              borderBottom: `1px solid ${C.border}`,
            }}>
              <div style={{ width: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="bell" size={17} color={C.text3} strokeWidth={1.6} />
              </div>
              <span style={{ fontSize: 14, color: C.text1, flex: 1, fontWeight: 500 }}>Bildirimler</span>
              <div
                onClick={() => setNotifOn(v => !v)}
                style={{
                  width: 40, height: 22, borderRadius: 999, cursor: "pointer",
                  background: notifOn ? C.gold : C.surface3,
                  position: "relative",
                  transition: "background 0.2s ease",
                  flexShrink: 0,
                }}
              >
                <div className="pm-toggle-thumb" style={{
                  position: "absolute", top: 3, borderRadius: 999,
                  width: 16, height: 16, background: C.bg,
                  transform: notifOn ? "translateX(21px)" : "translateX(3px)",
                }} />
              </div>
            </div>

            {/* Dil */}
            <div style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "13px 16px",
              borderBottom: `1px solid ${C.border}`,
              cursor: "pointer",
            }}
              onClick={() => setLocale(locale === "tr" ? "en" : "tr")}
            >
              <div style={{ width: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name="globe" size={17} color={C.text3} strokeWidth={1.6} />
              </div>
              <span style={{ fontSize: 14, color: C.text1, flex: 1, fontWeight: 500 }}>Dil</span>
              <span style={{ fontSize: 12, color: C.text3 }}>{langLabel}</span>
              <Icon name="chevron" size={14} color={C.text3} strokeWidth={2} />
            </div>

            <SettingsRow icon="pin" label="Bölge" value="🇹🇷 Türkiye" last />
          </div>

          {/* KİŞİSEL */}
          <SectionLabel>Kişisel</SectionLabel>
          <div style={{
            background: C.surface2, borderRadius: 12,
            border: `1px solid ${C.border}`,
            overflow: "hidden", marginBottom: 12,
          }}>
            <SettingsRow icon="user"   label="Profil Bilgileri"   value="Yaş, gelir, adres" />
            <SettingsRow icon="id"     label="Kimlik Doğrulama"   value="Doğrulanmadı" />
            <SettingsRow icon="wallet" label="Cüzdan Bağla"       value="Bağlı değil" last />
          </div>

          {/* GÜVENLİK + ÇIKIŞ */}
          <div style={{
            background: C.surface2, borderRadius: 12,
            border: `1px solid ${C.border}`,
            overflow: "hidden",
          }}>
            <SettingsRow icon="lock" label="Gizlilik ve Güvenlik" />
            <SettingsRow
              icon="logout"
              label={loggingOut ? "Çıkış yapılıyor…" : "Çıkış Yap"}
              danger
              last
              onClick={handleLogout}
            />
          </div>
        </div>
      </div>
    </>
  );
}
