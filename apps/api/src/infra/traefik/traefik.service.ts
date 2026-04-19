import fs from 'node:fs'
import path from 'node:path'

import { Injectable } from '@nestjs/common'
import yaml from 'js-yaml'

import { env } from '../../config/env'

interface RouteConfig {
  domain: string
  targetHost: string
  targetPort: number
  protocol: string
  healthPath: string
  rateLimitAvg: number | null
  rateLimitBurst: number | null
  circuitBreakerEnabled: boolean
  circuitBreakerStatus: 'OPEN' | 'CLOSED' | 'HALF_OPEN'
  weight: number
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function isEmptyPlainObject(v: unknown): boolean {
  return isPlainObject(v) && Object.keys(v).length === 0
}

@Injectable()
export class TraefikService {
  private readonly configPath = env.TRAEFIK_DYNAMIC_CONFIG_PATH

  /**
   * Traefik v3.6 file provider rejects empty `http.routers` / `http.services` / `http.middlewares`
   * as standalone maps. Some legacy DB snapshots also stored `routers` at the YAML root without `http`.
   */
  private normalizeTraefikFilePayload(raw: Record<string, unknown>): Record<string, unknown> {
    let c: Record<string, unknown> = { ...raw }

    if (!('http' in c) && (c.routers !== undefined || c.services !== undefined || c.middlewares !== undefined)) {
      c = {
        http: {
          ...(c.routers !== undefined ? { routers: c.routers } : {}),
          ...(c.services !== undefined ? { services: c.services } : {}),
          ...(c.middlewares !== undefined ? { middlewares: c.middlewares } : {})
        }
      }
    }

    const http = c.http
    if (!isPlainObject(http)) {
      return Object.keys(c).length === 0 ? {} : c
    }

    const h = { ...http } as Record<string, unknown>
    const routers = h.routers
    const services = h.services
    const middlewares = h.middlewares

    const routersEmpty = routers === undefined || isEmptyPlainObject(routers)
    const servicesEmpty = services === undefined || isEmptyPlainObject(services)
    const middlewaresEmpty = middlewares === undefined || isEmptyPlainObject(middlewares)

    if (routersEmpty && servicesEmpty && middlewaresEmpty) {
      return {}
    }

    if (middlewaresEmpty && 'middlewares' in h) {
      delete h.middlewares
    }

    if (routersEmpty && 'routers' in h) {
      delete h.routers
    }
    if (servicesEmpty && 'services' in h) {
      delete h.services
    }

    if (Object.keys(h).length === 0) {
      return {}
    }

    const routersNow = h.routers
    const servicesNow = h.services
    const routersStillEmpty = routersNow === undefined || isEmptyPlainObject(routersNow)
    const servicesStillEmpty = servicesNow === undefined || isEmptyPlainObject(servicesNow)
    if (routersStillEmpty || servicesStillEmpty) {
      return {}
    }

    return { http: h }
  }

  buildConfig(routes: RouteConfig[]) {
    if (routes.length === 0) {
      // Traefik v3.6+: do not emit `http` with empty routers/services/middlewares (file provider rejects it).
      return {}
    }

    const middlewares: Record<string, unknown> = {}
    const routers: Record<string, unknown> = {}
    const services: Record<string, unknown> = {}

    for (const route of routes) {
      const key = route.domain.replace(/\./g, '-').replace(/[^a-zA-Z0-9-]/g, '')
      const middlewareNames: string[] = []

      if (route.rateLimitAvg && route.rateLimitBurst) {
        const name = `${key}-ratelimit`
        middlewares[name] = {
          rateLimit: {
            average: route.rateLimitAvg,
            burst: route.rateLimitBurst
          }
        }
        middlewareNames.push(name)
      }

      if (route.circuitBreakerEnabled) {
        const expression =
          route.circuitBreakerStatus === 'OPEN'
            ? 'NetworkErrorRatio() > 0.0'
            : 'ResponseCodeRatio(500, 600, 0, 600) > 0.30'
        const name = `${key}-cb`
        middlewares[name] = {
          circuitBreaker: {
            expression
          }
        }
        middlewareNames.push(name)
      }

      const router: Record<string, unknown> = {
        rule: `Host(\`${route.domain}\`)`,
        service: key,
        entryPoints: ['websecure'],
        tls: { certResolver: 'letsencrypt' }
      }
      if (middlewareNames.length > 0) {
        router.middlewares = middlewareNames
      }
      routers[key] = router

      services[key] = {
        loadBalancer: {
          servers: [
            {
              url: `${route.protocol}://${route.targetHost}:${route.targetPort}`,
              weight: route.weight
            }
          ],
          healthCheck: {
            path: route.healthPath,
            interval: '10s',
            timeout: '3s'
          }
        }
      }
    }

    const http: Record<string, unknown> = { routers, services }
    if (Object.keys(middlewares).length > 0) {
      http.middlewares = middlewares
    }

    return { http }
  }

  readCurrentYaml() {
    if (!fs.existsSync(this.configPath)) {
      return ''
    }
    return fs.readFileSync(this.configPath, 'utf8')
  }

  readCurrentConfig(): Record<string, unknown> {
    const yamlContent = this.readCurrentYaml()
    if (!yamlContent.trim()) return {}
    return (yaml.load(yamlContent) ?? {}) as Record<string, unknown>
  }

  writeConfig(config: Record<string, unknown>) {
    const dir = path.dirname(this.configPath)
    fs.mkdirSync(dir, { recursive: true })

    const normalized = this.normalizeTraefikFilePayload(config)
    const finalYaml = yaml.dump(normalized, { lineWidth: -1, noRefs: true, sortKeys: false })
    const tempPath = `${this.configPath}.tmp`

    fs.writeFileSync(tempPath, finalYaml, 'utf8')
    const fd = fs.openSync(tempPath, 'r+')
    try {
      fs.fsyncSync(fd)
    } finally {
      fs.closeSync(fd)
    }
    fs.renameSync(tempPath, this.configPath)
  }
}
