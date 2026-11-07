import type { SVGProps } from "react";

/**
 * The Vanta "V" mark — two gradient blades (royal blue → cyan, gold →
 * amber) locked into a chevron, wrapped by the gold growth swoosh with a
 * rising bar chart at its tip. Mirrors logo.jpg.
 */
export function VantaMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 128 104"
      role="img"
      aria-label="Vanta Fintech"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id="vf-blue" x1="14" y1="4" x2="72" y2="92" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7FE4FF" />
          <stop offset="38%" stopColor="#2B7BFF" />
          <stop offset="100%" stopColor="#0B2AB8" />
        </linearGradient>
        <linearGradient id="vf-cyan" x1="20" y1="6" x2="50" y2="52" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#B6F3FF" />
          <stop offset="100%" stopColor="#31C6FF" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="vf-gold" x1="70" y1="4" x2="112" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFF3BE" />
          <stop offset="35%" stopColor="#FFD54A" />
          <stop offset="100%" stopColor="#E39A00" />
        </linearGradient>
        <linearGradient id="vf-swoosh" x1="8" y1="70" x2="120" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFB800" />
          <stop offset="45%" stopColor="#FFE68A" />
          <stop offset="100%" stopColor="#FFC20E" />
        </linearGradient>
        <filter id="vf-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* left blade */}
      <path d="M10 6h26l27 56-13 30z" fill="url(#vf-blue)" />
      <path d="M10 6h11l27 56-6 13z" fill="url(#vf-cyan)" opacity="0.9" />

      {/* right blade */}
      <path d="M92 6h26L79 92 66 62z" fill="url(#vf-gold)" />
      <path d="M92 6h9l-30 74-5-11z" fill="#FFF0B0" opacity="0.55" />

      {/* growth bars at the tip of the swoosh */}
      <g fill="url(#vf-gold)">
        <rect x="95" y="34" width="6" height="15" rx="1.6" />
        <rect x="104" y="26" width="6" height="23" rx="1.6" />
        <rect x="113" y="18" width="6" height="31" rx="1.6" />
      </g>

      {/* gold swoosh */}
      <path
        d="M6 74c0 12 26 22 58 22 30 0 58-9 58-21 0-3-1-5-2-7 1 4 0 8-4 11-9 8-30 12-52 12-26 0-46-6-50-14-2-3-1-6 1-8-6 1-9 3-9 7z"
        fill="url(#vf-swoosh)"
        opacity="0.95"
      />
      <path
        d="M6 74c-1 4 3 7 8 9 10 5 28 8 50 8 26 0 48-5 56-14"
        fill="none"
        stroke="url(#vf-swoosh)"
        strokeWidth="6"
        strokeLinecap="round"
        filter="url(#vf-glow)"
      />
    </svg>
  );
}

export function BarSpark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 80 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="bar-gold" x1="0" y1="0" x2="0" y2="32">
          <stop offset="0%" stopColor="#FFE68A" />
          <stop offset="100%" stopColor="#E39A00" />
        </linearGradient>
      </defs>
      <rect x="2" y="20" width="9" height="12" rx="2" fill="url(#bar-gold)" />
      <rect x="16" y="14" width="9" height="18" rx="2" fill="url(#bar-gold)" />
      <rect x="30" y="8" width="9" height="24" rx="2" fill="url(#bar-gold)" />
      <rect x="44" y="12" width="9" height="20" rx="2" fill="url(#bar-gold)" opacity="0.75" />
      <rect x="58" y="4" width="9" height="28" rx="2" fill="url(#bar-gold)" />
    </svg>
  );
}
