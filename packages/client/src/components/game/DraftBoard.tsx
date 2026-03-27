import { useState } from 'react';
import { useGameContext } from '../../context/GameContext';
import { getSocket } from '../../socket/client';
import { HEROES } from '@empyrean-hero/engine';
import type { HeroCard } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// DraftBoard — hero draft phase
// Snake-draft: click to select (gold ring), click again to deselect,
// then hit Confirm Pick. Waiting overlay covers the grid when it's not
// your turn. Draft history sidebar lists every pick in order.
// ─────────────────────────────────────────────────────────────────────────────

type CardState = 'available' | 'selected' | 'picked-by-me' | 'picked-by-other' | 'waiting';

const ABILITY_BADGE: Record<string, string> = {
  A: 'bg-blue-500/20 text-blue-300 border border-blue-400/40',
  P: 'bg-purple-500/20 text-purple-300 border border-purple-400/40',
  H: 'bg-empyrean-gold/20 text-empyrean-gold border border-empyrean-gold/40',
};

// ─── Hero card ────────────────────────────────────────────────────────────────

interface DraftHeroCardProps {
  hero: HeroCard;
  state: CardState;
  pickedByName?: string;
  onClick: () => void;
}

function DraftHeroCard({ hero, state, pickedByName, onClick }: DraftHeroCardProps) {
  const { ability } = hero;
  const badgeStyle = ABILITY_BADGE[ability.abilityType] ?? '';

  const isPicked  = state === 'picked-by-me' || state === 'picked-by-other';
  const isSelected = state === 'selected';
  const isWaiting  = state === 'waiting';
  const isInteractive = !isPicked && !isWaiting;

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      className={[
        'relative flex flex-col rounded-xl overflow-hidden select-none transition-all duration-150',
        'bg-gradient-to-b from-[#0c1a2e] to-[#06101e]',
        isPicked
          ? 'opacity-35 cursor-default'
          : isWaiting
            ? 'opacity-55 cursor-not-allowed'
            : isSelected
              ? 'cursor-pointer ring-2 ring-empyrean-gold -translate-y-1 scale-[1.02]'
                + ' shadow-[0_0_22px_rgba(212,175,55,0.45)]'
              : 'cursor-pointer hover:-translate-y-1 hover:scale-[1.02]'
                + ' hover:ring-2 hover:ring-empyrean-gold/50'
                + ' hover:shadow-[0_0_16px_rgba(212,175,55,0.3)]',
      ].join(' ')}
      onClick={isInteractive ? onClick : undefined}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && isInteractive) onClick();
      }}
    >
      {/* ── Hero image ──────────────────────────────────────────────────── */}
      <div className="relative aspect-[3/4] overflow-hidden bg-empyrean-navy/60">
        <img
          src={`/assets/heroes/${hero.heroName.toLowerCase()}.png`}
          alt={hero.heroName}
          loading="lazy"
          className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />

        {/* Name gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent px-2.5 pt-8 pb-2">
          <p className="font-display font-bold text-white text-sm leading-tight">
            {hero.heroName}
          </p>
        </div>

        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-empyrean-gold shadow-[0_0_8px_rgba(212,175,55,0.9)]" />
        )}

        {/* Picked overlay */}
        {isPicked && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className={[
              'rounded-full px-2.5 py-1 text-[10px] font-bold shadow-lg',
              state === 'picked-by-me'
                ? 'bg-empyrean-gold text-empyrean-navyDark'
                : 'bg-black/80 text-white/60',
            ].join(' ')}>
              {state === 'picked-by-me' ? '✓ You' : `✗ ${pickedByName ?? 'Drafted'}`}
            </span>
          </div>
        )}
      </div>

      {/* ── Attack / Defense ────────────────────────────────────────────── */}
      <div className="flex items-center justify-around border-t border-white/10 bg-[#06101e] px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="text-red-400 text-sm leading-none">⚔</span>
          <span className="font-mono font-bold text-white text-sm leading-none">{hero.attack}</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <span className="text-sky-400 text-sm leading-none">🛡</span>
          <span className="font-mono font-bold text-white text-sm leading-none">{hero.defense}</span>
        </div>
      </div>

      {/* ── Ability ─────────────────────────────────────────────────────── */}
      <div className="px-2.5 py-2.5 border-t border-white/10 bg-[#080f1c] space-y-1.5 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${badgeStyle}`}>
            {ability.abilityType}
          </span>
          <span className="font-semibold text-[11px] text-white/90 leading-tight truncate">
            {ability.name}
          </span>
        </div>
        <p className="text-[10px] text-white/60 leading-snug break-words">
          {ability.description}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DraftBoard
// ─────────────────────────────────────────────────────────────────────────────

