import Modal from '../ui/Modal';
import type { HeroCard, AbilityCard, StatCard, HeroicFeatCard } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// CardDetailModal — shows full card details when a card is clicked/hovered
// ─────────────────────────────────────────────────────────────────────────────

type AnyCard = HeroCard | AbilityCard | StatCard | HeroicFeatCard;

interface CardDetailModalProps {
  card: AnyCard;
  onClose: () => void;
}

export default function CardDetailModal({ card, onClose }: CardDetailModalProps) {
  return (
    <Modal title="Card Details" onClose={onClose} size="md">
      <div className="space-y-4">
        {card.type === 'hero' && <HeroDetail card={card as HeroCard} />}
        {card.type === 'ability' && <AbilityDetail card={card as AbilityCard} />}
        {card.type === 'stat' && <StatDetail card={card as StatCard} />}
        {card.type === 'heroic-feat' && <FeatDetail card={card as HeroicFeatCard} />}
      </div>
    </Modal>
  );
}

function HeroDetail({ card }: { card: HeroCard }) {
  const abilityTypeBadge: Record<string, string> = {
    A: 'bg-orange-500/20 text-orange-300 border-orange-400/40',
    P: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
    H: 'bg-empyrean-gold/20 text-empyrean-gold border-empyrean-gold/40',
  };
  const typeLabel: Record<string, string> = { A: 'Active', P: 'Passive', H: 'Heroic Feat' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-empyrean-gold">{card.heroName}</h2>
        <div className="flex gap-3 text-sm">
          <span className="rounded-lg bg-red-500/20 border border-red-400/30 px-2.5 py-1 text-red-300 font-mono font-bold">
            ⚔ {card.attack}
          </span>
          <span className="rounded-lg bg-blue-500/20 border border-blue-400/30 px-2.5 py-1 text-blue-300 font-mono font-bold">
            🛡 {card.defense}
          </span>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${abilityTypeBadge[card.ability.abilityType] ?? ''}`}>
            {typeLabel[card.ability.abilityType] ?? card.ability.abilityType}
          </span>
          <span className="text-sm font-semibold text-white">{card.ability.name}</span>
        </div>
        <p className="text-xs text-white/70 leading-relaxed">{card.ability.description}</p>
      </div>

      {card.lore && (
        <p className="text-xs text-white/30 italic border-l-2 border-white/10 pl-3">{card.lore}</p>
      )}
    </div>
  );
}

function AbilityDetail({ card }: { card: AbilityCard }) {
  const abilityTypeBadge: Record<string, string> = {
    A: 'bg-orange-500/20 text-orange-300 border-orange-400/40',
    P: 'bg-purple-500/20 text-purple-300 border-purple-400/40',
    H: 'bg-empyrean-gold/20 text-empyrean-gold border-empyrean-gold/40',
  };
  const typeLabel: Record<string, string> = { A: 'Active', P: 'Passive', H: 'Heroic Feat' };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${abilityTypeBadge[card.abilityType] ?? ''}`}>
          {typeLabel[card.abilityType] ?? card.abilityType}
        </span>
        <h2 className="font-display text-lg font-bold text-white">{card.name}</h2>
      </div>
      <p className="text-sm text-white/70 leading-relaxed">{card.description}</p>
      {card.abilityType === 'A' && (
        <p className="text-xs text-orange-300/70">
          Active: Play from hand to trigger immediately. Goes to discard after use.
        </p>
      )}
      {card.abilityType === 'P' && (
        <p className="text-xs text-purple-300/70">
          Passive: Play to the field attached to a hero. Remains until removed by a game effect.
        </p>
      )}
    </div>
  );
}

function StatDetail({ card }: { card: StatCard }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className={`rounded-xl px-5 py-3 text-2xl font-display font-bold border ${card.statType === 'ATT' ? 'bg-red-500/20 text-red-300 border-red-400/30' : 'bg-blue-500/20 text-blue-300 border-blue-400/30'}`}>
          +{card.value} {card.statType}
        </div>
        <div>
          <p className="font-semibold text-white">{card.name}</p>
          <p className="text-xs text-white/40 mt-0.5">
            Permanently attached to a hero.
          </p>
        </div>
      </div>
      <p className="text-sm text-white/60">
        {card.statType === 'ATT'
          ? `Increases the attached hero's ATK by ${card.value} permanently.`
          : `Increases the attached hero's DEF by ${card.value} permanently.`}
      </p>
    </div>
  );
}

function FeatDetail({ card }: { card: HeroicFeatCard }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="rounded-full border bg-empyrean-gold/20 text-empyrean-gold border-empyrean-gold/40 px-2 py-0.5 text-[10px] font-bold">
          Heroic Feat
        </span>
        <h2 className="font-display text-lg font-bold text-empyrean-gold">{card.featName}</h2>
      </div>
      <p className="text-sm text-white/70 leading-relaxed">{card.description}</p>
      <p className="text-xs text-empyrean-gold/50">
        Replaces your entire turn when used. Can only be used once per game.
      </p>
    </div>
  );
}
