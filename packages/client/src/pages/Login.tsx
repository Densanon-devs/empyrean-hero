import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// Login / Register page
// ─────────────────────────────────────────────────────────────────────────────

type Mode = 'login' | 'register';

export default function Login() {
  const { login, register, isLoading, authError, clearAuthError } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');

  async function handleSubmit() {
    clearAuthError();
    if (mode === 'login') {
      await login(username, password);
    } else {
      await register(username, password, email || undefined);
    }
    // If no error, navigate home
    if (!authError) navigate('/');
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <Link to="/" className="absolute top-4 left-4 text-white/40 hover:text-white text-sm">
        ← Back
      </Link>

      <div className="panel w-full max-w-sm space-y-4">
        <h2 className="font-display text-2xl text-empyrean-gold">
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h2>

        <div>
          <label className="block text-sm text-white/60 mb-1">Username</label>
          <input
            className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-empyrean-gold/60"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={24}
            autoComplete="username"
          />
        </div>

        <div>
          <label className="block text-sm text-white/60 mb-1">Password</label>
          <input
            type="password"
            className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-empyrean-gold/60"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        {mode === 'register' && (
          <div>
            <label className="block text-sm text-white/60 mb-1">Email <span className="text-white/30">(optional)</span></label>
            <input
              type="email"
              className="w-full rounded-lg bg-white/10 border border-white/20 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:border-empyrean-gold/60"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        )}

        {authError && (
          <p className="text-red-400 text-sm">{authError}</p>
        )}

        <button
          className="btn-primary w-full"
          onClick={handleSubmit}
          disabled={isLoading || !username.trim() || !password.trim()}
        >
          {isLoading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        <div className="text-center text-sm text-white/40">
          {mode === 'login' ? (
            <>
              No account?{' '}
              <button onClick={() => setMode('register')} className="text-empyrean-gold hover:underline">
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => setMode('login')} className="text-empyrean-gold hover:underline">
                Sign in
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-white/30 text-xs">
          <div className="flex-1 border-t border-white/10" />
          or continue without account
          <div className="flex-1 border-t border-white/10" />
        </div>

        <button
          className="btn-secondary w-full text-sm"
          onClick={() => navigate('/lobby')}
        >
          Play as Guest
        </button>
      </div>
    </div>
  );
}
