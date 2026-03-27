import type { HeroCard } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// HeroCardDisplay — renders a HeroCard with stats, ability, and illustration
// ─────────────────────────────────────────────────────────────────────────────

const ABILITY_TYPE_STYLES: Record<string, string> = {
  A: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
  P: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
  H: 'bg-empyrean-gold/20 text-empyrean-gold border-empyrean-gold/40',
};

const ABILITY_TYPE_LABELS: Record<string, string> = {
  A: 'Active',
  P: 'Passive',
  H: 'Heroic Feat',
};

interface HeroCardDisplayProps {
  card: HeroCard;
  fatigued?: boolean;
  /**
   * 'compact' (default): fixed w-32 h-48, no description — used in gameplay arena.
   * 'draft': full-width, shows ability description — used in draft picker.
   */
  variant?: 'compact' | 'draft';
  className?: string;
  onClick?: () => void;
}

export default function HeroCardDisplay({
  card,
  fatigued,
  variant = 'compact',
  className,
  onClick,
}: HeroCardDisplayProps) {
  const { ability } = card;
  const abilityStyle = ABILITY_TYPE_STYLES[ability.abilityType] ?? '';
  const isDraft = variant === 'draft';

  return (
    <div
      className={[
        'flex flex-col rounded-xl overflow-hidden text-xs select-none',
        isDraft ? 'w-full' : 'w-32 h-48',
        fatigued ? 'fatigued' : '',
        className ?? '',
      ].join(' ')}
      onClick={onClick}
    >
      {/* Illustration area */}
      <div
        className={[
          'relative bg-empyrean-navy/80 flex items-center justify-center overflow-hidden',
          isDraft ? 'h-28' : 'flex-1',
        ].join(' ')}
      >
        <img
          src={`/assets/${card.illustrationRef}`}
          alt={card.heroName}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        {/* Hero name overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1">
          <p className="font-display font-bold text-white text-sm truncate">{card.heroName}</p>
        </div>
        {fatigued && (
          <div className="absolute top-1 right-1 rounded px-1 py-0.5 bg-black/60 text-yellow-400 text-[10px] font-bold">
            FATGD
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between bg-empyrean-navyDark px-2 py-1">
        <div className="flex items-center gap-1">
          <span className="text-red-400 font-bold">⚔</span>
          <span className="font-mono font-bold text-white">{card.attack}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-blue-400 font-bold">🛡</span>
          <span className="font-mono font-bold text-white">{card.defense}</span>
        </div>
      </div>

      {/* Ability section */}
      {isDraft ? (
        <div className={`border-t px-2 py-2 ${abilityStyle}`}>
          <div className="flex items-center gap-1 mb-1">
            <span className="font-bold text-[10px] rounded px-1 py-0.5 bg-black/20 shrink-0">
              ({ability.abilityType})
            </span>
            <span className="font-semibold text-[11px] truncate">{ability.name}</span>
            <span className="ml-auto text-[10px] opacity-60 shrink-0 pl-1">
              {ABILITY_TYPE_LABELS[ability.abilityType]}
            </span>
          </div>
          <p className="text-[10px] leading-snug opacity-90">{ability.description}</p>
        </div>
      ) : (
        <div className={`flex items-center gap-1 px-2 py-1 border-t ${abilityStyle}`}>
          <span className="font-bold">{ability.abilityType}</span>
          <span className="truncate text-[10px]">{ability.name}</span>
        </div>
      )}
    </div>
  );
}
