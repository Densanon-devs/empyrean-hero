import { useEffect, useRef, useState } from 'react';
import { useGameContext } from '../../context/GameContext';
import { useMyPlayer, useOpponents } from '../../hooks/useGameState';
import { getSocket } from '../../socket/client';
import { getEffectiveAttack, getEffectiveDefense } from '@empyrean-hero/engine';
import type { ArenaHero, CombatResult } from '@empyrean-hero/engine';
import HeroCardDisplay from '../cards/HeroCardDisplay';

// ─────────────────────────────────────────────────────────────────────────────
// CombatResolver — UI for the O (Overcome) action
// Shown via local state in GameBoard when the player clicks O.
// Supports multi-attack: after combat resolves, offer Attack Again or End Turn.
// ─────────────────────────────────────────────────────────────────────────────

interface CombatResolverProps {
  /** Called when the player wants to cancel before confirming, or after ending their turn */
  onCancel: () => void;
}

type CombatStep = 'select' | 'pending' | 'result';

export default function CombatResolver({ onCancel }: CombatResolverProps) {
  const { playerId, gameState } = useGameContext();
  const me = useMyPlayer();
  const opponents = useOpponents();

  const [step, setStep] = useState<CombatStep>('select');
  const [attackerIds, setAttackerIds] = useState<string[]>([]);
  const [targetPlayerId, setTargetPlayerId] = useState<string>(opponents[0]?.id ?? '');
  const [defenderIds, setDefenderIds] = useState<string[]>([]);
  const [lastResult, setLastResult] = useState<CombatResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Track combat history length to detect when a new result arrives
  const combatCountRef = useRef(gameState?.combatHistory.length ?? 0);

  // Watch for new combat result after we submit
  useEffect(() => {
    if (step !== 'pending' || !gameState) return;
    const newCount = gameState.combatHistory.length;
    if (newCount > combatCountRef.current) {
      setLastResult(gameState.combatHistory[newCount - 1] ?? null);
      combatCountRef.current = newCount;
      setStep('result');
    }
  }, [gameState?.combatHistory.length, step]);

  if (!me || opponents.length === 0) return null;

  const target = opponents.find((o) => o.id === targetPlayerId) ?? opponents[0]!;
  const readyHeroes = me.arena.filter((h) => !h.fatigued);

  // Live combat preview
  const totalAtk = attackerIds.reduce((sum, id) => {
    const h = me.arena.find((a) => a.instanceId === id);
    return sum + (h ? getEffectiveAttack(h) : 0);
  }, 0);

  const totalDef = defenderIds.reduce((sum, id) => {
    const h = target.arena.find((a) => a.instanceId === id);
    return sum + (h ? getEffectiveDefense(h) : 0);
  }, 0);

  const outcome =
    defenderIds.length === 0 && target.arena.length === 0
      ? 'skybase'
      : totalAtk >= totalDef
        ? 'defeated'
        : totalDef > 0 && totalAtk >= totalDef / 2
          ? 'fatigued'
          : 'no-effect';

  const outcomeLabel = {
    skybase:   { text: '🏰 Sky Base Attack', cls: 'text-empyrean-gold' },
    defeated:  { text: '💀 Defeated',        cls: 'text-red-400' },
    fatigued:  { text: '😮 Fatigued',         cls: 'text-yellow-400' },
    'no-effect': { text: '✋ No Effect',      cls: 'text-white/50' },
  }[outcome];

  function toggleAttacker(hero: ArenaHero) {
    setAttackerIds((prev) =>
      prev.includes(hero.instanceId)
        ? prev.filter((id) => id !== hero.instanceId)
        : [...prev, hero.instanceId],
    );
  }

  function toggleDefender(hero: ArenaHero) {
    setDefenderIds((prev) =>
      prev.includes(hero.instanceId)
        ? prev.filter((id) => id !== hero.instanceId)
        : [...prev, hero.instanceId],
    );
  }

  function handleConfirm() {
    if (!playerId || attackerIds.length === 0) return;
    // Client-side SkyBase validation
    if (target.arena.length > 0 && defenderIds.length === 0) {
      setError(`${target.name} has heroes in arena — select hero targets, not their Sky Base`);
      return;
    }
    setError(null);
    combatCountRef.current = gameState?.combatHistory.length ?? 0;
    setStep('pending');

    getSocket().emit(
      'game:action',
      {
        type: 'OVERCOME',
        playerId,
        attackerInstanceIds: attackerIds,
        targetPlayerId: target.id,
        defenderInstanceIds: defenderIds,
      },
      (res) => {
        if (!res.success) {
          setError(res.error ?? 'Action failed');
          setStep('select');
        }
        // On success: useEffect watches combatHistory and transitions to 'result'
      },
    );
  }

  function handleAttackAgain() {
    setStep('select');
    setAttackerIds([]);
    setDefenderIds([]);
    setLastResult(null);
    setError(null);
  }

  function handleEndTurn() {
    if (playerId) {
      getSocket().emit('game:action', { type: 'PASS_TURN', playerId }, () => {});
    }
    onCancel();
  }

  // Still-ready heroes after last combat (for "attack again" availability)
  const remainingReadyHeroes = me.arena.filter((h) => !h.fatigued);

  // ── Result summary helpers ────────────────────────────────────────────────

  const resultOutcomeMeta = lastResult
    ? lastResult.outcome === 'defeated'
      ? { label: '💀 Heroes Defeated!',  bg: 'bg-red-900/30 border-red-500/30',    text: 'text-red-300' }
      : lastResult.outcome === 'fatigued'
        ? { label: '😮 Heroes Fatigued',  bg: 'bg-yellow-900/20 border-yellow-500/20', text: 'text-yellow-300' }
        : { label: '✋ No Effect',        bg: 'bg-white/5 border-white/10',           text: 'text-white/50' }
    : null;

  return (
    <div className="panel space-y-4 animate-slide-up">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-empyrean-gold text-sm font-bold uppercase tracking-wider">
          ⚔ Overcome
        </h3>
        {step === 'select' && (
          <button
            className="text-xs text-white/30 hover:text-white/60 transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>

      {/* ── PENDING ─────────────────────────────────────────────────────── */}
      {step === 'pending' && (
        <div className="py-8 text-center space-y-2">
          <div className="w-8 h-8 border-2 border-empyrean-gold/40 border-t-empyrean-gold rounded-full animate-spin mx-auto" />
          <p className="text-white/50 text-sm">Resolving combat…</p>
        </div>
      )}

      {/* ── RESULT ─────────────────────────────────────────────────────── */}
      {step === 'result' && lastResult && resultOutcomeMeta && (
        <div className="space-y-4">
          <div className={`rounded-xl border p-4 space-y-3 ${resultOutcomeMeta.bg}`}>
            <p className={`font-display font-bold text-lg ${resultOutcomeMeta.text}`}>
              {resultOutcomeMeta.label}
            </p>
            <div className="grid grid-cols-3 text-xs text-center gap-2">
              <div>
                <p className="text-white/40 mb-0.5">Attack</p>
                <p className="font-mono font-bold text-red-300 text-base">{lastResult.totalAttack}</p>
              </div>
              <div className="text-white/30 self-center">vs</div>
              <div>
                <p className="text-white/40 mb-0.5">Defense</p>
                <p className="font-mono font-bold text-blue-300 text-base">{lastResult.totalDefense}</p>
              </div>
            </div>

            {lastResult.defeatedHeroInstanceIds.length > 0 && (
              <p className="text-xs text-red-400">
                Defeated:{' '}
                {lastResult.defeatedHeroInstanceIds
                  .map((id) => findHeroName(id, gameState?.players))
                  .join(', ')}
              </p>
            )}
            {lastResult.fatiguedHeroInstanceIds.length > 0 && (
              <p className="text-xs text-yellow-400">
                Fatigued:{' '}
                {lastResult.fatiguedHeroInstanceIds
                  .map((id) => findHeroName(id, gameState?.players))
                  .join(', ')}
              </p>
            )}
          </div>

          {/* Post-combat options */}
          <div className="flex gap-2">
            {remainingReadyHeroes.length > 0 ? (
              <>
                <button className="btn-primary flex-1 text-sm py-2.5" onClick={handleAttackAgain}>
                  ⚔ Attack Again ({remainingReadyHeroes.length} ready)
                </button>
                <button className="btn-secondary text-sm py-2.5 px-4" onClick={handleEndTurn}>
                  End Turn
                </button>
              </>
            ) : (
              <button className="btn-primary flex-1 text-sm py-2.5" onClick={handleEndTurn}>
                End Turn
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── SELECT ─────────────────────────────────────────────────────── */}
      {step === 'select' && (
        <>
          {error && (
            <div className="rounded-lg bg-red-900/30 border border-red-500/30 px-3 py-2 text-xs text-red-300">
              {error}
            </div>
          )}

          {/* Attackers */}
          <div>
            <p className="text-xs text-white/50 mb-2">
              Your attackers — click to toggle{' '}
              {attackerIds.length > 0 && (
                <span className="text-empyrean-gold font-semibold">
                  ({attackerIds.length} selected · {totalAtk} ATK)
                </span>
              )}
            </p>
            {readyHeroes.length === 0 ? (
              <p className="text-xs text-red-400 italic px-1">
                No ready heroes — all your arena heroes are fatigued.
              </p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {readyHeroes.map((hero) => (
                  <SelectableHero
                    key={hero.instanceId}
                    hero={hero}
                    selected={attackerIds.includes(hero.instanceId)}
                    ringColor="ring-red-400"
                    glowColor="rgba(248,113,113,0.4)"
                    onClick={() => toggleAttacker(hero)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Target player selector (only shown for 3+ player games) */}
          {opponents.length > 1 && (
            <div>
              <p className="text-xs text-white/50 mb-1.5">Target player</p>
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
                    onClick={() => { setTargetPlayerId(opp.id); setDefenderIds([]); }}
                  >
                    {opp.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Defenders */}
          <div>
            <p className="text-xs text-white/50 mb-2">
              {target.name}'s heroes — click to mark as targets
              {defenderIds.length > 0 && (
                <span className="text-blue-300 font-semibold ml-1">
                  ({defenderIds.length} selected · {totalDef} DEF)
                </span>
              )}
            </p>
            {target.arena.length === 0 ? (
              <p className="text-xs text-empyrean-gold/80 italic px-1">
                No heroes in arena — this attack targets {target.name}'s Sky Base directly.
              </p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {target.arena.map((hero) => (
                  <SelectableHero
                    key={hero.instanceId}
                    hero={hero}
                    selected={defenderIds.includes(hero.instanceId)}
                    ringColor="ring-blue-400"
                    glowColor="rgba(96,165,250,0.4)"
                    onClick={() => toggleDefender(hero)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Combat preview bar */}
          <div className="flex items-center justify-between rounded-lg bg-white/5 px-4 py-2 text-sm border border-white/10">
            <span className="text-red-300 font-mono font-bold">⚔ {totalAtk}</span>
            <span className="text-white/30 text-xs">ATK vs DEF</span>
            <span className="text-blue-300 font-mono font-bold">{totalDef} 🛡</span>
            <span className={`font-bold text-sm ${outcomeLabel.cls}`}>{outcomeLabel.text}</span>
          </div>

          {/* Confirm */}
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1 text-sm py-2.5"
              onClick={handleConfirm}
              disabled={attackerIds.length === 0}
            >
              Confirm Attack
            </button>
            <button
              className="btn-secondary px-4 text-sm py-2.5"
              onClick={() => { setAttackerIds([]); setDefenderIds([]); }}
            >
              Clear
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface SelectableHeroProps {
  hero: ArenaHero;
  selected: boolean;
  ringColor: string;
  glowColor: string;
  onClick: () => void;
}

function SelectableHero({ hero, selected, ringColor, glowColor, onClick }: SelectableHeroProps) {
  return (
    <div
      className={[
        'cursor-pointer rounded-xl ring-2 transition-all duration-150',
        selected
          ? `${ringColor} scale-105`
          : 'ring-transparent hover:ring-white/20',
      ].join(' ')}
      style={selected ? { boxShadow: `0 0 14px ${glowColor}` } : undefined}
      onClick={onClick}
    >
      <HeroCardDisplay card={hero.heroCard} fatigued={hero.fatigued} />
    </div>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────

function findHeroName(
  instanceId: string,
  players: Record<string, { arena: ArenaHero[]; defeatedHeroes: ArenaHero[] }> | undefined,
): string {
  if (!players) return instanceId;
  for (const player of Object.values(players)) {
    const found =
      player.arena.find((h) => h.instanceId === instanceId) ??
      player.defeatedHeroes.find((h) => h.instanceId === instanceId);
    if (found) return found.heroCard.heroName;
  }
  return instanceId;
}
