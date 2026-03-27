import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGameContext } from '../context/GameContext';
import DraftBoard from '../components/game/DraftBoard';

export default function Draft() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { gameState } = useGameContext();

  // Navigate away when draft phase ends
  useEffect(() => {
    if (gameState?.phase === 'gameplay') {
      navigate(`/game/${roomCode}`);
    }
  }, [gameState?.phase, roomCode, navigate]);

  if (!gameState) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-white/50 animate-pulse">Loading draft…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10">
        <h1 className="font-display text-lg text-empyrean-gold">Draft Phase</h1>
        <span className="text-sm text-white/50">Room: {roomCode}</span>
      </header>

      <main className="flex-1 overflow-auto p-4">
        <DraftBoard />
      </main>
    </div>
  );
}
