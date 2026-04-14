import { config as loadEnv } from 'dotenv'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
loadEnv({ path: join(repoRoot, '.env') })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().default('*'),
  TRAEFIK_DYNAMIC_CONFIG_PATH: z.string().default('/traefik-config/dynamic.yml'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
  HEALTH_CHECK_INTERVAL_MS: z.coerce.number().int().positive().default(10000),
  LATENCY_WARN_MS: z.coerce.number().int().positive().default(800),
  LATENCY_CRIT_MS: z.coerce.number().int().positive().default(2000),
  MAX_CONSECUTIVE_FAILURES: z.coerce.number().int().positive().default(3),
  /** If set, POST /api/webhook/alert requires header X-Webhook-Secret with this value */
  WEBHOOK_ALERT_SECRET: z.string().min(16).optional()
})

export const env = envSchema.parse(process.env)
