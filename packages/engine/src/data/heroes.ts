import type { HeroCard, HeroName, TriggerEvent } from '../types/cards';

// ─────────────────────────────────────────────────────────────────────────────
// Hero card definitions — all 20 heroes
// Ability descriptions and trigger events match the full Empyrean Hero ruleset.
// ─────────────────────────────────────────────────────────────────────────────

function makeHero(
  heroName: HeroName,
  attack: number,
  defense: number,
  abilityName: string,
  abilityType: 'A' | 'P' | 'H',
  abilityDescription: string,
  lore: string,
  triggerEvent?: TriggerEvent,
): HeroCard {
  return {
    id: `hero-${heroName.toLowerCase().replace(/\s+/g, '-')}`,
    name: heroName,
    type: 'hero',
    heroName,
    attack,
    defense,
    ability: { name: abilityName, abilityType, description: abilityDescription, triggerEvent },
    illustrationRef: `heroes/${heroName.toLowerCase()}.png`,
    lore,
  };
}

export const HEROES: readonly HeroCard[] = [
  makeHero(
    'Akio', 30, 20,
    'Unchecked', 'P',
    'When Akio causes another hero to be fatigued, Akio is not fatigued.',
    'Swift as summer lightning — Akio strikes before the enemy can even draw breath.',
    'on_fatigue_enemy',
  ),
  makeHero(
    'Ayumi', 20, 30,
    'Endless Support', 'P',
    'Whenever a hero is recruited to any arena, draw a card from your Enhancement Deck.',
    'Her hands carry warmth from a distant star. Where she touches, wounds close.',
    'on_recruit',
  ),
  makeHero(
    'Boulos', 15, 50,
    'Fortified', 'P',
    'For each card in hand, Boulos gains +10 defense.',
    'He has never taken a step back. Not once.',
    'on_defend',
  ),
  makeHero(
    'Christoph', 35, 35,
    'Measured Response', 'P',
    'When an attack against Christoph is resolved, choose one attacking hero to be defeated (even if Christoph is also defeated).',
    'Every move calculated. Every outcome considered. Christoph has already won three turns from now.',
    'on_defend',
  ),
  makeHero(
    'Eng', 25, 30,
    'Triage', 'A',
    'After completing your Action this turn, heal one hero of your choice.',
    'Nothing goes to waste. Every broken piece becomes the next solution.',
  ),
  makeHero(
    'Gambito', 40, 15,
    'High Stakes', 'P',
    'When ANY hero is fatigued, ALL players must discard a random card from hand. This ability must be used. If Gambito is defeated, it does NOT trigger for the attacking heroes since they fatigue after the outcome.',
    'He bets everything on every hand. Somehow, he keeps winning.',
    'on_fatigue',
  ),
  makeHero(
    'Grit', 35, 30,
    'Battle Hardened', 'P',
    '+20 attack for every fatigued hero currently on the field (both sides).',
    'She has been knocked down more times than anyone can count. She has gotten up every single time.',
  ),
  makeHero(
    'Hindra', 25, 35,
    'Lockdown', 'A',
    'Choose one opponent — that player cannot play Ability Cards to the field on their next turn.',
    'Retreat is not surrender. It is the setup for the decisive blow.',
  ),
  makeHero(
    'Ignacia', 50, 15,
    'Relentless', 'A',
    'Ignacia may attack once per turn while fatigued (strengthened allies may join). This attack cannot be combined with her normal strengthened attack — it must be a separate declaration.',
    'She doesn\'t just burn bridges — she turns the whole battlefield to ash.',
  ),
  makeHero(
    'Isaac', 30, 30,
    'Scavenger', 'P',
    'When another hero is defeated, you may draw one card from your Discard Pile (a card that was there before this defeat).',
    'Three moves ahead. Five, if he\'s interested.',
    'on_defeat_ally',
  ),
  makeHero(
    'Izumi', 25, 40,
    'Guardian Aura', 'P',
    'Allied heroes gain +20 defense while Izumi is in the arena. For fatigued allied heroes, this bonus is applied AFTER their defense is halved.',
    'Like water finding cracks — she yields, then flows right through you.',
    'on_defend',
  ),
  makeHero(
    'Kay', 35, 25,
    'Field Play', 'A',
    'Play a card to the field from your hand.',
    'Kay has read the room before she\'s walked into it.',
  ),
  makeHero(
    'Kyauta', 30, 35,
    'Advance', 'A',
    'After completing your Action, fatigue one of your strengthened heroes, then recruit one hero from the top of your Reserves to your play area.',
    'Every gift carries a purpose. Kyauta is no exception.',
  ),
  makeHero(
    'Mace', 45, 25,
    'Overwhelming Force', 'P',
    'Mace may double the Total Attack for one attack on your turn.',
    'There is no coming back from Mace.',
    'on_attack',
  ),
  makeHero(
    'Michael', 30, 30,
    'Quick Study', 'A',
    'Draw a card from your Enhancement Deck to hand.',
    'When Michael speaks, armies follow.',
  ),
  makeHero(
    'Origin', 20, 50,
    'Ancient Ward', 'P',
    'During each opponent\'s turn, you may block one attack declared against Origin.',
    'Origin predates the conflict. Origin will outlast it.',
    'on_combat_start',
  ),
  makeHero(
    'Rohan', 40, 30,
    'Rally', 'A',
    'For each fatigued hero currently on the field (both sides), recruit one hero from your HQ or Reserves to your hand.',
    'Grief is fuel. Loss sharpens every edge.',
  ),
  makeHero(
    'Yasmine', 35, 30,
    'Opportunist', 'P',
    'When an attack against Yasmine is resolved, play a card to the field from your hand (whether Yasmine is defeated or not).',
    'The fight she chose is never the fight you prepared for.',
    'on_defend',
  ),
  makeHero(
    'Zhao', 40, 20,
    'War Banner', 'P',
    'All allied heroes gain +10 attack. When Zhao is defeated or removed from the field, play a card from your hand to the field.',
    'Patience is his weapon. Darkness, his armor.',
    'on_attack',
  ),
  makeHero(
    'Zoe', 30, 30,
    'Refresh', 'A',
    'Before performing your Action this turn, heal any hero(es) of your choice.',
    'She has never been just one thing. That is the point.',
  ),
] as const;

export function getHeroByName(name: HeroName): HeroCard | undefined {
  return HEROES.find((h) => h.heroName === name);
}

export function getHeroById(id: string): HeroCard | undefined {
  return HEROES.find((h) => h.id === id);
}
