import type { AnyCard } from '@empyrean-hero/engine';
import HeroCardDisplay from './HeroCardDisplay';
import AbilityCardDisplay from './AbilityCardDisplay';
import StatCardDisplay from './StatCardDisplay';

// ─────────────────────────────────────────────────────────────────────────────
// CardComponent — unified renderer that dispatches to the right card display
// ─────────────────────────────────────────────────────────────────────────────

interface CardComponentProps {
  card: AnyCard;
  /** Show as selected / highlighted */
  selected?: boolean;
  /** Gray out and prevent interaction */
  disabled?: boolean;
  onClick?: (card: AnyCard) => void;
  className?: string;
}

export default function CardComponent({ card, selected, disabled, onClick, className }: CardComponentProps) {
  function handleClick() {
    if (!disabled && onClick) onClick(card);
  }

  const wrapperClass = [
    'card-base',
    selected ? 'ring-2 ring-empyrean-gold shadow-glow' : '',
    disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : '',
    className ?? '',
  ].join(' ');

  switch (card.type) {
    case 'hero':
      return <HeroCardDisplay card={card} className={wrapperClass} onClick={handleClick} />;
    case 'ability':
    case 'heroic-feat':
      return <AbilityCardDisplay card={card} className={wrapperClass} onClick={handleClick} />;
    case 'stat':
      return <StatCardDisplay card={card} className={wrapperClass} onClick={handleClick} />;
    case 'sky-base':
      return (
        <div className={`${wrapperClass} p-3 text-center`} onClick={handleClick}>
          <p className="text-xs uppercase tracking-widest text-empyrean-gold/60 mb-1">Sky Base</p>
          <p className="font-display text-sm font-bold text-white">{card.name}</p>
          {card.defeated && (
            <p className="text-xs text-red-400 mt-1">DESTROYED</p>
          )}
        </div>
      );
    case 'reference':
      return (
        <div className={`${wrapperClass} p-3`} onClick={handleClick}>
          <p className="text-xs text-white/60">{card.content}</p>
        </div>
      );
    default:
      return null;
  }
}
