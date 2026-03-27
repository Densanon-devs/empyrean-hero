import { useMemo } from 'react';
import { useGameContext } from '../context/GameContext';
import type { PlayerState, ArenaHero, GameState } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// useGameState — derived selectors over the core game state
// ─────────────────────────────────────────────────────────────────────────────

export function useGameState() {
  const { gameState, playerId } = useGameContext();
  return { gameState, playerId };
}

/** Returns the local player's PlayerState, or null if not in a game */
export function useMyPlayer(): PlayerState | null {
  const { gameState, playerId } = useGameContext();
  if (!gameState || !playerId) return null;
  return gameState.players[playerId] ?? null;
}

/** Returns all opponent PlayerStates */
export function useOpponents(): PlayerState[] {
  const { gameState, playerId } = useGameContext();
  if (!gameState || !playerId) return [];
  return Object.values(gameState.players).filter((p) => p.id !== playerId);
}

/** Returns whether it is the local player's turn */
export function useIsMyTurn(): boolean {
  const { gameState, playerId } = useGameContext();
  return gameState?.currentPlayerId === playerId;
}

/** Returns arena heroes for a specific player */
export function useArenaHeroes(targetPlayerId: string): ArenaHero[] {
  const { gameState } = useGameContext();
  return gameState?.players[targetPlayerId]?.arena ?? [];
}

/** Returns the current game phase */
export function useGamePhase(): GameState['phase'] | null {
  const { gameState } = useGameContext();
  return gameState?.phase ?? null;
}

/** Returns the active HERO action for this turn, or null */
export function useActiveTurnAction(): GameState['activeTurnAction'] {
  const { gameState } = useGameContext();
  return gameState?.activeTurnAction ?? null;
}

/** Returns a flat list of all players sorted by turn order */
export function useTurnOrderedPlayers(): PlayerState[] {
  const { gameState } = useGameContext();
  return useMemo(() => {
    if (!gameState) return [];
    return gameState.turnOrder
      .map((id) => gameState.players[id])
      .filter((p): p is PlayerState => p !== undefined);
  }, [gameState]);
}
