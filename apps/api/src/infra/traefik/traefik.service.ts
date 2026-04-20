import fs from 'node:fs'
import { isIP } from 'node:net'
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
  /** When false, omit Traefik `loadBalancer.healthCheck` entirely. */
  traefikHealthCheck: boolean
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
    const serversTransports: Record<string, unknown> = {}

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

      // Traefik v3.6: `web` redirect routers use `priority: 1` so the internal HTTP-01 handler wins when using ACME
      // elsewhere. `websecure`: `tls: {}` + high `priority` so internal ACME (~23) never wins over real site routers → 404.
      // Managed `websecure` routes do **not** set `tls.certResolver`: TLS uses `tls.stores.default`
      // (`docker/traefik/ssl/cert.pem` + `key.pem`), e.g. a wildcard — avoids Let’s Encrypt **429** when many
      // subdomains share one commercial cert. Re-enable per-route ACME only if you add an explicit product toggle.
      const router: Record<string, unknown> = {
        rule: `Host(\`${route.domain}\`)`,
        service: key,
        entryPoints: ['websecure'],
        priority: 10000,
        tls: {}
      }
      if (middlewareNames.length > 0) {
        router.middlewares = middlewareNames
      }
      routers[key] = router

      routers[`${key}-http`] = {
        rule: `Host(\`${route.domain}\`)`,
        entryPoints: ['web'],
        priority: 1,
        middlewares: ['redirect-https'],
        service: 'noop@internal'
      }

      // Private hop (e.g. Traefik on VPS A → app on VPS B by RFC1918 IP): prefer `http://IP:port` in the service
      // record—TLS terminates at Traefik for users; internal HTTP is normal on a trusted network. If you still
      // dial `https://` to an IP, we attach SNI below so verification can match the public hostname on the cert.

      // HTTPS to a literal IP: verify / SNI against the public hostname (subdomain), not the IP.
      const outboundTlsUsesPublicName =
        route.protocol === 'https' && isIP(route.targetHost) !== 0
      const outboundTransportName = `${key}-outbound-tls`
      if (outboundTlsUsesPublicName) {
        serversTransports[outboundTransportName] = {
          serverName: route.domain
        }
      }

      // Health probes dial `servers[].url` but do not inherit `passHostHeader`; `hostname` forces `Host: <public
      // subdomain>` so a downstream Traefik (or any Host-based router) matches `Host(\`api…\`)` instead of the IP.
      // Always `scheme: http` on the probe so checks stay cleartext unless you override port for an HTTPS origin.
      // `followRedirects: false` avoids following a 301/302 to https://<IP>/… (TLS to IP breaks the check even when
      // `servers[].url` is plain http://…:8080).
      const healthCheck: Record<string, unknown> = {
        path: route.healthPath,
        interval: '10s',
        timeout: '3s',
        hostname: route.domain,
        scheme: 'http',
        followRedirects: false,
        ...(route.protocol === 'https' && route.targetPort === 443 ? { port: 80 } : {})
      }

      const loadBalancer: Record<string, unknown> = {
        // Preserve the client Host (public subdomain) toward the origin—required when the next hop routes on Host().
        passHostHeader: true,
        servers: [
          {
            url: `${route.protocol}://${route.targetHost}:${route.targetPort}`,
            weight: route.weight
          }
        ]
      }
      if (route.traefikHealthCheck) {
        loadBalancer.healthCheck = healthCheck
      }
      if (outboundTlsUsesPublicName) {
        loadBalancer.serversTransport = outboundTransportName
      }

      services[key] = { loadBalancer }
    }

    const http: Record<string, unknown> = { routers, services }
    if (Object.keys(middlewares).length > 0) {
      http.middlewares = middlewares
    }
    if (Object.keys(serversTransports).length > 0) {
      http.serversTransports = serversTransports
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

    // Do not write `{}` to disk: Traefik merges every `*.yml` in `dynamic.d/` and a root `{}` file
    // can wipe file-provider routes (panel + MinIO in 00-static.yml, TLS in 02-default-tls.yml) → 404.
    if (Object.keys(normalized).length === 0) {
      try {
        fs.unlinkSync(this.configPath)
      } catch (e) {
        const err = e as NodeJS.ErrnoException
        if (err.code !== 'ENOENT') throw e
      }
      return
    }

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
