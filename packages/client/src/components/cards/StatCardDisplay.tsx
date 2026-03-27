import type { StatCard } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// StatCardDisplay — renders a stat-boost card (ATT+20, DEF+30, etc.)
// ─────────────────────────────────────────────────────────────────────────────

interface StatCardDisplayProps {
  card: StatCard;
  className?: string;
  onClick?: () => void;
}

export default function StatCardDisplay({ card, className, onClick }: StatCardDisplayProps) {
  const isAtk = card.statType === 'ATT';

  return (
    <div
      className={[
        'flex flex-col items-center justify-center w-20 h-28 rounded-xl border cursor-pointer',
        isAtk
          ? 'border-red-400/50 bg-red-900/20'
          : 'border-blue-400/50 bg-blue-900/20',
        className ?? '',
      ].join(' ')}
      onClick={onClick}
    >
      <span className="text-2xl mb-1">{isAtk ? '⚔' : '🛡'}</span>
      <p className={`font-display font-bold text-xl ${isAtk ? 'text-red-300' : 'text-blue-300'}`}>
        +{card.value}
      </p>
      <p className="text-[10px] text-white/50 uppercase tracking-widest mt-0.5">
        {card.statType}
      </p>
    </div>
  );
}
