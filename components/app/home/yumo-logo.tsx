"use client";

import { useId, useMemo } from "react";
import { getTier } from "@/lib/theme/tiers";
import { useTheme } from "@/lib/theme/theme-context";

const GRAY = "#3a3a44";
const GRAY_DARK = "#2a2a32";

/** Her segment hangi level'da doluyor */
const SEGMENT_MILESTONES: { level: number }[] = [
  { level: 1 },   // 0: dot
  { level: 10 },  // 1: outer arc left (teal)
  { level: 20 },  // 2: outer arc top-right (grey)
  { level: 40 },  // 3: outer arc bottom-right (lime)
  { level: 30 },  // 4: arm top
  { level: 50 },  // 5: arm bottom
  { level: 70 },  // 6: arm left
  { level: 90 },  // 7: arm right
  { level: 60 },  // 8: diamond (hollow)
  { level: 80 },  // 9: 4 curved segments
  { level: 100 }, // 10: extra polish / inner glow
];

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

/** Dolu yay parçası (iç + dış yarıçap arası bant) — glossy gradient ile */
function ringSegmentPath(cx: number, cy: number, rOut: number, rIn: number, a1: number, a2: number): string {
  const [x1o, y1o] = polar(cx, cy, rOut, a1);
  const [x2o, y2o] = polar(cx, cy, rOut, a2);
  const [x2i, y2i] = polar(cx, cy, rIn, a2);
  const [x1i, y1i] = polar(cx, cy, rIn, a1);
  const large = (a2 - a1 + 360) % 360 > 180 ? 1 : 0;
  return `M ${x1o} ${y1o} A ${rOut} ${rOut} 0 ${large} 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${rIn} ${rIn} 0 ${large} 0 ${x1i} ${y1i} Z`;
}

const CX = 110;
const CY = 110;
const R_OUT = 92;
const R_IN = 72;

/** Referans: sol üst teal, sağ üst gri, sağ alt lime, sol alt boşluk (gap) */
const OUTER_SEGMENTS = [
  { a1: -95, a2: 55 },   // sol üst teal
  { a1: 60, a2: 155 },   // sağ üst gri
  { a1: 160, a2: 265 },  // sağ alt lime
  // 265 -> -95 arası gap (açık)
];

interface YumoLogoProps {
  accountLevel?: number;
  size?: number;
  className?: string;
}

/**
 * Yumo logosu — referans görsele göre: 3D parlak, gradient’li segmentler,
 * içi boş elmas, yuvarlatılmış kollar, kavisli pill parçalar, sol nokta.
 */
