"use client";

function fmtToken(value: number): string {
  if (value >= 1_000_000) return `${Math.floor(value / 1_000_000)}M`;
  if (value >= 10_000)    return `${Math.floor(value / 1_000)}K`;
  if (value >= 1_000)     return Math.round(value).toLocaleString("tr-TR");
  return value.toFixed(2);
}

interface TokenCardsProps {
  ayumo?: number;
  ryumo?: number;
  yumo?: number;
}

export function TokenCards({ ayumo = 0, ryumo = 0, yumo = 0 }: TokenCardsProps) {
  const tokens = [
    {
      key: "aYUMO",
      label: "aYUMO",
      desc: "Proof of Expenditure",
      display: fmtToken(ayumo),
      color: "#C9A84C",
      active: ayumo > 0,
    },
    {
      key: "rYUMO",
      label: "rYUMO",
      desc: "Quest ödülü",
      display: fmtToken(ryumo),
      color: "#34D399",
      active: ryumo > 0,
    },
    {
      key: "YUMO",
      label: "YUMO",
      desc: "Solana blockchain",
      display: fmtToken(yumo),
      color: "var(--app-text-muted)",
      active: false,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Başlık */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 2px" }}>
        <p style={{
          fontSize: 10, fontWeight: 700, letterSpacing: "0.14em",
          color: "var(--app-text-muted)", textTransform: "uppercase",
        }}>
          Token Bakiyeleri
        </p>
      </div>

      {tokens.map(t => (
        <div key={t.key} style={{
          background: "var(--app-bg-elevated)",
          borderRadius: 14,
          border: `1px solid ${t.active ? t.color + "22" : "var(--app-border)"}`,
          padding: "14px 16px",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          {/* Token ikonu */}
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: t.active ? `${t.color}14` : "var(--app-bg-surface)",
            border: `1px solid ${t.active ? t.color + "30" : "var(--app-border)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800,
            color: t.active ? t.color : "var(--app-text-muted)",
          }}>
            ⟁
          </div>

          {/* İsim + açıklama */}
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: t.active ? "var(--app-text-primary)" : "var(--app-text-muted)" }}>
              {t.label}
            </p>
            <p style={{ fontSize: 11, color: "var(--app-text-muted)", marginTop: 2 }}>{t.desc}</p>
          </div>

          {/* Bakiye */}
          <div style={{ textAlign: "right" }}>
            <p style={{
              fontSize: 18, fontWeight: 700,
              fontFamily: "monospace", color: t.color,
              letterSpacing: "-0.01em",
            }}>
              {t.display}
            </p>
            {t.active
              ? <p style={{ fontSize: 11, color: "#34D399", marginTop: 3, fontFamily: "monospace" }}>aktif</p>
              : <p style={{ fontSize: 11, color: "var(--app-text-muted)", marginTop: 3 }}>Henüz yok</p>
            }
          </div>
        </div>
      ))}
    </div>
  );
}
