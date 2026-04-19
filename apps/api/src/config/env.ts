import { config as loadEnv } from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

/** Load `.env` from cwd (Docker WORKDIR) or by walking up from this file (monorepo / dist layout). */
function loadDotenv() {
  const cwdFile = join(process.cwd(), '.env')
  if (existsSync(cwdFile)) {
    loadEnv({ path: cwdFile })
    return
  }
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let i = 0; i < 12; i++) {
    const candidate = join(dir, '.env')
    if (existsSync(candidate)) {
      loadEnv({ path: candidate })
      return
    }
    const up = dirname(dir)
    if (up === dir) break
    dir = up
  }
}

loadDotenv()

const emptyToUndefined = (v: unknown) => (v === '' || v === undefined ? undefined : v)

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters (use openssl rand -hex 32)'),
  CORS_ORIGIN: z.string().default('*'),
  TRAEFIK_DYNAMIC_CONFIG_PATH: z.string().default('/traefik-config/dynamic.d/01-managed.yml'),
  TELEGRAM_BOT_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  TELEGRAM_CHAT_ID: z.preprocess(emptyToUndefined, z.string().optional()),
  HEALTH_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(10000),
  LATENCY_WARN_MS: z.coerce.number().int().positive().default(800),
  LATENCY_CRIT_MS: z.coerce.number().int().positive().default(2000),
  MAX_CONSECUTIVE_FAILURES: z.coerce.number().int().positive().default(3),
  /** If set, POST /api/webhook/alert requires header X-Webhook-Secret with this value */
  WEBHOOK_ALERT_SECRET: z.preprocess(emptyToUndefined, z.string().min(16).optional()),
  /**
   * When false (default), GET /metrics rejects requests that include X-Forwarded-For (typical when
   * reached via Traefik), so Prometheus should scrape the app directly on the private network.
   * Set true only for local debugging through the edge proxy.
   */
  METRICS_ALLOW_PUBLIC: z
    .string()
    .default('false')
    .transform((s) => s === 'true'),
  /** Prometheus file_sd JSON path (API writes; Prometheus reads the same host dir in Compose). */
  PROMETHEUS_FILE_SD_PATH: z.string().optional(),
  /** POST this URL after updating file_sd (e.g. http://prometheus:9090/-/reload). */
  PROMETHEUS_RELOAD_URL: z.preprocess(
    (v) => (v === '' || v === undefined ? undefined : v),
    z.string().url().optional()
  )
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('[edgecontrol-api] Invalid environment variables:')
  console.error(parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
