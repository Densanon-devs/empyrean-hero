import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import { useIsMyTurn, useMyPlayer, useOpponents } from '../hooks/useGameState';
import Arena from '../components/game/Arena';
import Hand from '../components/game/Hand';
import ActionSelector from '../components/game/ActionSelector';
import PlayerInfo from '../components/game/PlayerInfo';
import CombatResolver from '../components/game/CombatResolver';
import GameLog from '../components/game/GameLog';
import HeroicFeatModal from '../components/game/HeroicFeatModal';

export default function GameBoard() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { gameState, gameEvents } = useGameContext();
  const isMyTurn = useIsMyTurn();
  const me = useMyPlayer();
  const opponents = useOpponents();

  // Local flag: player clicked O and is composing an Overcome before submitting
  const [overcomePending, setOvercomePending] = useState(false);
  const [showHeroicFeat, setShowHeroicFeat] = useState(false);

  // Clear the local flag whenever it stops being my turn or the action advances
  useEffect(() => {
    if (!isMyTurn) setOvercomePending(false);
  }, [isMyTurn]);

  // Navigate to results when game ends
  useEffect(() => {
    if (gameState?.phase === 'gameover') {
      navigate(`/game/${roomCode}/result`);
    }
  }, [gameState?.phase, roomCode, navigate]);

  // Redirect to draft if still in that phase
  useEffect(() => {
    if (gameState?.phase === 'draft') {
      navigate(`/game/${roomCode}/draft`);
    }
  }, [gameState?.phase, roomCode, navigate]);

  // Detect "Going Nuclear" event and show a prominent notification
  const [nuclearNotice, setNuclearNotice] = useState<string | null>(null);
  useEffect(() => {
    const last = gameEvents[gameEvents.length - 1];
    if (last?.type === 'ABILITY_TRIGGERED') {
      const payload = last.payload as Record<string, unknown>;
      if ((payload.cardName ?? payload.abilityName) === 'Going Nuclear') {
        setNuclearNotice(payload.description as string ?? '☢ Going Nuclear! All field cards removed!');
        setTimeout(() => setNuclearNotice(null), 4000);
      }
    }
  }, [gameEvents]);

  if (!gameState || !me) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-white/50 animate-pulse">Loading game…</p>
      </div>
    );
  }

  // Show CombatResolver when:
  //  a) player clicked O (overcomePending) — picking attackers/defenders
  //  b) activeTurnAction is already 'overcome' — mid-combat phase from server
  const showCombatResolver = isMyTurn && (overcomePending || gameState.activeTurnAction === 'overcome');

  // Show ActionSelector when it's my turn, no action chosen, and not in combat
  const showActionSelector = isMyTurn && gameState.activeTurnAction === null && !overcomePending;

  // Heroic feats available to play this turn
  const hasHeroicFeats = me.heroicFeats.length > 0;

  return (
    <div className="flex min-h-dvh flex-col bg-empyrean-navyDark">
      {/* Going Nuclear overlay */}
      {nuclearNotice && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="animate-bounce rounded-2xl border-2 border-red-500 bg-red-900/80 px-8 py-5 text-center shadow-[0_0_60px_rgba(239,68,68,0.6)]">
            <p className="text-3xl mb-2">☢</p>
            <p className="font-display font-bold text-xl text-red-300">GOING NUCLEAR</p>
            <p className="text-sm text-white/70 mt-1">{nuclearNotice}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/10 text-sm shrink-0">
        <span className="text-empyrean-gold font-display">Round {gameState.round}</span>
        <span className={`font-semibold ${isMyTurn ? 'text-green-400' : 'text-white/50'}`}>
          {isMyTurn
            ? 'Your Turn'
            : `${gameState.players[gameState.currentPlayerId]?.name ?? '…'}'s Turn`}
        </span>
        <span className="text-white/40 text-xs">Room: {roomCode}</span>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row min-h-0">
        {/* Opponents area */}
        <div className="flex flex-col gap-4 p-3 lg:w-1/2 lg:border-r border-b border-white/10 lg:border-b-0 overflow-y-auto">
          {opponents.map((opp) => (
            <div key={opp.id}>
              <PlayerInfo player={opp} isCurrentTurn={gameState.currentPlayerId === opp.id} />
              <Arena playerId={opp.id} isOwn={false} />
            </div>
          ))}
        </div>

        {/* My area */}
        <div className="flex flex-col gap-3 p-3 lg:w-1/2 overflow-y-auto">
          <PlayerInfo player={me} isCurrentTurn={isMyTurn} isMe />
          <Arena playerId={me.id} isOwn />

          {/* Heroic Feat button — available on your turn if feats remain */}
          {isMyTurn && hasHeroicFeats && gameState.activeTurnAction === null && !overcomePending && (
            <button
              className="w-full text-xs border border-empyrean-gold/30 text-empyrean-gold/70 hover:border-empyrean-gold hover:text-empyrean-gold rounded-lg py-1.5 transition-colors"
              onClick={() => setShowHeroicFeat(true)}
            >
              🌟 Use Heroic Feat ({me.heroicFeats.length} available)
            </button>
          )}

          {showActionSelector && (
            <ActionSelector onOvercome={() => setOvercomePending(true)} />
          )}

          {showCombatResolver && (
            <CombatResolver onCancel={() => setOvercomePending(false)} />
          )}

          {/* Active turn phase indicator (when not my turn) */}
          {!isMyTurn && (
            <div className="text-center text-xs text-white/30 py-2">
              Waiting for {gameState.players[gameState.currentPlayerId]?.name ?? '…'} to act…
              {gameState.activeTurnAction && (
                <span className="ml-1 text-white/50">
                  ({gameState.activeTurnAction.charAt(0).toUpperCase() + gameState.activeTurnAction.slice(1)} action)
                </span>
              )}
            </div>
          )}

          <div className="mt-auto">
            <Hand />
          </div>
        </div>
      </div>

      {/* Game log — full-width bottom panel */}
      <GameLog />

      {/* Heroic Feat modal */}
      {showHeroicFeat && (
        <HeroicFeatModal onClose={() => setShowHeroicFeat(false)} />
      )}
    </div>
  );
}
