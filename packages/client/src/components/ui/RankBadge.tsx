import type { RankTier } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// Rank tier SVG badges
// ─────────────────────────────────────────────────────────────────────────────

interface RankBadgeProps {
  tier: RankTier;
  size?: number;
  className?: string;
  showLabel?: boolean;
}

const TIER_COLORS: Record<RankTier, { fill: string; stroke: string; label: string }> = {
  Bronze:   { fill: '#7c3a1b', stroke: '#cd7f32', label: '#e8a96a' },
  Silver:   { fill: '#3a3a4a', stroke: '#c0c0c0', label: '#e0e0e0' },
  Gold:     { fill: '#5a4000', stroke: '#ffd700', label: '#ffe566' },
  Platinum: { fill: '#003a4a', stroke: '#00b4d8', label: '#4dd9f0' },
  Diamond:  { fill: '#001a4a', stroke: '#4895ef', label: '#7ab8ff' },
  Empyrean: { fill: '#3a2800', stroke: '#d4af37', label: '#f5d060' },
};

function BronzeBadge({ size, colors }: { size: number; colors: typeof TIER_COLORS.Bronze }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path
        d="M20 3 L35 12 L35 28 L20 37 L5 28 L5 12 Z"
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="2"
      />
      <path
        d="M20 8 L30 14 L30 26 L20 32 L10 26 L10 14 Z"
        fill="none"
        stroke={colors.stroke}
        strokeWidth="1"
        opacity="0.4"
      />
      <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="bold" fill={colors.label} fontFamily="sans-serif">B</text>
    </svg>
  );
}

function SilverBadge({ size, colors }: { size: number; colors: typeof TIER_COLORS.Silver }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path
        d="M20 3 L35 12 L35 28 L20 37 L5 28 L5 12 Z"
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="2"
      />
      <path
        d="M20 8 L30 14 L30 26 L20 32 L10 26 L10 14 Z"
        fill="none"
        stroke={colors.stroke}
        strokeWidth="1"
        opacity="0.5"
      />
      <line x1="14" y1="20" x2="26" y2="20" stroke={colors.label} strokeWidth="1.5" opacity="0.6" />
      <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="bold" fill={colors.label} fontFamily="sans-serif">S</text>
    </svg>
  );
}

function GoldBadge({ size, colors }: { size: number; colors: typeof TIER_COLORS.Gold }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path
        d="M20 3 L35 12 L35 28 L20 37 L5 28 L5 12 Z"
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="2.5"
      />
      <path
        d="M20 9 L29 14.5 L29 25.5 L20 31 L11 25.5 L11 14.5 Z"
        fill="none"
        stroke={colors.stroke}
        strokeWidth="1"
        opacity="0.5"
      />
      <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="bold" fill={colors.label} fontFamily="sans-serif">G</text>
    </svg>
  );
}

function PlatinumBadge({ size, colors }: { size: number; colors: typeof TIER_COLORS.Platinum }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <path
        d="M20 3 L35 12 L35 28 L20 37 L5 28 L5 12 Z"
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="2.5"
      />
      <path
        d="M20 9 L29 14.5 L29 25.5 L20 31 L11 25.5 L11 14.5 Z"
        fill="none"
        stroke={colors.stroke}
        strokeWidth="1"
        opacity="0.6"
      />
      <circle cx="20" cy="20" r="3" fill={colors.stroke} opacity="0.7" />
      <text x="20" y="24" textAnchor="middle" fontSize="9" fontWeight="bold" fill={colors.label} fontFamily="sans-serif">PT</text>
    </svg>
  );
}

function DiamondBadge({ size, colors }: { size: number; colors: typeof TIER_COLORS.Diamond }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Diamond shape */}
      <path
        d="M20 4 L36 20 L20 36 L4 20 Z"
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="2"
      />
      <path
        d="M20 10 L30 20 L20 30 L10 20 Z"
        fill="none"
        stroke={colors.stroke}
        strokeWidth="1"
        opacity="0.5"
      />
      <text x="20" y="24" textAnchor="middle" fontSize="9" fontWeight="bold" fill={colors.label} fontFamily="sans-serif">DIA</text>
    </svg>
  );
}

function EmpyreanBadge({ size, colors }: { size: number; colors: typeof TIER_COLORS.Empyrean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      {/* Winged emblem */}
      {/* Body / central shield */}
      <path
        d="M20 6 L27 14 L27 26 L20 34 L13 26 L13 14 Z"
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="2"
      />
      {/* Left wing */}
      <path
        d="M13 14 L3 10 L6 18 L13 20 Z"
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="1.5"
        opacity="0.9"
      />
      {/* Right wing */}
      <path
        d="M27 14 L37 10 L34 18 L27 20 Z"
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="1.5"
        opacity="0.9"
      />
      {/* Crown dots */}
      <circle cx="16" cy="11" r="1.2" fill={colors.stroke} />
      <circle cx="20" cy="9"  r="1.2" fill={colors.stroke} />
      <circle cx="24" cy="11" r="1.2" fill={colors.stroke} />
      {/* Inner star glow */}
      <text x="20" y="24" textAnchor="middle" fontSize="8" fontWeight="bold" fill={colors.label} fontFamily="sans-serif">EMP</text>
    </svg>
  );
}

export function RankBadge({ tier, size = 32, className = '', showLabel = false }: RankBadgeProps) {
  const colors = TIER_COLORS[tier];
  const BadgeMap = {
    Bronze:   BronzeBadge,
    Silver:   SilverBadge,
    Gold:     GoldBadge,
    Platinum: PlatinumBadge,
    Diamond:  DiamondBadge,
    Empyrean: EmpyreanBadge,
  };
  const BadgeComponent = BadgeMap[tier];

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <BadgeComponent size={size} colors={colors} />
      {showLabel && (
        <span className="text-sm font-semibold" style={{ color: colors.stroke }}>
          {tier}
        </span>
      )}
    </span>
  );
}

export function getRankColor(tier: RankTier): string {
  return TIER_COLORS[tier]?.stroke ?? '#fff';
}
