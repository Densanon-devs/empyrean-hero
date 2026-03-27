import type { HeroCard } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// HeroCardDisplay — renders a HeroCard with stats, ability, and illustration
// ─────────────────────────────────────────────────────────────────────────────

const ABILITY_TYPE_STYLES: Record<string, string> = {
  A: 'bg-blue-500/20 text-blue-300 border-blue-400/40',
  P: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
  H: 'bg-empyrean-gold/20 text-empyrean-gold border-empyrean-gold/40',
};

interface HeroCardDisplayProps {
  card: HeroCard;
  fatigued?: boolean;
  className?: string;
  onClick?: () => void;
}

export default function HeroCardDisplay({ card, fatigued, className, onClick }: HeroCardDisplayProps) {
  const { ability } = card;
  const abilityStyle = ABILITY_TYPE_STYLES[ability.abilityType] ?? '';

  return (
    <div
      className={[
        'flex flex-col w-32 h-48 rounded-xl overflow-hidden text-xs select-none',
        fatigued ? 'fatigued' : '',
        className ?? '',
      ].join(' ')}
      onClick={onClick}
    >
      {/* Illustration area */}
      <div className="relative flex-1 bg-empyrean-navy/80 flex items-center justify-center overflow-hidden">
        <img
          src={`/assets/${card.illustrationRef}`}
          alt={card.heroName}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback placeholder when image not yet available
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

      {/* Ability chip */}
      <div className={`flex items-center gap-1 px-2 py-1 border-t ${abilityStyle}`}>
        <span className="font-bold">{ability.abilityType}</span>
        <span className="truncate text-[10px]">{ability.name}</span>
      </div>
    </div>
  );
}
