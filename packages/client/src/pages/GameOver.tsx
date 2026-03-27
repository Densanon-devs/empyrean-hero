import { useNavigate } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';

const REASON_LABELS: Record<string, string> = {
  'all-skybases-defeated': 'All opposing Sky Bases were destroyed',
  'no-heroes-3-turns': 'Opponent had no heroes for 3 consecutive turns',
  'draw-no-action': 'Draw — 5 turns passed with no meaningful action',
  'draw-attack-loop': 'Draw — 6-attack loop detected',
};

export default function GameOver() {
  const navigate = useNavigate();
  const { gameState, playerId } = useGameContext();

  const result = gameState?.result;
  const isTeamPlay = gameState?.mode === 'team-play';
  const isDraw = result?.winnerIds === null;
  const isWinner = result?.winnerIds?.includes(playerId ?? '') ?? false;

  // For team play, find my team and the winning team
  const myTeamId = playerId ? gameState?.players[playerId]?.teamId : undefined;
  const winnerTeamId = isTeamPlay && result?.winnerIds
    ? gameState?.players[result.winnerIds[0] ?? '']?.teamId
    : undefined;
  const myTeamWon = isTeamPlay && myTeamId !== undefined && myTeamId === winnerTeamId;

  // Collect winning and losing team members for display
  const winnerNames = isTeamPlay && result?.winnerIds
    ? result.winnerIds.map((id) => gameState?.players[id]?.name ?? id)
    : null;
  const loserNames = isTeamPlay && result?.loserIds
    ? result.loserIds.map((id) => gameState?.players[id]?.name ?? id)
    : null;

  function handlePlayAgain() {
    navigate('/lobby');
  }

  const outcomeLabel = isDraw
    ? { title: 'Draw', subtitle: 'A hard-fought stalemate', cls: 'text-empyrean-ash' }
    : isTeamPlay
      ? myTeamWon
        ? { title: 'Victory!', subtitle: 'Your team claims the skies', cls: 'text-empyrean-gold drop-shadow-glow text-5xl' }
        : { title: 'Defeat', subtitle: 'Your team has fallen', cls: 'text-empyrean-crimson' }
      : isWinner
        ? { title: 'Victory!', subtitle: 'The skies are yours', cls: 'text-empyrean-gold drop-shadow-glow text-5xl' }
        : { title: 'Defeat', subtitle: 'The battle is lost — but not the war', cls: 'text-empyrean-crimson' };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 text-center">
      {/* Outcome header */}
      <div className="animate-fade-in">
        <p className={`text-4xl font-display font-bold ${outcomeLabel.cls}`}>
          {outcomeLabel.title}
        </p>
        <p className="mt-1 text-white/50">{outcomeLabel.subtitle}</p>
      </div>

      {/* Reason */}
      {result && (
        <div className="panel max-w-sm w-full">
          <p className="text-sm text-white/50 uppercase tracking-wider mb-1">Reason</p>
          <p className="text-white">{REASON_LABELS[result.reason] ?? result.reason}</p>
        </div>
      )}

      {/* Team breakdown (Team Play only) */}
      {isTeamPlay && !isDraw && winnerNames && loserNames && (
        <div className="panel max-w-sm w-full space-y-3">
          <div>
            <p className="text-xs text-empyrean-gold/70 uppercase tracking-wider mb-1">Winning Team</p>
            <p className="text-white text-sm">{winnerNames.join(', ')}</p>
          </div>
          <div className="border-t border-white/10" />
          <div>
            <p className="text-xs text-white/40 uppercase tracking-wider mb-1">Defeated Team</p>
            <p className="text-white/60 text-sm">{loserNames.join(', ')}</p>
          </div>
        </div>
      )}

      {/* Action log snippet */}
      {gameState && gameState.actionLog.length > 0 && (
        <div className="panel max-w-sm w-full max-h-48 overflow-y-auto text-left">
          <p className="text-sm text-white/50 uppercase tracking-wider mb-2">Final Log</p>
          <ul className="space-y-1">
            {gameState.actionLog.slice(-10).map((entry, i) => (
              <li key={i} className="text-xs text-white/70">
                {entry}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button className="btn-primary" onClick={handlePlayAgain}>
          Play Again
        </button>
        <button className="btn-secondary" onClick={() => navigate('/')}>
          Main Menu
        </button>
      </div>
    </div>
  );
}
