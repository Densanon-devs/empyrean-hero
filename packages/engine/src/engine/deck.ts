import type { AbilityCard, StatCard } from '../types/cards';

export type DeckCard = AbilityCard | StatCard;

// ─────────────────────────────────────────────────────────────────────────────
// Deck / hand utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle (returns a new array) */
export function shuffleDeck<T>(deck: T[]): T[] {
  const out = [...deck];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // Non-null assertions safe because indices are always valid here
    const tmp = out[i] as T;
    out[i] = out[j] as T;
    out[j] = tmp;
  }
  return out;
}

/**
 * Draw `count` cards from the top of the deck.
 * If the deck runs out, auto-reshuffles from the discard pile.
 * Returns the drawn cards, the updated deck, and the updated discard pile.
 */
export function drawCards(
  deck: DeckCard[],
  discard: DeckCard[],
  count: number,
): { drawn: DeckCard[]; deck: DeckCard[]; discard: DeckCard[] } {
  let mutableDeck = [...deck];
  let mutableDiscard = [...discard];
  const drawn: DeckCard[] = [];

  for (let i = 0; i < count; i++) {
    if (mutableDeck.length === 0) {
      if (mutableDiscard.length === 0) break; // No cards left at all
      mutableDeck = shuffleDeck(mutableDiscard);
      mutableDiscard = [];
    }
    const card = mutableDeck.shift();
    if (card) drawn.push(card);
  }

  return { drawn, deck: mutableDeck, discard: mutableDiscard };
}

/**
 * Move a card from the hand to the discard pile by ID.
 * Returns the updated hand and discard pile.
 */
export function discardCard(
  hand: DeckCard[],
  discard: DeckCard[],
  cardId: string,
): { hand: DeckCard[]; discard: DeckCard[]; discarded: DeckCard | null } {
  const idx = hand.findIndex((c) => c.id === cardId);
  if (idx === -1) return { hand, discard, discarded: null };

  const newHand = [...hand];
  const [discarded] = newHand.splice(idx, 1);
  return {
    hand: newHand,
    discard: [...discard, discarded as DeckCard],
    discarded: discarded ?? null,
  };
}
