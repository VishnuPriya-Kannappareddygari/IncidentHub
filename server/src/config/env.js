import 'dotenv/config'

// Env vars are read only here; fail fast so misconfiguration shows at startup.
const required = ['DATABASE_URL', 'JWT_SECRET']
const missing = required.filter((key) => !process.env[key])
if (missing.length > 0) {
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
}

const int = (value, fallback) => (Number.isFinite(Number(value)) && value !== undefined && value !== '' ? Number(value) : fallback)

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: '8h',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  ai: {
    // Without a key every agent runs its deterministic heuristic; Claude is an upgrade, not a dependency.
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    enabled: process.env.AI_ENABLED !== 'false',
    dailyCallLimit: int(process.env.AI_DAILY_CALL_LIMIT, 500),
    timeoutMs: int(process.env.AI_TIMEOUT_MS, 20000),
    autoAnalyze: process.env.AI_AUTO_ANALYZE !== 'false',
  },
  slaSweepIntervalSeconds: int(process.env.SLA_SWEEP_INTERVAL_SECONDS, 60),
}
