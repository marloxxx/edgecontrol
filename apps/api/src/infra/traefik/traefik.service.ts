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

@Injectable()
export class TraefikService {
  private readonly configPath = env.TRAEFIK_DYNAMIC_CONFIG_PATH

  buildConfig(routes: RouteConfig[]) {
    if (routes.length === 0) {
      // Traefik v3.6+: empty http.routers / http.services / http.middlewares are invalid as standalone maps.
      return { http: {} }
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

    const finalYaml = yaml.dump(config, { lineWidth: -1 })
    const tempPath = `${this.configPath}.tmp`

    fs.writeFileSync(tempPath, finalYaml, 'utf8')
    fs.renameSync(tempPath, this.configPath)
  }
}
