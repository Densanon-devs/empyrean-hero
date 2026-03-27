import { useState } from 'react';
import Modal from '../ui/Modal';
import HeroCardDisplay from '../cards/HeroCardDisplay';
import { useGameContext } from '../../context/GameContext';
import { useMyPlayer } from '../../hooks/useGameState';
import { getSocket } from '../../socket/client';

// ─────────────────────────────────────────────────────────────────────────────
// RecruitModal — deploy up to 2 heroes from your pool into the arena
// ─────────────────────────────────────────────────────────────────────────────

interface RecruitModalProps {
  onClose: () => void;
}

export default function RecruitModal({ onClose }: RecruitModalProps) {
  const { playerId } = useGameContext();
  const me = useMyPlayer();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  if (!me || !playerId) return null;

  const pool = me.heroPool;

  function toggleHero(instanceId: string) {
    setSelectedIds((prev) => {
      if (prev.includes(instanceId)) return prev.filter((x) => x !== instanceId);
      if (prev.length >= 2) return prev;
      return [...prev, instanceId];
    });
  }

  function handleConfirm() {
    getSocket().emit(
      'game:action',
      { type: 'RECRUIT', playerId: playerId!, heroInstanceIds: selectedIds },
      () => {},
    );
    onClose();
  }

  const footer = (
    <div className="flex gap-3">
      <button className="btn-secondary flex-1 text-sm py-2.5" onClick={onClose}>Cancel</button>
      <button
        className="btn-primary flex-1 text-sm py-2.5"
        disabled={selectedIds.length === 0}
        onClick={handleConfirm}
      >
        Deploy {selectedIds.length > 0 ? selectedIds.length : ''} Hero{selectedIds.length !== 1 ? 'es' : ''}
      </button>
    </div>
  );

  return (
    <Modal title="➕ Recruit — Deploy Heroes" onClose={onClose} size="xl" footer={footer}>
      <div className="space-y-4">
        {/* Capacity indicator */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-white/60">
            Choose up to 2 heroes from your reserves to deploy to the arena.
          </p>
          <div className="flex gap-1 shrink-0 ml-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={[
                  'w-6 h-6 rounded-full border-2 transition-colors',
                  i < selectedIds.length
                    ? 'border-empyrean-gold bg-empyrean-gold/30'
                    : 'border-white/20',
                ].join(' ')}
              />
            ))}
          </div>
        </div>

        {/* Arena context */}
        {me.arena.length > 0 && (
          <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-white/50">
            Already in arena: {me.arena.map((h) => h.heroCard.heroName).join(', ')}
          </div>
        )}

        {/* Hero pool grid */}
        {pool.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 py-12 text-center">
            <p className="text-white/35 italic text-sm">All your heroes are already deployed.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {pool.map((arenaHero) => {
              const selected = selectedIds.includes(arenaHero.instanceId);
              const atMax = selectedIds.length >= 2;
              const disabled = !selected && atMax;

              return (
                <div
                  key={arenaHero.instanceId}
                  className={[
                    'relative rounded-xl transition-all duration-150',
                    disabled
                      ? 'opacity-35 cursor-not-allowed'
                      : selected
                        ? 'cursor-pointer ring-2 ring-purple-400 scale-105 shadow-[0_0_14px_rgba(168,85,247,0.5)]'
                        : 'cursor-pointer hover:scale-105 hover:ring-2 hover:ring-white/30',
                  ].join(' ')}
                  onClick={() => !disabled && toggleHero(arenaHero.instanceId)}
                  title={disabled ? 'Max 2 heroes per Recruit' : arenaHero.heroCard.heroName}
                >
                  <HeroCardDisplay card={arenaHero.heroCard} />

                  {/* Selection order badge */}
                  {selected && (
                    <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-purple-400 flex items-center justify-center text-white text-[11px] font-bold shadow pointer-events-none">
                      {selectedIds.indexOf(arenaHero.instanceId) + 1}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Stats footer line */}
        <p className="text-xs text-white/30">
          {pool.length} hero{pool.length !== 1 ? 'es' : ''} in reserves ·{' '}
          {me.defeatedHeroes.length} defeated
          {me.defeatedHeroes.length > 0 && ' (use Resurrect to restore)'}
        </p>
      </div>
    </Modal>
  );
}
