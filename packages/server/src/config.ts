// ─────────────────────────────────────────────────────────────────────────────
// Server configuration — reads from environment variables
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  port: Number(process.env['PORT'] ?? 3001),
  clientOrigin: process.env['CLIENT_ORIGIN'] ?? 'http://localhost:5173',
  /** Max players per room */
  maxRoomSize: Number(process.env['MAX_ROOM_SIZE'] ?? 4),
  /** Minutes before an idle room is cleaned up */
  roomIdleTimeoutMinutes: Number(process.env['ROOM_IDLE_TIMEOUT_MINUTES'] ?? 30),
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
  /** JWT signing secret — override in production via JWT_SECRET env var */
  jwtSecret: process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production',
} as const;

export type Config = typeof config;
