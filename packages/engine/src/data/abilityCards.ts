import type { AbilityCard, AbilityCardName, AbilityType } from '../types/cards';

// ─────────────────────────────────────────────────────────────────────────────
// Ability card definitions — all 24 cards
// Types: A = Active (play once, effect resolves, card goes to discard)
//        P = Passive (play to field attached to a hero, ongoing effect)
//        H = Heroic Feat (replaces entire turn, played from hand to discard)
// ─────────────────────────────────────────────────────────────────────────────

function makeAbility(
  cardName: AbilityCardName,
  abilityType: AbilityType,
  description: string,
): AbilityCard {
  return {
    id: `ability-${cardName.toLowerCase().replace(/[\s-]+/g, '-')}`,
    name: cardName,
    type: 'ability',
    cardName,
    abilityType,
    description,
  };
}

export const ABILITY_CARDS: readonly AbilityCard[] = [
  // ── Heroic Feats (H) — played from hand, replace the entire turn ─────────
  makeAbility(
    'Absorb', 'H',
    'Discard all enhancements (stat + ability cards) from one hero, then replace them with all enhancements from another hero. The source hero is left with no enhancements.',
  ),
  makeAbility(
    'Drain', 'H',
    'Discard ALL Enhancement Cards (ability cards on the field, stat cards) belonging to one opponent from the field.',
  ),
  makeAbility(
    'Pay the Cost', 'H',
    'Fatigue one of your strengthened heroes to remove one hero from the field (removal, not defeat — no defeat triggers fire). Choose the hero to remove with targetId.',
  ),
  makeAbility(
    'Under Siege', 'H',
    'Target opponent reveals their entire hand; they must then discard all non-hero cards from their hand.',
  ),

  // ── Active (A) — play once, effect resolves immediately, goes to discard ─
  makeAbility(
    'Accelerate', 'A',
    'Target player draws 3 cards from their Enhancement Deck, then must discard 2 cards from their hand.',
  ),
  makeAbility(
    'Backfire', 'A',
    'Target opponent reveals all Ability Cards on their field. You may use one of their Active Ability Cards as your own regardless of normal timing.',
  ),
  makeAbility(
    'Boost', 'A',
    'Discard 2 cards from your hand. Then choose any player — that player must draw one card for every hero currently on the field.',
  ),
  makeAbility(
    'Kairos', 'A',
    'After completing your chosen HERO action this turn, take one additional free HERO action (cannot be Overcome).',
  ),
  makeAbility(
    'Reduction', 'A',
    'Fatigue one of your strengthened heroes to cause any one player to discard 2 random cards from their hand.',
  ),
  makeAbility(
    'Revelation', 'A',
    'View one opponent\'s entire hand. You may then discard any one card from their hand.',
  ),

  // ── Passive (P) — play to the field attached to a hero; ongoing effects ──
  makeAbility(
    'Bolster', 'P',
    'For every strengthened (non-fatigued) hero on the field, this hero gains +10 attack.',
  ),
  makeAbility(
    'Collateral Damage', 'P',
    'When this hero defeats an enemy hero, you may fatigue one other strengthened enemy hero of your choice.',
  ),
  makeAbility(
    'Convert', 'P',
    'When this hero is defeated, take control of any one hero from the field (discarding that hero\'s enhancements). If the converted hero was fatigued, it remains fatigued.',
  ),
  makeAbility(
    'Counter-Measures', 'P',
    'When this hero is attacked, its Total Defense is increased by the base defense of all attacking heroes (excluding their enhancements).',
  ),
  makeAbility(
    'Drought', 'P',
    'When a Heroic Ability is used by any player, discard this card to nullify its effects. The affected player can still take an action that turn but cannot use ANY abilities for the rest of that turn.',
  ),
  makeAbility(
    'Fortification', 'P',
    'For every hero on the field (all sides), this hero gains +10 defense.',
  ),
  makeAbility(
    'Going Nuclear', 'P',
    'When this hero is attacked, ALL cards on the field are removed except SkyBases. This ability MUST be used — it cannot be withheld.',
  ),
  makeAbility(
    'Hardened', 'P',
    'For every opposing card on the field (enemy heroes + their stat cards + their ability cards), this hero gains +10 defense.',
  ),
  makeAbility(
    'Impede', 'P',
    'You may prevent the effects of one Active Ability Card per opponent turn.',
  ),
  makeAbility(
    'Prevention', 'P',
    'If this hero is attacked, discard this card to block that attack AND all other attacks against your heroes until the start of your next turn.',
  ),
  makeAbility(
    'Protect', 'P',
    'When another allied hero is attacked, prevent that hero from being fatigued or defeated until the end of your next turn.',
  ),
  makeAbility(
    'Reinforcement', 'P',
    'For every card in your hand, this hero gains +10 attack.',
  ),
  makeAbility(
    'Resurrect', 'P',
    'When this hero is defeated, return them to the field as strengthened (not fatigued) with no enhancement cards attached.',
  ),
  makeAbility(
    'Shielding', 'P',
    'If this hero is fatigued, they gain +20 defense for every strengthened (non-fatigued) hero on the field. This bonus is added AFTER the fatigued hero\'s defense is halved.',
  ),
] as const;

export function getAbilityCardByName(name: AbilityCardName): AbilityCard | undefined {
  return ABILITY_CARDS.find((c) => c.cardName === name);
}

export function getAbilityCardById(id: string): AbilityCard | undefined {
  return ABILITY_CARDS.find((c) => c.id === id);
}
