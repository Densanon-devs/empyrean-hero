import type { StatCard } from '../types/cards';

// ─────────────────────────────────────────────────────────────────────────────
// Stat card definitions — DEF+20, DEF+30, ATT+20, ATT+30
// ─────────────────────────────────────────────────────────────────────────────

export const STAT_CARDS: readonly StatCard[] = [
  {
    id: 'stat-def-20',
    name: 'DEF+20',
    type: 'stat',
    statType: 'DEF',
    value: 20,
  },
  {
    id: 'stat-def-30',
    name: 'DEF+30',
    type: 'stat',
    statType: 'DEF',
    value: 30,
  },
  {
    id: 'stat-att-20',
    name: 'ATT+20',
    type: 'stat',
    statType: 'ATT',
    value: 20,
  },
  {
    id: 'stat-att-30',
    name: 'ATT+30',
    type: 'stat',
    statType: 'ATT',
    value: 30,
  },
] as const;

export function getStatCardById(id: string): StatCard | undefined {
  return STAT_CARDS.find((c) => c.id === id);
}
