# Empyrean Hero: The Card Game

A tactical card game built as a web app / PWA with real-time multiplayer.

## Monorepo Structure

```
empyrean-hero/
├── packages/
│   ├── engine/     — Shared game logic (TypeScript library)
│   ├── server/     — Node.js + Express + Socket.io backend
│   └── client/     — React 18 + Vite PWA frontend
├── package.json    — Workspace root
├── pnpm-workspace.yaml
└── tsconfig.json   — Base TypeScript config
```

## Prerequisites

- Node.js 20+
- pnpm 9+

## Getting Started

```bash
# Install all dependencies
pnpm install

# Start all packages in dev mode
pnpm dev

# Build all packages
pnpm build

# Type-check all packages
pnpm typecheck
```

## Game Overview

### Turn Structure — HERO Acronym

Each turn, the active player picks **one** action:

| Letter | Action  | Description |
|--------|---------|-------------|
| **H**  | Heal    | Un-fatigue heroes; play up to 3 enhancement cards |
| **E**  | Enhance | Draw up to 3 cards; play up to 3 enhancement cards |
| **R**  | Recruit | Deploy up to 2 heroes from your pool |
| **O**  | Overcome| Declare attackers; resolve combat |

### Combat Resolution

- **Attack ≥ Defense** → defending heroes **defeated**
- **Attack ≥ ½ Defense** → defending heroes **fatigued**
- **Attack < ½ Defense** → **no effect**
- Attacking heroes always fatigue after combat.

### Win Conditions

- All opposing SkyBases defeated, OR
- Opponent has no heroes in arena for **3 consecutive full turns**

### Draw Conditions

- 5 turns of no meaningful action, OR
- 6-attack loop detected

### Ability Types

- **(A) Active** — played from hand
- **(P) Passive** — triggers automatically on a game event
- **(H) Heroic Feat** — powerful once-per-game ability

### Heroes (20)

Akio, Ayumi, Boulos, Christoph, Eng, Gambito, Grit, Hindra, Ignacia, Isaac,
Izumi, Kay, Kyauta, Mace, Michael, Origin, Rohan, Yasmine, Zhao, Zoe

### Ability Cards (24)

Absorb, Accelerate, Backfire, Bolster, Boost, Collateral Damage, Convert,
Counter-Measures, Drain, Drought, Fortification, Going Nuclear, Hardened,
Impede, Kairos, Pay the Cost, Prevention, Protect, Reduction, Reinforcement,
Resurrect, Revelation, Shielding, Under Siege

### Heroic Feats (4)

Absorb (H), Drain (H), Pay the Cost (H), Under Siege (H)

## Game Modes

- **Free-For-All** — Every player for themselves
- **Team Play** — Teams of players cooperate to defeat opposing SkyBases

## Package Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages in watch/dev mode |
| `pnpm build` | Build all packages for production |
| `pnpm test` | Run tests across all packages |
| `pnpm typecheck` | TypeScript type-check all packages |
