import { useState } from 'react';
import { useGameContext } from '../../context/GameContext';
import { getSocket } from '../../socket/client';
import { HEROES } from '@empyrean-hero/engine';
import HeroCardDisplay from '../cards/HeroCardDisplay';
import type { HeroCard } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// DraftBoard — hero draft phase
// Shows the full pool of 20 heroes; already-picked ones are grayed out.
// Highlights who picked each hero on hover. Snake-draft order is visualised.
// ─────────────────────────────────────────────────────────────────────────────

export default function DraftBoard() {
  const { gameState, draftState, playerId, lobbyPlayers } = useGameContext();
  const [hoveredHeroId, setHoveredHeroId] = useState<string | null>(null);

  const draft = draftState ?? gameState?.draftState;

  if (!draft) {
    return <p className="text-white/50 text-center py-8">Draft not started yet.</p>;
  }

  const socket = getSocket();

  const currentPickerId = draft.pickOrder[draft.pickIndex];
  const isMyPick = currentPickerId === playerId;
  const totalPicks = draft.pickOrder.length;
  const completedPicks = draft.pickIndex;

  // Build reverse map: heroId → pickerId
  const heroPicker: Record<string, string> = {};
  for (const [pid, heroIds] of Object.entries(draft.picks)) {
    for (const heroId of heroIds) {
      heroPicker[heroId] = pid;
    }
  }

  // All 20 heroes (some available, some picked)
  const availableIds = new Set(draft.availableHeroes.map((h) => h.id));

  function getPlayerName(pid: string) {
    return lobbyPlayers.find((p) => p.id === pid)?.name ?? pid;
  }

  function handlePick(hero: HeroCard) {
    if (!isMyPick || !availableIds.has(hero.id)) return;
    socket.emit('draft:pick', hero.id, () => {});
  }

  const currentPickerName = getPlayerName(currentPickerId ?? '');

  // ── Snake-draft order visualisation ─────────────────────────────────────
  // Show the next 6 picks (or remaining picks) in a timeline strip
  const upcomingPicks = draft.pickOrder.slice(draft.pickIndex, draft.pickIndex + 8);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Status bar ──────────────────────────────────────────────────── */}
      <div className="panel flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs text-white/50 uppercase tracking-wider">Now Picking</p>
          <p className={`font-display font-bold text-lg truncate ${isMyPick ? 'text-empyrean-gold' : 'text-white'}`}>
            {isMyPick ? '⭐ Your Pick!' : `${currentPickerName}'s Pick`}
          </p>
          {isMyPick && (
            <p className="text-xs text-empyrean-gold/70 mt-0.5">Click a hero to draft them</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-white/50">Progress</p>
          <p className="text-white font-mono text-lg">{completedPicks}<span className="text-white/30">/{totalPicks}</span></p>
        </div>
      </div>

      {/* ── Progress bar ─────────────────────────────────────────────────── */}
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full bg-empyrean-gold rounded-full transition-all duration-500"
          style={{ width: `${totalPicks > 0 ? (completedPicks / totalPicks) * 100 : 0}%` }}
        />
      </div>

      {/* ── Upcoming picks timeline ──────────────────────────────────────── */}
      {upcomingPicks.length > 0 && (
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wider mb-2">Next picks</p>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {upcomingPicks.map((pid, i) => {
              const isFirst = i === 0;
              const isMe = pid === playerId;
              return (
                <div key={`${pid}-${draft.pickIndex + i}`} className="flex items-center gap-1 shrink-0">
                  <div
                    className={[
                      'rounded-full px-2.5 py-1 text-xs font-semibold transition-all',
                      isFirst
                        ? isMe
                          ? 'bg-empyrean-gold text-empyrean-navyDark shadow-glow'
                          : 'bg-white/20 text-white'
                        : isMe
                          ? 'bg-empyrean-gold/20 text-empyrean-gold/80 border border-empyrean-gold/40'
                          : 'bg-white/5 text-white/40 border border-white/10',
                    ].join(' ')}
                  >
                    {isMe ? 'You' : getPlayerName(pid)}
                  </div>
                  {i < upcomingPicks.length - 1 && (
                    <span className="text-white/20 text-xs">→</span>
                  )}
                </div>
              );
            })}
            {draft.pickIndex + upcomingPicks.length < totalPicks && (
              <span className="text-white/20 text-xs shrink-0">…</span>
            )}
          </div>
        </div>
      )}

      {/* ── Draft complete banner ────────────────────────────────────────── */}
      {draft.phase === 'complete' && (
        <div className="rounded-xl border border-empyrean-gold/40 bg-empyrean-gold/5 px-5 py-4 text-center">
          <p className="font-display text-empyrean-gold font-bold text-lg">Draft Complete!</p>
          <p className="text-white/50 text-sm mt-1">Waiting for the game to start…</p>
        </div>
      )}

      {/* ── Hero grid ────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base text-white/80">
            All Heroes ({HEROES.length})
          </h2>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-empyrean-gold/60 inline-block" />
              Available
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-white/10 inline-block" />
              Picked
            </span>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {HEROES.map((hero) => {
            const isPicked = !availableIds.has(hero.id);
            const pickedBy = heroPicker[hero.id];
            const pickedByMe = pickedBy === playerId;
            const canPick = isMyPick && !isPicked;

            return (
              <div
                key={hero.id}
                className={[
                  'relative rounded-xl transition-all duration-150',
                  isPicked
                    ? 'opacity-40 cursor-default'
                    : canPick
                      ? 'cursor-pointer hover:-translate-y-2 hover:shadow-glow hover:ring-2 hover:ring-empyrean-gold/60'
                      : 'opacity-70 cursor-not-allowed',
                  pickedByMe && isPicked ? 'ring-2 ring-empyrean-gold/50' : '',
                ].join(' ')}
                onClick={() => handlePick(hero)}
                onMouseEnter={() => setHoveredHeroId(hero.id)}
                onMouseLeave={() => setHoveredHeroId(null)}
              >
                <HeroCardDisplay card={hero} />

                {/* Picked-by badge */}
                {isPicked && pickedBy && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-[9px] font-bold shadow-lg',
                        pickedByMe
                          ? 'bg-empyrean-gold text-empyrean-navyDark'
                          : 'bg-black/70 text-white/70',
                      ].join(' ')}
                    >
                      {pickedByMe ? 'You' : getPlayerName(pickedBy)}
                    </span>
                  </div>
                )}

                {/* Tooltip on hover for available heroes */}
                {hoveredHeroId === hero.id && !isPicked && canPick && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                    <div className="rounded-lg bg-black/90 border border-empyrean-gold/40 px-2 py-1 text-[10px] text-empyrean-gold whitespace-nowrap shadow-xl">
                      Click to draft
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── My picks so far ──────────────────────────────────────────────── */}
      {playerId && draft.picks[playerId] && draft.picks[playerId]!.length > 0 && (
        <div>
          <h2 className="font-display text-base text-white/80 mb-3">
            Your Picks ({draft.picks[playerId]!.length})
          </h2>
          <div className="flex gap-3 flex-wrap">
            {draft.picks[playerId]!.map((heroId) => {
              const hero =
                HEROES.find((h) => h.id === heroId) ??
                gameState?.players[playerId]?.heroPool.find((h) => h.heroCard.id === heroId)?.heroCard;
              if (!hero) return null;
              return (
                <div key={heroId} className="ring-2 ring-empyrean-gold/40 rounded-xl">
                  <HeroCardDisplay card={hero} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Other players' picks ──────────────────────────────────────────── */}
      {Object.entries(draft.picks)
        .filter(([pid, picks]) => pid !== playerId && picks.length > 0)
        .map(([pid, picks]) => (
          <div key={pid}>
            <h2 className="font-display text-base text-white/80 mb-3">
              {getPlayerName(pid)}'s Picks ({picks.length})
            </h2>
            <div className="flex gap-3 flex-wrap">
              {picks.map((heroId) => {
                const hero = HEROES.find((h) => h.id === heroId);
                if (!hero) return null;
                return (
                  <div key={heroId} className="opacity-70">
                    <HeroCardDisplay card={hero} />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