export function YumoLogo({
  accountLevel = 1,
  size = 48,
  className,
}: YumoLogoProps) {
  const id = useId().replace(/:/g, "");
  const { theme } = useTheme();
  const mode = theme === "light" ? "light" : "dark";
  const lvl = Math.max(1, Math.min(accountLevel ?? 1, 999));

  const tier = useMemo(() => getTier(lvl, mode), [lvl, mode]);
  const acc = tier.accent;
  const acc2 = tier.accent2;

  const isFilled = (i: number) => lvl >= SEGMENT_MILESTONES[i].level;
  const fillColor = (i: number) => (isFilled(i) ? acc : GRAY);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 220 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{
        display: "block",
        filter: `drop-shadow(0 2px 8px rgba(0,0,0,.4)) drop-shadow(0 4px 16px ${acc}30)`,
      }}
      aria-hidden
    >
      <defs>
        {/* Glossy gradient — ışık sol üstten, 3D his */}
        <linearGradient id={`gloss-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.35" />
          <stop offset="35%" stopColor="white" stopOpacity="0.08" />
          <stop offset="100%" stopColor="black" stopOpacity="0.15" />
        </linearGradient>

        <filter id={`soft-${id}`}>
          <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" result="blur" />
          <feOffset in="blur" dx="0" dy="1" result="offset" />
          <feComposite in="SourceGraphic" in2="offset" operator="over" />
        </filter>

        <radialGradient id={`bg-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1a1d22" />
          <stop offset="100%" stopColor="#0d0e12" />
        </radialGradient>
      </defs>

      {/* Arka plan */}
      <circle cx={CX} cy={CY} r="106" fill={`url(#bg-${id})`} />
      <circle cx={CX} cy={CY} r="106" fill="none" stroke={GRAY_DARK} strokeWidth="1" />

      {/* Dış halka — 3 dolu segment, gradient + gloss overlay */}
      {OUTER_SEGMENTS.map((seg, i) => {
        const color = i === 0 ? fillColor(1) : i === 1 ? fillColor(2) : fillColor(3);
        const d = ringSegmentPath(CX, CY, R_OUT, R_IN, seg.a1, seg.a2);
        return (
          <g key={i}>
            <path d={d} fill={color} />
            <path
              d={d}
              fill={`url(#gloss-${id})`}
              opacity={isFilled(i === 0 ? 1 : i === 1 ? 2 : 3) ? 1 : 0.3}
            />
          </g>
        );
      })}

      {/* İç sembol — fotoğrafa göre: elmas + haç (dikey uzun) + 3 kavisli yay (üst, sağ, alt) + sol nokta */}

      {/* 1. Merkez içi boş elmas */}
      <polygon
        points={`${CX},${CY - 12} ${CX + 12},${CY} ${CX},${CY + 12} ${CX - 12},${CY}`}
        fill="none"
        stroke={fillColor(8)}
        strokeWidth="2"
        strokeLinejoin="round"
        filter={isFilled(8) ? `url(#soft-${id})` : undefined}
      />

      {/* 2. Haç: 4 dikdörtgen kol — dikey (üst/alt) yataydan UZUN, elmastan uçlara, yuvarlak uçlar */}
      {/* Üst kol — dikey uzun (elmastan yukarı) */}
      <rect x={CX - 5} y={CY - 38} width={10} height={26} rx={5} ry={5} fill={fillColor(4)} filter={isFilled(4) ? `url(#soft-${id})` : undefined} />
      {/* Alt kol — dikey uzun */}
      <rect x={CX - 5} y={CY + 12} width={10} height={26} rx={5} ry={5} fill={fillColor(5)} filter={isFilled(5) ? `url(#soft-${id})` : undefined} />
      {/* Sol kol — yatay kısa (elmastan sola) */}
      <rect x={CX - 32} y={CY - 5} width={20} height={10} rx={5} ry={5} fill={fillColor(6)} filter={isFilled(6) ? `url(#soft-${id})` : undefined} />
      {/* Sağ kol — yatay kısa */}
      <rect x={CX + 12} y={CY - 5} width={20} height={10} rx={5} ry={5} fill={fillColor(7)} filter={isFilled(7) ? `url(#soft-${id})` : undefined} />

      {/* 3. Sadece 3 kavisli yay — üst, sağ, alt bar uçlarında dışa kıvrılan (SOLDADA YOK) */}
      <path d="M 102 74 Q 110 68 118 74" fill="none" stroke={fillColor(9)} strokeWidth="4" strokeLinecap="round" filter={isFilled(9) ? `url(#soft-${id})` : undefined} />
      <path d="M 102 146 Q 110 152 118 146" fill="none" stroke={fillColor(9)} strokeWidth="4" strokeLinecap="round" filter={isFilled(9) ? `url(#soft-${id})` : undefined} />
      <path d="M 134 102 Q 152 110 134 118" fill="none" stroke={fillColor(9)} strokeWidth="4" strokeLinecap="round" filter={isFilled(9) ? `url(#soft-${id})` : undefined} />

      {/* 4. Sol küçük dolu nokta — bar uçlarının radial mesafesinde, sadece solda */}
      <circle cx="76" cy="110" r="4" fill={fillColor(0)} filter={isFilled(0) ? `url(#soft-${id})` : undefined} />

      {/* Glow overlay — tam doluysa hafif parlama */}
      {lvl >= 100 && (
        <circle
          cx={CX}
          cy={CY}
          r={R_IN - 4}
          fill="none"
          stroke={acc}
          strokeWidth="1"
          opacity="0.2"
        />
      )}
    </svg>
  );
}

/** getLogoMilestoneStep — eski API uyumluluğu */
export function getLogoMilestoneStep(accountLevel: number): number {
  const lvl = Math.max(1, Math.min(accountLevel, 999));
  if (lvl >= 100) return 5;
  if (lvl >= 80) return 4;
  if (lvl >= 60) return 3;
  if (lvl >= 40) return 2;
  if (lvl >= 20) return 1;
  return 0;
}
