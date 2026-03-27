import { Routes, Route } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { useSocket } from './hooks/useSocket';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Draft from './pages/Draft';
import GameBoard from './pages/GameBoard';
import GameOver from './pages/GameOver';

// ─────────────────────────────────────────────────────────────────────────────
// App root — socket setup lives here so context is available app-wide
// ─────────────────────────────────────────────────────────────────────────────

function AppInner() {
  useSocket(); // Connect and wire socket → context

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/lobby" element={<Lobby />} />
      <Route path="/game/:roomCode/draft" element={<Draft />} />
      <Route path="/game/:roomCode" element={<GameBoard />} />
      <Route path="/game/:roomCode/result" element={<GameOver />} />
    </Routes>
  );
}

export default function App() {
  return (
    <GameProvider>
      <AppInner />
    </GameProvider>
  );
}
