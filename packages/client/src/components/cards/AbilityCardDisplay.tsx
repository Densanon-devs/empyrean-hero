import type { AbilityCard, HeroicFeatCard } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// AbilityCardDisplay — renders an AbilityCard or HeroicFeatCard
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, { border: string; badge: string; label: string }> = {
  A: { border: 'border-blue-400/40', badge: 'bg-blue-500/20 text-blue-300', label: 'Active' },
  P: { border: 'border-purple-400/40', badge: 'bg-purple-500/20 text-purple-300', label: 'Passive' },
  H: { border: 'border-empyrean-gold/60', badge: 'bg-empyrean-gold/20 text-empyrean-gold', label: 'Heroic Feat' },
};

interface AbilityCardDisplayProps {
  card: AbilityCard | HeroicFeatCard;
  className?: string;
  onClick?: () => void;
}

export default function AbilityCardDisplay({ card, className, onClick }: AbilityCardDisplayProps) {
  const abilityType = card.type === 'heroic-feat' ? 'H' : card.abilityType;
  const colors = TYPE_COLORS[abilityType] ?? TYPE_COLORS['A']!;

  return (
    <div
      className={[
        'flex flex-col w-28 h-40 rounded-xl overflow-hidden border p-2 gap-1',
        colors.border,
        'bg-empyrean-navy cursor-pointer',
        className ?? '',
      ].join(' ')}
      onClick={onClick}
    >
      {/* Type badge */}
      <span className={`self-start rounded px-1.5 py-0.5 text-[10px] font-bold ${colors.badge}`}>
        ({abilityType}) {colors.label}
      </span>

      {/* Name */}
      <p className="font-display font-bold text-white text-sm leading-tight mt-1">
        {card.name}
      </p>

      {/* Description */}
      <p className="text-[10px] text-white/60 leading-tight flex-1 overflow-hidden line-clamp-4">
        {card.description}
      </p>

      {card.type === 'heroic-feat' && (
        <p className="text-[9px] text-empyrean-gold/70 italic">Once per game</p>
      )}
    </div>
  );
}
