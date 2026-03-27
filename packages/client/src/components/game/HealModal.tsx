import { useState } from 'react';
import Modal from '../ui/Modal';
import HeroCardDisplay from '../cards/HeroCardDisplay';
import CardComponent from '../cards/CardComponent';
import { useGameContext } from '../../context/GameContext';
import { useMyPlayer, useOpponents } from '../../hooks/useGameState';
import { getSocket } from '../../socket/client';
import type { ArenaHero } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// HealModal — select fatigued heroes to un-fatigue, then optionally play cards
// ─────────────────────────────────────────────────────────────────────────────

interface HealModalProps {
  onClose: () => void;
}

type Step = 'heroes' | 'cards';

export default function HealModal({ onClose }: HealModalProps) {
  const { playerId } = useGameContext();
  const me = useMyPlayer();
  const opponents = useOpponents();

  const [step, setStep] = useState<Step>('heroes');
  const [selectedHeroIds, setSelectedHeroIds] = useState<string[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  if (!me || !playerId) return null;

  // All fatigued heroes across every player's arena
  const fatiguedHeroes: Array<{ hero: ArenaHero; playerName: string; isMe: boolean }> = [];
  for (const hero of me.arena) {
    if (hero.fatigued) fatiguedHeroes.push({ hero, playerName: me.name, isMe: true });
  }
  for (const opp of opponents) {
    for (const hero of opp.arena) {
      if (hero.fatigued) fatiguedHeroes.push({ hero, playerName: opp.name, isMe: false });
    }
  }

  function toggleHero(id: string) {
    setSelectedHeroIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleCard(id: string) {
    setSelectedCardIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  function handleConfirm() {
    getSocket().emit(
      'game:action',
      { type: 'HEAL', playerId: playerId!, targetHeroInstanceIds: selectedHeroIds, cardIds: selectedCardIds },
      () => {},
    );
    onClose();
  }

  // ── Footer per step ──────────────────────────────────────────────────────

  const heroStepFooter = (
    <div className="flex gap-3">
      <button className="btn-secondary flex-1 text-sm py-2.5" onClick={onClose}>
        Cancel
      </button>
      <button
        className="btn-primary flex-1 text-sm py-2.5"
        disabled={selectedHeroIds.length === 0}
        onClick={() => setStep('cards')}
      >
        Next — Play Cards
        {selectedHeroIds.length > 0 && (
          <span className="ml-1.5 rounded-full bg-black/30 px-1.5 text-xs">
            {selectedHeroIds.length}
          </span>
        )}
      </button>
    </div>
  );

  const cardStepFooter = (
    <div className="flex gap-3">
      <button className="btn-secondary text-sm py-2.5 px-5" onClick={() => setStep('heroes')}>
        ← Back
      </button>
      <button className="btn-primary flex-1 text-sm py-2.5" onClick={handleConfirm}>
        Confirm Heal
        {selectedCardIds.length > 0 && (
          <span className="ml-1.5 opacity-80">
            + {selectedCardIds.length} card{selectedCardIds.length !== 1 ? 's' : ''}
          </span>
        )}
      </button>
    </div>
  );

  return (
    <Modal
      title="💚 Heal — Un-fatigue Heroes"
      onClose={onClose}
      size="xl"
      footer={step === 'heroes' ? heroStepFooter : cardStepFooter}
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-5">
        <StepDot n={1} label="Select Heroes" active={step === 'heroes'} done={step === 'cards'} />
        <div className="flex-1 h-px bg-white/10" />
        <StepDot n={2} label="Play Cards" active={step === 'cards'} done={false} />
      </div>

      {/* ── Step 1: choose fatigued heroes ─────────────────────────────────── */}
      {step === 'heroes' && (
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Choose 1 or more fatigued heroes to un-fatigue.
          </p>

          {fatiguedHeroes.length === 0 ? (
            <EmptySlate message="No fatigued heroes in any arena right now." />
          ) : (
            <div className="flex flex-wrap gap-4">
              {fatiguedHeroes.map(({ hero, playerName, isMe }) => {
                const selected = selectedHeroIds.includes(hero.instanceId);
                return (
                  <div
                    key={hero.instanceId}
                    className={[
                      'relative cursor-pointer rounded-xl transition-all duration-150',
                      selected
                        ? 'ring-2 ring-green-400 scale-105 shadow-[0_0_14px_rgba(74,222,128,0.5)]'
                        : 'hover:scale-105 hover:ring-2 hover:ring-white/30',
                    ].join(' ')}
                    onClick={() => toggleHero(hero.instanceId)}
                    title={`${hero.heroCard.heroName} — ${playerName}`}
                  >
                    <HeroCardDisplay card={hero.heroCard} fatigued />

                    {/* Owner badge */}
                    <div className="absolute -top-2.5 left-0 right-0 flex justify-center pointer-events-none">
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 text-[9px] font-semibold shadow',
                          isMe
                            ? 'bg-empyrean-gold/90 text-empyrean-navyDark'
                            : 'bg-white/20 text-white/80',
                        ].join(' ')}
                      >
                        {isMe ? 'You' : playerName}
                      </span>
                    </div>

                    {/* Check mark */}
                    {selected && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-400 flex items-center justify-center text-black text-[11px] font-bold shadow pointer-events-none">
                        ✓
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: play cards from hand ──────────────────────────────────── */}
      {step === 'cards' && (
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Optionally play up to 3 cards from your hand.{' '}
            <span className="text-white/40">({selectedCardIds.length}/3 selected)</span>
          </p>

          {me.hand.length === 0 ? (
            <EmptySlate message="Your hand is empty — nothing to play." />
          ) : (
            <div className="flex flex-wrap gap-3">
              {me.hand.map((card) => {
                const selected = selectedCardIds.includes(card.id);
                const atMax = selectedCardIds.length >= 3;
                const disabled = !selected && atMax;
                return (
                  <div
                    key={card.id}
                    className={[
                      'relative transition-all duration-150',
                      selected
                        ? 'scale-105 shadow-[0_0_12px_rgba(212,175,55,0.5)]'
                        : disabled
                          ? 'opacity-35 cursor-not-allowed'
                          : 'hover:scale-105 cursor-pointer',
                    ].join(' ')}
                    onClick={() => !disabled && toggleCard(card.id)}
                    title={disabled ? 'Max 3 cards' : card.name}
                  >
                    <CardComponent card={card} selected={selected} disabled={disabled} />
                    {selected && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-empyrean-gold flex items-center justify-center text-empyrean-navyDark text-[11px] font-bold shadow pointer-events-none">
                        ✓
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-xs text-white/30">
            Deck: {me.enhancementDeck.length} · Discard: {me.discardPile.length}
          </p>
        </div>
      )}
    </Modal>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div
        className={[
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
          done
            ? 'bg-green-500 text-white'
            : active
              ? 'bg-empyrean-gold text-empyrean-navyDark'
              : 'bg-white/10 text-white/40',
        ].join(' ')}
      >
        {done ? '✓' : n}
      </div>
      <span
        className={`text-xs hidden sm:inline ${active ? 'text-empyrean-gold' : done ? 'text-green-400' : 'text-white/30'}`}
      >
        {label}
      </span>
    </div>
  );
}

function EmptySlate({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 py-10 text-center">
      <p className="text-white/35 italic text-sm">{message}</p>
    </div>
  );
}
