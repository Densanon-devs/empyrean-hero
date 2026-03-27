import { useState } from 'react';
import Modal from '../ui/Modal';
import HeroCardDisplay from '../cards/HeroCardDisplay';
import CardComponent from '../cards/CardComponent';
import { useGameContext } from '../../context/GameContext';
import { useMyPlayer } from '../../hooks/useGameState';
import { getSocket } from '../../socket/client';
import type { ArenaHero, AbilityCard } from '@empyrean-hero/engine';
import type { CardPlay } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// HealModal — select your fatigued heroes to un-fatigue, then optionally play cards
// ─────────────────────────────────────────────────────────────────────────────

interface HealModalProps {
  onClose: () => void;
}

type Step = 'heroes' | 'cards';

export default function HealModal({ onClose }: HealModalProps) {
  const { playerId } = useGameContext();
  const me = useMyPlayer();

  const [step, setStep] = useState<Step>('heroes');
  const [selectedHeroIds, setSelectedHeroIds] = useState<string[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  // cardId → hero instanceId for passive ability cards that need a target
  const [cardTargets, setCardTargets] = useState<Record<string, string>>({});
  const [attachingCardId, setAttachingCardId] = useState<string | null>(null);

  if (!me || !playerId) return null;

  // Only YOUR fatigued heroes (Heal only un-fatigues your own heroes)
  const myFatiguedHeroes = me.arena.filter((h) => h.fatigued);

  function toggleHero(id: string) {
    setSelectedHeroIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleCard(id: string) {
    setSelectedCardIds((prev) => {
      if (prev.includes(id)) {
        setCardTargets((t) => { const c = { ...t }; delete c[id]; return c; });
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  // Check if any selected passive ability cards still need a hero target
  const selectedPassiveCards = selectedCardIds
    .map((id) => me.hand.find((c) => c.id === id))
    .filter((c): c is AbilityCard => c?.type === 'ability' && (c as AbilityCard).abilityType === 'P');
  const untargetedPassive = selectedPassiveCards.filter((c) => !cardTargets[c.id]);

  function handleConfirm() {
    // Build cardPlays with targets for passive ability cards
    const cardPlays: CardPlay[] = selectedCardIds.map((id) => ({
      cardId: id,
      targetId: cardTargets[id],
    }));

    getSocket().emit(
      'game:action',
      {
        type: 'HEAL',
        playerId: playerId!,
        targetHeroInstanceIds: selectedHeroIds,
        cardPlays,
      },
      () => {},
    );
    onClose();
  }

  function handleProceedToCards() {
    if (selectedHeroIds.length === 0) return;
    setStep('cards');
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
        onClick={handleProceedToCards}
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
      {untargetedPassive.length > 0 ? (
        <button
          className="btn-primary flex-1 text-sm py-2.5 animate-pulse"
          onClick={() => setAttachingCardId(untargetedPassive[0]!.id)}
        >
          Attach {untargetedPassive.length} Card{untargetedPassive.length !== 1 ? 's' : ''} →
        </button>
      ) : (
        <button className="btn-primary flex-1 text-sm py-2.5" onClick={handleConfirm}>
          Confirm Heal
          {selectedCardIds.length > 0 && (
            <span className="ml-1.5 opacity-80">
              + {selectedCardIds.length} card{selectedCardIds.length !== 1 ? 's' : ''}
            </span>
          )}
        </button>
      )}
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
            Choose 1 or more of your fatigued heroes to un-fatigue.
          </p>

          {myFatiguedHeroes.length === 0 ? (
            <EmptySlate message="None of your arena heroes are fatigued right now." />
          ) : (
            <div className="flex flex-wrap gap-4">
              {myFatiguedHeroes.map((hero) => {
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
                  >
                    <HeroCardDisplay card={hero.heroCard} fatigued />
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
                const isPassive = card.type === 'ability' && (card as AbilityCard).abilityType === 'P';
                const hasTarget = isPassive && !!cardTargets[card.id];
                return (
                  <div key={card.id} className="flex flex-col items-center gap-1">
                    <div
                      className={[
                        'relative transition-all duration-150',
                        selected
                          ? 'scale-105 shadow-[0_0_12px_rgba(212,175,55,0.5)]'
                          : disabled
                            ? 'opacity-35 cursor-not-allowed'
                            : 'hover:scale-105 cursor-pointer',
                      ].join(' ')}
                      onClick={() => !disabled && toggleCard(card.id)}
                    >
                      <CardComponent card={card} selected={selected} disabled={disabled} />
                      {selected && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-empyrean-gold flex items-center justify-center text-empyrean-navyDark text-[11px] font-bold shadow pointer-events-none">
                          ✓
                        </div>
                      )}
                    </div>
                    {/* Passive ability card: show hero target picker */}
                    {selected && isPassive && (
                      <button
                        className={[
                          'text-[10px] rounded-full px-2 py-0.5 border transition-colors',
                          hasTarget
                            ? 'border-green-400/60 text-green-300 bg-green-400/10'
                            : 'border-orange-400/60 text-orange-300 bg-orange-400/10 animate-pulse',
                        ].join(' ')}
                        onClick={() => setAttachingCardId(attachingCardId === card.id ? null : card.id)}
                      >
                        {hasTarget
                          ? `→ ${getHeroName(cardTargets[card.id]!, me.arena)}`
                          : 'Choose hero'}
                      </button>
                    )}
                    {/* Hero picker for this passive card */}
                    {selected && isPassive && attachingCardId === card.id && (
                      <div className="mt-1 flex flex-wrap gap-1 max-w-xs">
                        {me.arena.map((hero) => (
                          <button
                            key={hero.instanceId}
                            className={[
                              'rounded-lg border px-2 py-1 text-[10px] transition-colors',
                              cardTargets[card.id] === hero.instanceId
                                ? 'border-green-400 text-green-300 bg-green-400/10'
                                : 'border-white/20 text-white/50 hover:border-white/40',
                            ].join(' ')}
                            onClick={() => {
                              setCardTargets((prev) => ({ ...prev, [card.id]: hero.instanceId }));
                              setAttachingCardId(null);
                            }}
                          >
                            {hero.heroCard.heroName}
                          </button>
                        ))}
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

function getHeroName(instanceId: string, heroes: ArenaHero[]): string {
  return heroes.find((h) => h.instanceId === instanceId)?.heroCard.heroName ?? instanceId;
}

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
