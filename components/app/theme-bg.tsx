"use client";

/**
 * Sabit slate+gold arka plan — tier bazlı renk değişimi kaldırıldı.
 * DS: bg=#0F1117, tek statik gold glow köşede.
 */
export function ThemeBg({ accountLevel: _accountLevel, className }: { accountLevel?: number; className?: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className ?? ""}`}
      style={{ background: "#0F1117" }}
    >
      {/* Statik gold glow — sol üst köşe */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "-5%",
          width: "55%",
          height: "45%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(201,168,76,0.07) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
      {/* Statik muted glow — sağ alt */}
      <div
        style={{
          position: "absolute",
          bottom: "-8%",
          right: "-5%",
          width: "45%",
          height: "40%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse at center, rgba(100,60,8,0.04) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
