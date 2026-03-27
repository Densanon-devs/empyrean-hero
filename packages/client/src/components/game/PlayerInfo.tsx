import { useState } from 'react';
import type { PlayerState } from '@empyrean-hero/engine';
import DiscardPileModal from './DiscardPileModal';

// ─────────────────────────────────────────────────────────────────────────────
// PlayerInfo — compact player status bar (name, SkyBase, card counts)
// ─────────────────────────────────────────────────────────────────────────────

interface PlayerInfoProps {
  player: PlayerState;
  isCurrentTurn: boolean;
  isMe?: boolean;
}

export default function PlayerInfo({ player, isCurrentTurn, isMe = false }: PlayerInfoProps) {
  const [showDiscard, setShowDiscard] = useState(false);

  return (
    <>
      <div
        className={[
          'flex items-center gap-2 rounded-xl px-3 py-2 text-xs transition-all',
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

        {/* Card count — hand count is always visible (rule: share on request) */}
        <div className="flex-shrink-0 text-white/40 text-[10px] text-right leading-tight">
          <div title="Cards in hand">✋ {player.hand.length}</div>
          <div title="Cards in deck">🃏 {player.enhancementDeck.length}</div>
        </div>

        {/* Discard pile browser button */}
        {player.discardPile.length > 0 && (
          <button
            className="flex-shrink-0 text-white/30 hover:text-white/70 text-[10px] transition-colors"
            title={`View ${player.name}'s discard pile (${player.discardPile.length} cards)`}
            onClick={() => setShowDiscard(true)}
          >
            🗑 {player.discardPile.length}
          </button>
        )}

        {/* Special status badges */}
        {player.preventionActive && (
          <span className="flex-shrink-0 rounded px-1 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold" title="Prevention active — all attacks blocked this turn">
            PREVENT
          </span>
        )}

        {player.cannotPlayAbilityCards && (
          <span className="flex-shrink-0 rounded px-1 py-0.5 bg-orange-500/20 text-orange-300 text-[10px] font-bold" title="Hindra: cannot play ability cards this turn">
            LOCKED
          </span>
        )}

        {player.droughtActive && (
          <span className="flex-shrink-0 rounded px-1 py-0.5 bg-yellow-500/20 text-yellow-300 text-[10px] font-bold" title="Drought active — no abilities this turn">
            DROUGHT
          </span>
        )}

        {/* No-heroes warning */}
        {player.noHeroesTurnCount > 0 && (
          <span
            className="flex-shrink-0 rounded px-1 py-0.5 bg-red-500/20 text-red-400 text-[10px] font-bold"
            title={`${player.noHeroesTurnCount}/3 turns with no heroes — lose at 3`}
          >
            ⚠ {player.noHeroesTurnCount}/3
          </span>
        )}

        {player.isEliminated && (
          <span className="flex-shrink-0 rounded px-1.5 py-0.5 bg-red-900/60 text-red-300 text-[10px] font-bold">
            OUT
          </span>
        )}
      </div>

      {showDiscard && (
        <DiscardPileModal
          playerId={player.id}
          playerName={player.name}
          onClose={() => setShowDiscard(false)}
        />
      )}
    </>
  );
}
