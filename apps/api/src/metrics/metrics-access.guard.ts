import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'

import { env } from '../config/env'

/**
 * Blocks GET /metrics when the request was forwarded by a reverse proxy (e.g. Traefik).
 * Prometheus scrapes the API directly on the Docker/private network without X-Forwarded-For.
 */
@Injectable()
export class MetricsAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (env.METRICS_ALLOW_PUBLIC) {
      return true
    }
    const req = context.switchToHttp().getRequest<{ headers: httpHeaders }>()
    const forwarded = req.headers['x-forwarded-for']
    if (typeof forwarded === 'string' && forwarded.trim().length > 0) {
      throw new ForbiddenException('Metrics are not available through this reverse proxy')
    }
    return true
  }
}

type httpHeaders = Record<string, string | string[] | undefined>
