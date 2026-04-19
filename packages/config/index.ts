export const PROJECT_NAME = 'edgecontrol'

export const DEFAULT_THRESHOLDS = {
  healthCheckIntervalMs: 10_000,
  latencyWarnMs: 800,
  latencyCritMs: 2_000,
  maxConsecutiveFailures: 3
}

/** Legacy display path; API uses TRAEFIK_DYNAMIC_CONFIG_PATH → dynamic.d/01-managed.yml in Compose. */
export const PANEL_CONFIG_PATH = '/traefik-sync/dynamic.d/01-managed.yml'

export const LOGIN_RATE_LIMIT_PER_MINUTE = 5