export default function DraftBoard() {
  const { gameState, draftState, playerId, lobbyPlayers } = useGameContext();
  const [selectedHeroId, setSelectedHeroId] = useState<string | null>(null);

  const draft = draftState ?? gameState?.draftState;

  if (!draft) {
    return (
      <p className="text-white/50 text-center py-8 animate-pulse">
        Waiting for draft to start…
      </p>
    );
  }

  const socket = getSocket();

  const currentPickerId = draft.pickOrder[draft.pickIndex];
  const isMyPick        = currentPickerId === playerId;
  const totalPicks      = draft.pickOrder.length;
  const completedPicks  = draft.pickIndex;
  const isDraftComplete = draft.phase === 'complete';

  // heroId → pickerId
  const heroPicker: Record<string, string> = {};
  for (const [pid, heroIds] of Object.entries(draft.picks)) {
    for (const hid of heroIds) heroPicker[hid] = pid;
  }

  const availableIds = new Set(draft.availableHeroes.map((h) => h.id));

  function getPlayerName(pid: string) {
    return lobbyPlayers.find((p) => p.id === pid)?.name ?? pid;
  }

  function handleCardClick(hero: HeroCard) {
    if (!isMyPick || !availableIds.has(hero.id)) return;
    setSelectedHeroId((prev) => (prev === hero.id ? null : hero.id));
  }

  function handleConfirmPick() {
    if (!selectedHeroId || !isMyPick) return;
    socket.emit('draft:pick', selectedHeroId, () => {});
    setSelectedHeroId(null);
  }

  const selectedHero    = selectedHeroId ? HEROES.find((h) => h.id === selectedHeroId) : null;
  const currentPickerName = getPlayerName(currentPickerId ?? '');

  // Reconstruct pick history in chronological order
  const pickCounts: Record<string, number> = {};
  const history = draft.pickOrder.slice(0, completedPicks).map((pid) => {
    const idx = pickCounts[pid] ?? 0;
    pickCounts[pid] = idx + 1;
    const heroId = draft.picks[pid]?.[idx];
    if (!heroId) return null;
    return { heroId, pickerName: getPlayerName(pid), isMe: pid === playerId };
  }).filter(Boolean) as Array<{ heroId: string; pickerName: string; isMe: boolean }>;

  // Next 6 picks in the order strip
  const upcomingPicks = draft.pickOrder.slice(draft.pickIndex, draft.pickIndex + 6);

  return (
    <div className="flex gap-5 max-w-7xl mx-auto">

      {/* ── Main area ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Status bar */}
        <div className="panel flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5">Now Picking</p>

            {isDraftComplete ? (
              <p className="font-display font-bold text-lg text-empyrean-gold">Draft Complete!</p>
            ) : isMyPick ? (
              <>
                <p className="font-display font-bold text-lg text-empyrean-gold">Your Pick!</p>
                <p className="text-xs text-empyrean-gold/60 mt-0.5">
                  {selectedHero
                    ? `Selected: ${selectedHero.heroName} — confirm when ready`
                    : 'Click a hero to select, then confirm'}
                </p>
              </>
            ) : (
              <>
                <p className="font-display font-bold text-lg text-white">
                  Waiting for {currentPickerName}…
                </p>
                <p className="text-xs text-white/35 mt-0.5">Cards will be available on your turn</p>
              </>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {isMyPick && selectedHero && !isDraftComplete && (
              <button
                onClick={handleConfirmPick}
                className={[
                  'rounded-lg bg-empyrean-gold text-empyrean-navyDark font-bold',
                  'px-5 py-2.5 text-sm transition-all active:scale-95',
                  'hover:brightness-110 shadow-[0_0_16px_rgba(212,175,55,0.4)]',
                ].join(' ')}
              >
                Confirm Pick →
              </button>
            )}
            <div className="text-right">
              <p className="text-[10px] text-white/40 uppercase tracking-wider">Progress</p>
              <p className="font-mono text-white text-xl leading-none">
                {completedPicks}
                <span className="text-white/30 text-sm">/{totalPicks}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-empyrean-gold rounded-full transition-all duration-700"
            style={{ width: `${totalPicks > 0 ? (completedPicks / totalPicks) * 100 : 0}%` }}
          />
        </div>

        {/* Pick-order strip */}
        {upcomingPicks.length > 0 && !isDraftComplete && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[10px] text-white/25 uppercase tracking-widest shrink-0 mr-1">
              Order:
            </span>
            {upcomingPicks.map((pid, i) => {
              const isFirst = i === 0;
              const isMe    = pid === playerId;
              return (
                <div key={`${pid}-${draft.pickIndex + i}`} className="flex items-center gap-1.5 shrink-0">
                  <div className={[
                    'rounded-full px-2.5 py-1 text-xs font-semibold transition-all',
                    isFirst
                      ? isMe
                          ? 'bg-empyrean-gold text-empyrean-navyDark shadow-[0_0_10px_rgba(212,175,55,0.45)]'
                          : 'bg-white/20 text-white'
                      : isMe
                          ? 'bg-empyrean-gold/15 text-empyrean-gold/70 border border-empyrean-gold/30'
                          : 'bg-white/5 text-white/35 border border-white/10',
                  ].join(' ')}>
                    {isMe ? 'You' : getPlayerName(pid)}
                  </div>
                  {i < upcomingPicks.length - 1 && (
                    <span className="text-white/15 text-xs">›</span>
                  )}
                </div>
              );
            })}
            {draft.pickIndex + upcomingPicks.length < totalPicks && (
              <span className="text-white/20 text-xs shrink-0">…</span>
            )}
          </div>
        )}

        {/* Draft complete banner */}
        {isDraftComplete && (
          <div className="rounded-xl border border-empyrean-gold/40 bg-empyrean-gold/5 px-5 py-4 text-center">
            <p className="font-display text-empyrean-gold font-bold text-lg">Draft Complete!</p>
            <p className="text-white/50 text-sm mt-1">Starting game…</p>
          </div>
        )}

        {/* Hero grid — with "not your turn" overlay */}
        <div className="relative">
          <div className={[
            'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3',
            !isMyPick && !isDraftComplete ? 'pointer-events-none' : '',
          ].join(' ')}>
            {HEROES.map((hero) => {
              const isPicked   = !availableIds.has(hero.id);
              const pickedBy   = heroPicker[hero.id];
              const pickedByMe = pickedBy === playerId;

              let cardState: CardState;
              if (isPicked) {
                cardState = pickedByMe ? 'picked-by-me' : 'picked-by-other';
              } else if (selectedHeroId === hero.id) {
                cardState = 'selected';
              } else if (!isMyPick) {
                cardState = 'waiting';
              } else {
                cardState = 'available';
              }

              return (
                <DraftHeroCard
                  key={hero.id}
                  hero={hero}
                  state={cardState}
                  pickedByName={pickedBy ? getPlayerName(pickedBy) : undefined}
                  onClick={() => handleCardClick(hero)}
                />
              );
            })}
          </div>

          {/* Waiting overlay */}
          {!isMyPick && !isDraftComplete && (
            <div className="absolute inset-0 flex items-start justify-center pt-20 pointer-events-none">
              <div className={[
                'rounded-2xl border border-white/10 bg-empyrean-navyDark/90 backdrop-blur-sm',
                'px-8 py-5 text-center shadow-2xl',
              ].join(' ')}>
                <p className="font-display font-bold text-white text-lg">
                  Waiting for {currentPickerName}…
                </p>
                <p className="text-white/40 text-sm mt-1">
                  Cards will be available on your turn
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sidebar — draft history ───────────────────────────────────────────── */}
      <aside className="w-52 shrink-0 space-y-4 hidden lg:flex lg:flex-col">

        {/* Pick history */}
        <div>
          <h2 className="font-display text-xs text-white/50 uppercase tracking-widest mb-2">
            Draft History
          </h2>
          {history.length === 0 ? (
            <p className="text-white/25 text-xs">No picks yet.</p>
          ) : (
            <div className="space-y-1.5">
              {history.map((item, i) => {
                const hero = HEROES.find((h) => h.id === item.heroId);
                return (
                  <div
                    key={i}
                    className={[
                      'flex items-center gap-2 rounded-lg px-2.5 py-2 border',
                      item.isMe
                        ? 'bg-empyrean-gold/8 border-empyrean-gold/25'
                        : 'bg-white/3 border-white/8',
                    ].join(' ')}
                  >
                    <span className="text-white/25 font-mono text-[10px] w-4 shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className={[
                        'text-xs font-semibold leading-tight truncate',
                        item.isMe ? 'text-empyrean-gold' : 'text-white/70',
                      ].join(' ')}>
                        {hero?.heroName ?? item.heroId}
                      </p>
                      <p className="text-[10px] text-white/30 truncate">{item.pickerName}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* My picks summary */}
        {playerId && (draft.picks[playerId]?.length ?? 0) > 0 && (
          <div className="border-t border-white/10 pt-3">
            <h3 className="font-display text-xs text-empyrean-gold/60 uppercase tracking-widest mb-2">
              Your Picks
            </h3>
            <div className="space-y-1.5">
              {(draft.picks[playerId] ?? []).map((heroId) => {
                const hero = HEROES.find((h) => h.id === heroId);
                if (!hero) return null;
                return (
                  <div
                    key={heroId}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 bg-empyrean-gold/5 border border-empyrean-gold/20"
                  >
                    <div className="w-7 h-7 rounded overflow-hidden bg-empyrean-navy/60 shrink-0">
                      <img
                        src={`/assets/heroes/${hero.heroName.toLowerCase()}.png`}
                        alt={hero.heroName}
                        className="w-full h-full object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-empyrean-gold font-semibold truncate">
                        {hero.heroName}
                      </p>
                      <p className="text-[10px] text-white/35">
                        {hero.attack}⚔ {hero.defense}🛡
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
