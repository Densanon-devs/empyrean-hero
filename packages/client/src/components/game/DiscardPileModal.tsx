import { useState } from 'react';
import Modal from '../ui/Modal';
import CardComponent from '../cards/CardComponent';
import CardDetailModal from './CardDetailModal';
import { useGameContext } from '../../context/GameContext';
import type { AbilityCard, StatCard } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// DiscardPileModal — browse any player's discard pile
// Rules: players may look through any discard pile at any time
// ─────────────────────────────────────────────────────────────────────────────

interface DiscardPileModalProps {
  playerId: string;
  playerName: string;
  onClose: () => void;
}

export default function DiscardPileModal({ playerId, playerName, onClose }: DiscardPileModalProps) {
  const { gameState } = useGameContext();
  const [detailCard, setDetailCard] = useState<AbilityCard | StatCard | null>(null);

  const player = gameState?.players[playerId];
  const discard = player?.discardPile ?? [];

  return (
    <>
      <Modal
        title={`🗑 ${playerName}'s Discard Pile (${discard.length})`}
        onClose={onClose}
        size="xl"
      >
        <div className="space-y-3">
          {discard.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 py-10 text-center">
              <p className="text-white/35 italic text-sm">Discard pile is empty.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-white/40">
                Click any card for details. Discard pile is public — any player may look through it at any time.
              </p>
              <div className="flex flex-wrap gap-3">
                {[...discard].reverse().map((card, i) => (
                  <div
                    key={`${card.id}-${i}`}
                    className="cursor-pointer hover:scale-105 transition-transform opacity-80 hover:opacity-100"
                    onClick={() => setDetailCard(card)}
                  >
                    <CardComponent card={card} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>

      {detailCard && (
        <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />
      )}
    </>
  );
}
