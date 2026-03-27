import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import { useIsMyTurn, useMyPlayer, useOpponents } from '../hooks/useGameState';
import Arena from '../components/game/Arena';
import Hand from '../components/game/Hand';
import ActionSelector from '../components/game/ActionSelector';
import PlayerInfo from '../components/game/PlayerInfo';
import CombatResolver from '../components/game/CombatResolver';

export default function GameBoard() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { gameState } = useGameContext();
  const isMyTurn = useIsMyTurn();
  const me = useMyPlayer();
  const opponents = useOpponents();

  // Local flag: player clicked O and is composing an Overcome before submitting
  const [overcomePending, setOvercomePending] = useState(false);

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

  return (
    <div className="flex min-h-dvh flex-col bg-empyrean-navyDark">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-white/10 text-sm">
        <span className="text-empyrean-gold font-display">Round {gameState.round}</span>
        <span className={`font-semibold ${isMyTurn ? 'text-green-400' : 'text-white/50'}`}>
          {isMyTurn
            ? 'Your Turn'
            : `${gameState.players[gameState.currentPlayerId]?.name ?? '…'}'s Turn`}
        </span>
        <span className="text-white/40 text-xs">Room: {roomCode}</span>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* Opponents area */}
        <div className="flex flex-col gap-4 p-3 lg:w-1/2 lg:border-r border-b border-white/10 lg:border-b-0">
          {opponents.map((opp) => (
            <div key={opp.id}>
              <PlayerInfo player={opp} isCurrentTurn={gameState.currentPlayerId === opp.id} />
              <Arena playerId={opp.id} />
            </div>
          ))}
        </div>

        {/* My area */}
        <div className="flex flex-col gap-3 p-3 lg:w-1/2">
          <PlayerInfo player={me} isCurrentTurn={isMyTurn} isMe />
          <Arena playerId={me.id} />

          {showActionSelector && (
            <ActionSelector onOvercome={() => setOvercomePending(true)} />
          )}

          {showCombatResolver && (
            <CombatResolver onCancel={() => setOvercomePending(false)} />
          )}

          <div className="mt-auto">
            <Hand />
          </div>
        </div>
      </div>
    </div>
  );
}
