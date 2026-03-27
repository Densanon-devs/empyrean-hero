import type { PlayerState } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// PlayerInfo — compact player status bar (name, SkyBase, card counts)
// ─────────────────────────────────────────────────────────────────────────────

interface PlayerInfoProps {
  player: PlayerState;
  isCurrentTurn: boolean;
  isMe?: boolean;
}

export default function PlayerInfo({ player, isCurrentTurn, isMe = false }: PlayerInfoProps) {
  return (
    <div
      className={[
        'flex items-center gap-3 rounded-xl px-3 py-2 text-xs transition-all',
        isCurrentTurn
          ? 'bg-empyrean-gold/10 border border-empyrean-gold/40'
          : 'bg-white/5 border border-white/10',
      ].join(' ')}
    >
      {/* Turn indicator */}
      <span
        className={`h-2 w-2 rounded-full flex-shrink-0 ${
          isCurrentTurn ? 'bg-empyrean-gold animate-pulse' : 'bg-white/20'
        }`}
      />

      {/* Name */}
      <span className={`font-display font-bold text-sm flex-1 truncate ${isMe ? 'text-empyrean-gold' : 'text-white'}`}>
        {player.name}
        {isMe && <span className="ml-1 text-[10px] text-white/40">(you)</span>}
      </span>

      {/* SkyBase status */}
      <span
        className={`flex-shrink-0 ${player.skyBase.defeated ? 'text-red-400' : 'text-empyrean-gold/70'}`}
        title={player.skyBase.defeated ? 'Sky Base destroyed' : 'Sky Base intact'}
      >
        {player.skyBase.defeated ? '💥' : '🏰'}
      </span>

      {/* Hero counts */}
      <div className="flex-shrink-0 text-white/50 text-[10px] text-right leading-tight">
        <div>Arena: {player.arena.length}</div>
        <div>Pool: {player.heroPool.length}</div>
      </div>

      {/* Card count */}
      <div className="flex-shrink-0 text-white/40 text-[10px] text-right leading-tight">
        <div>Hand: {player.hand.length}</div>
        <div>Deck: {player.enhancementDeck.length}</div>
      </div>

      {/* No-heroes warning */}
      {player.noHeroesTurnCount > 0 && (
        <span
          className="flex-shrink-0 rounded px-1 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold"
          title={`${player.noHeroesTurnCount}/3 turns with no heroes`}
        >
          ⚠ {player.noHeroesTurnCount}/3
        </span>
      )}

      {player.isEliminated && (
        <span className="flex-shrink-0 rounded px-1.5 py-0.5 bg-red-900/60 text-red-300 text-[10px] font-bold">
          ELIMINATED
        </span>
      )}
    </div>
  );
}
