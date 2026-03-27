import { Routes, Route } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { AuthProvider } from './context/AuthContext';
import { FriendsProvider } from './context/FriendsContext';
import { useSocket } from './hooks/useSocket';
import { Nav, InviteToast } from './components/ui/Nav';
import Home from './pages/Home';
import Lobby from './pages/Lobby';
import Login from './pages/Login';
import Draft from './pages/Draft';
import GameBoard from './pages/GameBoard';
import GameOver from './pages/GameOver';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import Friends from './pages/Friends';

// ─────────────────────────────────────────────────────────────────────────────
// App root — providers wrap the whole tree, socket setup inside GameProvider
// ─────────────────────────────────────────────────────────────────────────────

function AppInner() {
  useSocket(); // Connect and wire socket → context

  return (
    <>
      <Nav />
      <InviteToast />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/login" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/profile/:username" element={<Profile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/game/:roomCode/draft" element={<Draft />} />
        <Route path="/game/:roomCode" element={<GameBoard />} />
        <Route path="/game/:roomCode/result" element={<GameOver />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <GameProvider>
        <FriendsProvider>
          <AppInner />
        </FriendsProvider>
      </GameProvider>
    </AuthProvider>
  );
}
