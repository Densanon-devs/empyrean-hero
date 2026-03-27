import { useState } from 'react';
import Modal from '../ui/Modal';
import { useGameContext } from '../../context/GameContext';
import { useMyPlayer, useOpponents } from '../../hooks/useGameState';
import { getSocket } from '../../socket/client';
import type { HeroicFeatCard } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// HeroicFeatModal — play a Heroic Feat (replaces your entire turn)
// ─────────────────────────────────────────────────────────────────────────────

interface HeroicFeatModalProps {
  onClose: () => void;
}

export default function HeroicFeatModal({ onClose }: HeroicFeatModalProps) {
  const { playerId } = useGameContext();
  const me = useMyPlayer();
  const opponents = useOpponents();
  const [selectedFeatId, setSelectedFeatId] = useState<string | null>(null);
  const [targetPlayerId, setTargetPlayerId] = useState<string>(opponents[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  if (!me || !playerId) return null;

  const feats = me.heroicFeats;
  const selectedFeat = feats.find((f) => f.id === selectedFeatId);

  // Some feats need a target player (e.g. Drain, Under Siege)
  const featNeedsTarget = selectedFeat && ['Drain', 'Under Siege'].includes(selectedFeat.featName);

  function handleConfirm() {
    if (!selectedFeatId || !playerId) return;
    setError(null);
    getSocket().emit(
      'game:action',
      {
        type: 'USE_HEROIC_FEAT',
        playerId,
        featCardId: selectedFeatId,
        targetId: featNeedsTarget ? targetPlayerId : undefined,
      },
      (res) => {
        if (!res.success) {
          setError(res.error ?? 'Failed to use Heroic Feat');
        } else {
          onClose();
        }
      },
    );
  }

  const footer = (
    <div className="flex gap-3">
      <button className="btn-secondary flex-1 text-sm py-2.5" onClick={onClose}>Cancel</button>
      <button
        className="btn-primary flex-1 text-sm py-2.5"
        disabled={!selectedFeatId}
        onClick={handleConfirm}
      >
        Use Heroic Feat
      </button>
    </div>
  );

  return (
    <Modal title="🌟 Heroic Feat" onClose={onClose} size="xl" footer={footer}>
      <div className="space-y-4">
        <p className="text-sm text-white/60">
          Using a Heroic Feat <span className="text-red-400 font-semibold">replaces your entire turn</span>.
          Each feat can only be used once per game.
        </p>

        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-500/30 px-3 py-2 text-xs text-red-300">
            {error}
          </div>
        )}

        {feats.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 py-10 text-center">
            <p className="text-white/35 italic text-sm">All Heroic Feats have been used.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {feats.map((feat) => (
              <FeatCard
                key={feat.id}
                feat={feat}
                selected={selectedFeatId === feat.id}
                onClick={() => setSelectedFeatId(feat.id === selectedFeatId ? null : feat.id)}
              />
            ))}
          </div>
        )}

        {/* Target selector for feats that need an opponent target */}
        {featNeedsTarget && opponents.length > 0 && (
          <div>
            <p className="text-xs text-white/50 mb-1.5">Target opponent</p>
            <div className="flex gap-2 flex-wrap">
              {opponents.map((opp) => (
                <button
                  key={opp.id}
                  className={[
                    'rounded-lg px-3 py-1.5 text-sm border transition-all',
                    targetPlayerId === opp.id
                      ? 'border-empyrean-gold text-empyrean-gold bg-empyrean-gold/10'
                      : 'border-white/20 text-white/60 hover:border-white/40',
                  ].join(' ')}
                  onClick={() => setTargetPlayerId(opp.id)}
                >
                  {opp.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function FeatCard({ feat, selected, onClick }: { feat: HeroicFeatCard; selected: boolean; onClick: () => void }) {
  return (
    <div
      className={[
        'rounded-xl border p-4 cursor-pointer transition-all duration-150',
        selected
          ? 'border-empyrean-gold bg-empyrean-gold/10 shadow-glow'
          : 'border-white/15 bg-white/5 hover:border-white/30',
      ].join(' ')}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-empyrean-gold/20 border border-empyrean-gold/40 w-8 h-8 flex items-center justify-center text-lg shrink-0">
          🌟
        </div>
        <div className="flex-1 min-w-0">
          <p className={`font-display font-bold text-sm ${selected ? 'text-empyrean-gold' : 'text-white'}`}>
            {feat.featName}
          </p>
          <p className="text-xs text-white/50 mt-1 leading-snug">{feat.description}</p>
        </div>
        {selected && (
          <div className="w-5 h-5 rounded-full bg-empyrean-gold flex items-center justify-center text-empyrean-navyDark text-[11px] font-bold shrink-0">
            ✓
          </div>
        )}
      </div>
    </div>
  );
}
