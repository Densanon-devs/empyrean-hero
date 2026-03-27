import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import type { FriendInfo, FriendRequest, OutgoingRequest, GameInvite } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// Friends context — real-time friend list, requests, and invites
// ─────────────────────────────────────────────────────────────────────────────

interface FriendsContextValue {
  friends: FriendInfo[];
  pendingRequests: FriendRequest[];
  outgoingRequests: OutgoingRequest[];
  pendingInvite: GameInvite | null;
  setFriendsList: (data: { friends: FriendInfo[]; pendingRequests: FriendRequest[]; outgoingRequests: OutgoingRequest[] }) => void;
  addPendingRequest: (req: FriendRequest) => void;
  updateFriendStatus: (accountId: string, online: boolean) => void;
  setInvite: (invite: GameInvite | null) => void;
  clearInvite: () => void;
}

const FriendsContext = createContext<FriendsContextValue | null>(null);

export function FriendsProvider({ children }: { children: ReactNode }) {
  const [friends, setFriends] = useState<FriendInfo[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<OutgoingRequest[]>([]);
  const [pendingInvite, setPendingInvite] = useState<GameInvite | null>(null);

  const setFriendsList = useCallback(
    (data: { friends: FriendInfo[]; pendingRequests: FriendRequest[]; outgoingRequests: OutgoingRequest[] }) => {
      setFriends(data.friends);
      setPendingRequests(data.pendingRequests);
      setOutgoingRequests(data.outgoingRequests);
    },
    [],
  );

  const addPendingRequest = useCallback((req: FriendRequest) => {
    setPendingRequests((prev) => [...prev.filter((r) => r.requestId !== req.requestId), req]);
  }, []);

  const updateFriendStatus = useCallback((accountId: string, online: boolean) => {
    setFriends((prev) =>
      prev.map((f) => (f.accountId === accountId ? { ...f, online } : f)),
    );
  }, []);

  const setInvite = useCallback((invite: GameInvite | null) => {
    setPendingInvite(invite);
  }, []);

  const clearInvite = useCallback(() => setPendingInvite(null), []);

  return (
    <FriendsContext.Provider
      value={{
        friends,
        pendingRequests,
        outgoingRequests,
        pendingInvite,
        setFriendsList,
        addPendingRequest,
        updateFriendStatus,
        setInvite,
        clearInvite,
      }}
    >
      {children}
    </FriendsContext.Provider>
  );
}

export function useFriends(): FriendsContextValue {
  const ctx = useContext(FriendsContext);
  if (!ctx) throw new Error('useFriends must be used inside <FriendsProvider>');
  return ctx;
}
