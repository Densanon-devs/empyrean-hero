import { useState } from 'react';
import { useMyPlayer } from '../../hooks/useGameState';
import { useGameContext } from '../../context/GameContext';
import { getSocket } from '../../socket/client';
import CardComponent from '../cards/CardComponent';
import type { AbilityCard, StatCard } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// Hand — displays the local player's current hand of enhancement cards
// ─────────────────────────────────────────────────────────────────────────────

export default function Hand() {
  const me = useMyPlayer();
  const { playerId } = useGameContext();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  if (!me || me.hand.length === 0) {
    return (
      <div className="flex items-center justify-center h-12 border-t border-white/10">
        <p className="text-xs text-white/30 italic">Hand is empty</p>
      </div>
    );
  }

  function handleCardClick(card: AbilityCard | StatCard) {
    setSelectedCardId((prev) => (prev === card.id ? null : card.id));
  }

  function handlePlayCard() {
    if (!selectedCardId || !playerId) return;
    const socket = getSocket();
    socket.emit('game:action', { type: 'PLAY_CARD', playerId, cardId: selectedCardId }, (res) => {
      if (res.success) setSelectedCardId(null);
    });
  }

  return (
    <div className="border-t border-white/10 pt-2">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <p className="text-xs text-white/50 uppercase tracking-wider">
          Hand ({me.hand.length})
        </p>
        {selectedCardId && (
          <button className="btn-primary text-xs px-3 py-1" onClick={handlePlayCard}>
            Play Card
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 px-1">
        {me.hand.map((card) => (
          <CardComponent
            key={card.id}
            card={card}
            selected={card.id === selectedCardId}
            onClick={() => handleCardClick(card as AbilityCard | StatCard)}
          />
        ))}
      </div>

      <p className="text-xs text-white/30 px-1 mt-1">
        Deck: {me.enhancementDeck.length} · Discard: {me.discardPile.length}
      </p>
    </div>
  );
}
