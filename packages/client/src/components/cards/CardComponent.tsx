import { useState } from 'react';
import type { AnyCard, HeroCard, AbilityCard, StatCard, HeroicFeatCard } from '@empyrean-hero/engine';
import HeroCardDisplay from './HeroCardDisplay';
import AbilityCardDisplay from './AbilityCardDisplay';
import StatCardDisplay from './StatCardDisplay';
import CardDetailModal from '../game/CardDetailModal';

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
  const [showDetail, setShowDetail] = useState(false);
  const [hovered, setHovered] = useState(false);

  function handleClick() {
    if (!disabled && onClick) onClick(card);
  }

  const wrapperClass = [
    'card-base',
    selected ? 'ring-2 ring-empyrean-gold shadow-glow' : '',
    disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : '',
    className ?? '',
  ].join(' ');

  let inner: React.ReactNode;
  switch (card.type) {
    case 'hero':
      inner = <HeroCardDisplay card={card} className={wrapperClass} onClick={handleClick} />;
      break;
    case 'ability':
    case 'heroic-feat':
      inner = <AbilityCardDisplay card={card} className={wrapperClass} onClick={handleClick} />;
      break;
    case 'stat':
      inner = <StatCardDisplay card={card} className={wrapperClass} onClick={handleClick} />;
      break;
    case 'sky-base':
      inner = (
        <div className={`${wrapperClass} p-3 text-center`} onClick={handleClick}>
          <p className="text-xs uppercase tracking-widest text-empyrean-gold/60 mb-1">Sky Base</p>
          <p className="font-display text-sm font-bold text-white">{card.name}</p>
          {card.defeated && <p className="text-xs text-red-400 mt-1">DESTROYED</p>}
        </div>
      );
      break;
    case 'reference':
      inner = (
        <div className={`${wrapperClass} p-3`} onClick={handleClick}>
          <p className="text-xs text-white/60">{card.content}</p>
        </div>
      );
      break;
    default:
      return null;
  }

  return (
    <>
      <div
        className="relative"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {inner}
        {/* Info button — appears on hover for cards with detail views */}
        {hovered && !disabled && (card.type === 'hero' || card.type === 'ability' || card.type === 'stat' || card.type === 'heroic-feat') && (
          <button
            className="absolute top-1 left-1 w-4 h-4 rounded-full bg-black/60 border border-white/30 text-white/70 text-[9px] flex items-center justify-center hover:bg-black/80 hover:text-white transition-colors z-10"
            title="Card details"
            onClick={(e) => { e.stopPropagation(); setShowDetail(true); }}
          >
            ℹ
          </button>
        )}
      </div>

      {showDetail && (card.type === 'hero' || card.type === 'ability' || card.type === 'stat' || card.type === 'heroic-feat') && (
        <CardDetailModal card={card as HeroCard | AbilityCard | StatCard | HeroicFeatCard} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
}
