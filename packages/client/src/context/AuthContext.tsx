import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { apiLogin, apiRegister } from '../api/client';
import { resetSocket } from '../socket/client';

// ─────────────────────────────────────────────────────────────────────────────
// Auth context — manages JWT session and user account data
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerStats {
  accountId: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  gamesPlayed: number;
}

export interface AuthUser {
  accountId: string;
  username: string;
  stats: PlayerStats | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  authError: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<void>;
  logout: () => void;
  clearAuthError: () => void;
  updateStats: (stats: PlayerStats) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadInitialAuth(): { user: AuthUser | null; token: string | null } {
  try {
    const token = localStorage.getItem('auth_token');
    const raw = localStorage.getItem('auth_user');
    if (token && raw) {
      const user = JSON.parse(raw) as AuthUser;
      return { token, user };
    }
  } catch {
    // ignore corrupt storage
  }
  return { user: null, token: null };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const initial = loadInitialAuth();
  const [user, setUser] = useState<AuthUser | null>(initial.user);
  const [token, setToken] = useState<string | null>(initial.token);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const saveSession = useCallback((authUser: AuthUser, authToken: string) => {
    setUser(authUser);
    setToken(authToken);
    localStorage.setItem('auth_token', authToken);
    localStorage.setItem('auth_user', JSON.stringify(authUser));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const res = await apiLogin(username, password);
      saveSession(
        { accountId: res.account.id, username: res.account.username, stats: res.stats },
        res.token,
      );
      // Recreate socket so the new JWT is sent in the handshake
      resetSocket();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }, [saveSession]);

  const register = useCallback(async (username: string, password: string, email?: string) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const res = await apiRegister(username, password, email);
      saveSession(
        { accountId: res.account.id, username: res.account.username, stats: res.stats },
        res.token,
      );
      resetSocket();
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  }, [saveSession]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    resetSocket();
  }, []);

  const clearAuthError = useCallback(() => setAuthError(null), []);

  const updateStats = useCallback((stats: PlayerStats) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, stats };
      localStorage.setItem('auth_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, authError, login, register, logout, clearAuthError, updateStats }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
