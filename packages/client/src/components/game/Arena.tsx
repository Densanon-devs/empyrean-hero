import { useGameContext } from '../../context/GameContext';
import HeroCardDisplay from '../cards/HeroCardDisplay';
import type { ArenaHero } from '@empyrean-hero/engine';

// ─────────────────────────────────────────────────────────────────────────────
// Arena — the play area showing a player's SkyBase and deployed heroes
// ─────────────────────────────────────────────────────────────────────────────

interface ArenaProps {
  playerId: string;
  /** Called when a hero in this arena is clicked (for attack declaration) */
  onHeroClick?: (hero: ArenaHero) => void;
  /** Highlight these hero instance IDs as selected */
  selectedHeroIds?: string[];
}

export default function Arena({ playerId, onHeroClick, selectedHeroIds = [] }: ArenaProps) {
  const { gameState } = useGameContext();
  const player = gameState?.players[playerId];

  if (!player) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* SkyBase indicator */}
      <div
        className={[
          'flex items-center gap-2 rounded-lg px-3 py-1.5 border text-xs',
          player.skyBase.defeated
            ? 'border-red-500/40 bg-red-900/20 text-red-400'
            : 'border-empyrean-gold/30 bg-empyrean-gold/5 text-empyrean-gold/80',
        ].join(' ')}
      >
        <span className="text-base">{player.skyBase.defeated ? '💥' : '🏰'}</span>
        <span className="font-display font-semibold">{player.skyBase.name}</span>
        {player.skyBase.defeated && <span className="ml-auto text-red-400">DESTROYED</span>}
      </div>

      {/* Heroes in arena */}
      <div className="flex flex-wrap gap-2 min-h-[64px]">
        {player.arena.length === 0 ? (
          <p className="text-xs text-white/30 italic self-center px-2">No heroes deployed</p>
        ) : (
          player.arena.map((arenaHero) => (
            <div
              key={arenaHero.instanceId}
              className={[
                'relative cursor-pointer transition-transform',
                selectedHeroIds.includes(arenaHero.instanceId) ? 'ring-2 ring-empyrean-gold rounded-xl' : '',
              ].join(' ')}
              onClick={() => onHeroClick?.(arenaHero)}
            >
              <HeroCardDisplay
                card={arenaHero.heroCard}
                fatigued={arenaHero.fatigued}
              />

              {/* Stat card indicators */}
              {arenaHero.appliedStatCards.length > 0 && (
                <div className="absolute -top-1 -right-1 flex gap-0.5">
                  {arenaHero.appliedStatCards.map((sc, i) => (
                    <span
                      key={i}
                      className={`rounded px-1 text-[9px] font-bold ${
                        sc.statType === 'ATT' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
                      }`}
                    >
                      +{sc.value}
                    </span>
                  ))}
                </div>
              )}

              {/* Temp bonus indicators */}
              {(arenaHero.tempAttackBonus > 0 || arenaHero.tempDefenseBonus > 0) && (
                <div className="absolute -bottom-1 left-0 right-0 flex justify-center gap-1">
                  {arenaHero.tempAttackBonus > 0 && (
                    <span className="rounded px-1 text-[9px] font-bold bg-orange-500/80 text-white">
                      +{arenaHero.tempAttackBonus}⚔
                    </span>
                  )}
                  {arenaHero.tempDefenseBonus > 0 && (
                    <span className="rounded px-1 text-[9px] font-bold bg-cyan-500/80 text-white">
                      +{arenaHero.tempDefenseBonus}🛡
                    </span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pool size indicator */}
      {player.heroPool.length > 0 && (
        <p className="text-xs text-white/40">
          {player.heroPool.length} hero{player.heroPool.length !== 1 ? 'es' : ''} in reserve
        </p>
      )}
    </div>
  );
}
