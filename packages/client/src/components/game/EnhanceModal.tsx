import { useState } from 'react';
import Modal from '../ui/Modal';
import HeroCardDisplay from '../cards/HeroCardDisplay';
import CardComponent from '../cards/CardComponent';
import { useGameContext } from '../../context/GameContext';
import { useMyPlayer } from '../../hooks/useGameState';
import { getSocket } from '../../socket/client';
import type { ArenaHero, StatCard, AbilityCard } from '@empyrean-hero/engine';
import type { CardPlay } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// EnhanceModal — draw cards then play up to 3 from hand
// Stat cards require a hero attachment target (chosen inline).
// ─────────────────────────────────────────────────────────────────────────────

interface EnhanceModalProps {
  onClose: () => void;
}

type Step = 'draw' | 'cards' | 'attach';

export default function EnhanceModal({ onClose }: EnhanceModalProps) {
  const { playerId } = useGameContext();
  const me = useMyPlayer();

  const [step, setStep] = useState<Step>('draw');
  const [drawCount, setDrawCount] = useState(3);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  // cardId → hero instanceId for stat cards that need a target
  const [statTargets, setStatTargets] = useState<Record<string, string>>({});
  // Which stat card is currently being targeted (inline hero picker)
  const [attachingCardId, setAttachingCardId] = useState<string | null>(null);

  if (!me || !playerId) return null;

  const myArenaHeroes = me.arena;

  // Cards that need a hero target: stat cards AND passive ability cards
  const selectedTargetCards = selectedCardIds
    .map((id) => me.hand.find((c) => c.id === id))
    .filter((c): c is StatCard | AbilityCard => {
      if (!c) return false;
      if (c.type === 'stat') return true;
      if (c.type === 'ability' && (c as AbilityCard).abilityType === 'P') return true;
      return false;
    });

  // All target-needing cards that still need a target
  const untargetedStatCards = selectedTargetCards.filter((c) => !statTargets[c.id]);

  function toggleCard(id: string) {
    setSelectedCardIds((prev) => {
      if (prev.includes(id)) {
        // deselect → also clear any stat target
        setStatTargets((t) => { const copy = { ...t }; delete copy[id]; return copy; });
        setAttachingCardId(null);
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  }

  function selectStatTarget(cardId: string, heroInstanceId: string) {
    setStatTargets((prev) => ({ ...prev, [cardId]: heroInstanceId }));
    setAttachingCardId(null);
  }

  function handleToAttach() {
    // Check all selected stat cards have targets; if not, go to attach step
    if (untargetedStatCards.length > 0) {
      setAttachingCardId(untargetedStatCards[0]!.id);
      setStep('attach');
    } else {
      submitAction();
    }
  }

  function submitAction() {
    // Build cardPlays array with per-card targets
    const cardPlays: CardPlay[] = selectedCardIds.map((id) => ({
      cardId: id,
      targetId: statTargets[id],
    }));

    getSocket().emit(
      'game:action',
      { type: 'ENHANCE', playerId: playerId!, drawCount, cardPlays },
      () => {},
    );
    onClose();
  }

  // ── Footers ───────────────────────────────────────────────────────────────

  const drawFooter = (
    <div className="flex gap-3">
      <button className="btn-secondary flex-1 text-sm py-2.5" onClick={onClose}>Cancel</button>
      <button className="btn-primary flex-1 text-sm py-2.5" onClick={() => setStep('cards')}>
        Draw {drawCount} Card{drawCount !== 1 ? 's' : ''} →
      </button>
    </div>
  );

  const cardsFooter = (
    <div className="flex gap-3">
      <button className="btn-secondary text-sm py-2.5 px-5" onClick={() => setStep('draw')}>← Back</button>
      <button className="btn-primary flex-1 text-sm py-2.5" onClick={handleToAttach}>
        {untargetedStatCards.length > 0
          ? `Attach ${untargetedStatCards.length} Stat Card${untargetedStatCards.length !== 1 ? 's' : ''} →`
          : `Confirm Enhance${selectedCardIds.length > 0 ? ` (play ${selectedCardIds.length})` : ''}`}
      </button>
    </div>
  );

  const attachFooter = (
    <div className="flex gap-3">
      <button className="btn-secondary text-sm py-2.5 px-5" onClick={() => { setStep('cards'); setAttachingCardId(null); }}>
        ← Back
      </button>
      <button
        className="btn-primary flex-1 text-sm py-2.5"
        disabled={untargetedStatCards.length > 0}
        onClick={submitAction}
      >
        {untargetedStatCards.length > 0
          ? `${untargetedStatCards.length} card${untargetedStatCards.length !== 1 ? 's' : ''} need a target`
          : 'Confirm Enhance'}
      </button>
    </div>
  );

  const footerMap = { draw: drawFooter, cards: cardsFooter, attach: attachFooter };

  return (
    <Modal
      title="✨ Enhance — Draw & Play Cards"
      onClose={onClose}
      size="xl"
      footer={footerMap[step]}
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-5">
        <StepDot n={1} label="Draw" active={step === 'draw'} done={step !== 'draw'} />
        <div className="flex-1 h-px bg-white/10" />
        <StepDot n={2} label="Play" active={step === 'cards'} done={step === 'attach'} />
        {selectedTargetCards.length > 0 && (
          <>
            <div className="flex-1 h-px bg-white/10" />
            <StepDot n={3} label="Attach" active={step === 'attach'} done={false} />
          </>
        )}
      </div>

      {/* ── Step 1: choose drawCount ─────────────────────────────────────── */}
      {step === 'draw' && (
        <div className="space-y-5">
          <p className="text-sm text-white/60">
            How many cards do you want to draw from your enhancement deck?
          </p>
          <div className="flex gap-3 justify-center">
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                className={[
                  'w-20 h-20 rounded-2xl border-2 font-display text-3xl font-bold transition-all duration-150 active:scale-95',
                  drawCount === n
                    ? 'border-empyrean-gold text-empyrean-gold bg-empyrean-gold/10 shadow-glow'
                    : 'border-white/20 text-white/50 hover:border-white/40 hover:text-white/80',
                ].join(' ')}
                onClick={() => setDrawCount(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-center text-white/30">
            Deck: {me.enhancementDeck.length} card{me.enhancementDeck.length !== 1 ? 's' : ''} · Discard: {me.discardPile.length}
          </p>
        </div>
      )}

      {/* ── Step 2: select cards from hand to play ───────────────────────── */}
      {step === 'cards' && (
        <div className="space-y-4">
          <p className="text-sm text-white/60">
            Select up to 3 cards from your hand to play.{' '}
            <span className="text-white/40">({selectedCardIds.length}/3)</span>
          </p>

          {me.hand.length === 0 ? (
            <EmptySlate message="Hand is empty — nothing to play this turn." />
          ) : (
            <div className="flex flex-wrap gap-3">
              {me.hand.map((card) => {
                const selected = selectedCardIds.includes(card.id);
                const atMax = selectedCardIds.length >= 3;
                const disabled = !selected && atMax;
                const isStat = card.type === 'stat';
                const hasTarget = isStat && !!statTargets[card.id];

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

                    {/* Stat card: inline "choose hero" button */}
                    {selected && isStat && (
                      <button
                        className={[
                          'text-[10px] rounded-full px-2 py-0.5 border transition-colors',
                          hasTarget
                            ? 'border-green-400/60 text-green-300 bg-green-400/10'
                            : 'border-orange-400/60 text-orange-300 bg-orange-400/10 animate-pulse',
                        ].join(' ')}
                        onClick={() => { setAttachingCardId(card.id); setStep('attach'); }}
                      >
                        {hasTarget ? `→ ${getHeroName(statTargets[card.id]!, myArenaHeroes)}` : 'Choose hero'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: attach stat/passive card to a hero ──────────────────── */}
      {step === 'attach' && (
        <div className="space-y-5">
          {/* Progress through unattached target-needing cards */}
          {selectedTargetCards.map((sc) => {
            const attached = statTargets[sc.id];
            return (
              <div
                key={sc.id}
                className={[
                  'rounded-xl border p-4 transition-colors',
                  attachingCardId === sc.id
                    ? 'border-empyrean-gold/60 bg-empyrean-gold/5'
                    : attached
                      ? 'border-green-400/30 bg-green-400/5'
                      : 'border-white/10',
                ].join(' ')}
              >
                {/* Stat card header */}
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => setAttachingCardId(sc.id)}
                >
                  {sc.type === 'stat' ? (
                    <div className={`rounded-lg px-3 py-1.5 text-sm font-bold ${(sc as StatCard).statType === 'ATT' ? 'bg-red-500/20 text-red-300 border border-red-400/30' : 'bg-blue-500/20 text-blue-300 border border-blue-400/30'}`}>
                      +{(sc as StatCard).value} {(sc as StatCard).statType}
                    </div>
                  ) : (
                    <div className="rounded-lg px-3 py-1.5 text-sm font-bold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                      ABILITY
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">{sc.name}</p>
                    <p className="text-xs text-white/40">
                      {attached
                        ? `→ ${getHeroName(attached, myArenaHeroes)}`
                        : 'Click to choose a hero'}
                    </p>
                  </div>
                  {attached && <span className="text-green-400 text-sm">✓</span>}
                </div>

                {/* Hero picker (shown when this card is being targeted) */}
                {attachingCardId === sc.id && (
                  <div className="mt-4">
                    {myArenaHeroes.length === 0 ? (
                      <p className="text-xs text-white/40 italic">No heroes in your arena to attach to.</p>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        {myArenaHeroes.map((hero) => {
                          const isTarget = statTargets[sc.id] === hero.instanceId;
                          return (
                            <div
                              key={hero.instanceId}
                              className={[
                                'cursor-pointer rounded-xl transition-all duration-150',
                                isTarget
                                  ? 'ring-2 ring-empyrean-gold scale-105 shadow-glow'
                                  : 'hover:scale-105 hover:ring-2 hover:ring-white/30',
                              ].join(' ')}
                              onClick={() => selectStatTarget(sc.id, hero.instanceId)}
                            >
                              <HeroCardDisplay card={hero.heroCard} fatigued={hero.fatigued} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getHeroName(instanceId: string, heroes: ArenaHero[]): string {
  return heroes.find((h) => h.instanceId === instanceId)?.heroCard.heroName ?? instanceId;
}

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div
        className={[
          'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
          done ? 'bg-green-500 text-white' : active ? 'bg-empyrean-gold text-empyrean-navyDark' : 'bg-white/10 text-white/40',
        ].join(' ')}
      >
        {done ? '✓' : n}
      </div>
      <span className={`text-xs hidden sm:inline ${active ? 'text-empyrean-gold' : done ? 'text-green-400' : 'text-white/30'}`}>
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
