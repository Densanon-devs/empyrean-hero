import { useState } from 'react';
import { useGameContext } from '../../context/GameContext';
import type { GameEvent } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// GameLog — collapsible event feed showing the action log and recent events
// ─────────────────────────────────────────────────────────────────────────────

export default function GameLog() {
  const { gameState, gameEvents } = useGameContext();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'log' | 'events'>('events');

  const eventCount = gameEvents.length;

  return (
    <div className="border-t border-white/10">
      {/* Toggle bar */}
      <button
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-semibold uppercase tracking-wider">Game Log</span>
        <span className="flex items-center gap-2">
          {eventCount > 0 && (
            <span className="rounded-full bg-empyrean-gold/20 text-empyrean-gold/80 px-1.5 py-0.5 text-[10px]">
              {eventCount}
            </span>
          )}
          <span>{open ? '▲' : '▼'}</span>
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 max-h-48 overflow-hidden flex flex-col">
          {/* Tabs */}
          <div className="flex gap-2 shrink-0">
            <button
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${tab === 'events' ? 'border-empyrean-gold text-empyrean-gold bg-empyrean-gold/10' : 'border-white/20 text-white/40 hover:border-white/40'}`}
              onClick={() => setTab('events')}
            >
              Events
            </button>
            <button
              className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${tab === 'log' ? 'border-empyrean-gold text-empyrean-gold bg-empyrean-gold/10' : 'border-white/20 text-white/40 hover:border-white/40'}`}
              onClick={() => setTab('log')}
            >
              Action Log
            </button>
          </div>

          {tab === 'events' && (
            <div className="overflow-y-auto space-y-1 flex-1">
              {gameEvents.length === 0 ? (
                <p className="text-[11px] text-white/30 italic">No events yet.</p>
              ) : (
                [...gameEvents].reverse().map((ev, i) => (
                  <EventEntry key={i} event={ev} />
                ))
              )}
            </div>
          )}

          {tab === 'log' && (
            <div className="overflow-y-auto space-y-1 flex-1">
              {!gameState || gameState.actionLog.length === 0 ? (
                <p className="text-[11px] text-white/30 italic">No actions yet.</p>
              ) : (
                [...gameState.actionLog].reverse().map((entry, i) => (
                  <p key={i} className="text-[11px] text-white/60 leading-tight">
                    {entry}
                  </p>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Event entry renderer ──────────────────────────────────────────────────────

function EventEntry({ event }: { event: GameEvent }) {
  const { type, payload } = event as { type: string; payload: Record<string, unknown> };
  let label = '';
  let cls = 'text-white/60';

  switch (type) {
    case 'COMBAT_RESOLVED': {
      const r = payload.combatResult as { outcome: string; totalAttack: number; totalDefense: number } | undefined;
      if (r) {
        const outcomeEmoji = r.outcome === 'defeated' ? '💀' : r.outcome === 'fatigued' ? '😮' : '✋';
        label = `${outcomeEmoji} Combat: ${r.totalAttack} vs ${r.totalDefense} → ${r.outcome.toUpperCase()}`;
        cls = r.outcome === 'defeated' ? 'text-red-400' : r.outcome === 'fatigued' ? 'text-yellow-400' : 'text-white/50';
      }
      break;
    }
    case 'HERO_DEFEATED':
      label = `💀 ${payload.heroName as string} defeated`;
      cls = 'text-red-400';
      break;
    case 'HERO_FATIGUED':
      label = `😮 ${payload.heroName as string} fatigued`;
      cls = 'text-yellow-400';
      break;
    case 'HERO_HEALED':
      label = `💚 ${payload.heroName as string} healed`;
      cls = 'text-green-400';
      break;
    case 'HERO_RECRUITED':
      label = `➕ ${payload.heroName as string} recruited`;
      cls = 'text-blue-400';
      break;
    case 'ABILITY_TRIGGERED':
      label = `⚡ ${(payload.abilityName ?? payload.cardName ?? 'Ability') as string}: ${payload.description as string ?? ''}`;
      cls = 'text-purple-400';
      break;
    case 'ABILITY_NULLIFIED':
      label = `🚫 Ability nullified: ${payload.reason as string ?? ''}`;
      cls = 'text-orange-400';
      break;
    case 'HEROIC_FEAT_USED':
      label = `🌟 Heroic Feat: ${payload.featName as string}`;
      cls = 'text-empyrean-gold';
      break;
    case 'CARD_PLAYED':
      label = payload.cardName
        ? `🃏 ${payload.cardName as string} played`
        : `🃏 ${payload.count as number ?? 1} card(s) drawn`;
      cls = 'text-sky-400';
      break;
    case 'CARDS_DISCARDED':
      label = `🗑 ${payload.cardName as string} discarded${payload.reason ? ` (${payload.reason as string})` : ''}`;
      cls = 'text-white/40';
      break;
    case 'TURN_STARTED':
      label = `▶ Turn started (Round ${payload.round as number})`;
      cls = 'text-white/30 text-[10px]';
      break;
    case 'GAME_OVER':
      label = `🏆 GAME OVER`;
      cls = 'text-empyrean-gold font-bold';
      break;
    default:
      label = type.replace(/_/g, ' ');
  }

  return label ? (
    <p className={`text-[11px] leading-tight ${cls}`}>{label}</p>
  ) : null;
}
