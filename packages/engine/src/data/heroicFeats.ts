import type { HeroicFeatCard, HeroicFeatName } from '../types/cards';

// ─────────────────────────────────────────────────────────────────────────────
// Heroic Feat card definitions — the (H) type abilities
// These are powerful once-per-game cards assigned during setup/draft.
// ─────────────────────────────────────────────────────────────────────────────

function makeFeat(featName: HeroicFeatName, description: string): HeroicFeatCard {
  return {
    id: `feat-${featName.toLowerCase().replace(/[\s]+/g, '-')}`,
    name: `${featName} (H)`,
    type: 'heroic-feat',
    featName,
    description,
  };
}

export const HEROIC_FEATS: readonly HeroicFeatCard[] = [
  makeFeat(
    'Absorb',
    '(H) Once per game. Until the end of this round, all attacks targeting your heroes are fully absorbed — ' +
    'no fatigue, no defeat. Your heroes cannot be harmed this round.',
  ),
  makeFeat(
    'Drain',
    '(H) Once per game. All enemy arena heroes simultaneously lose 20 ATK and 20 DEF until end of round. ' +
    'Your heroes gain equal bonuses (+20 ATK and +20 DEF) until end of round.',
  ),
  makeFeat(
    'Pay the Cost',
    '(H) Once per game. Sacrifice (defeat) one of your own arena heroes. In return, automatically defeat ' +
    'one target enemy arena hero of your choice, regardless of combat math.',
  ),
  makeFeat(
    'Under Siege',
    '(H) Once per game. Trigger when you are attacked. All of your arena heroes gain +30 DEF for this ' +
    'combat and each attacking enemy hero takes 10 ATK reflected damage (they become fatigued if their ' +
    'combined reflected damage meets the fatigue threshold).',
  ),
] as const;

export function getHeroicFeatByName(name: HeroicFeatName): HeroicFeatCard | undefined {
  return HEROIC_FEATS.find((f) => f.featName === name);
}

export function getHeroicFeatById(id: string): HeroicFeatCard | undefined {
  return HEROIC_FEATS.find((f) => f.id === id);
}
