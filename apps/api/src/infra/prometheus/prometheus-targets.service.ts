import { Inject, Injectable, Logger } from '@nestjs/common'
import fs from 'node:fs'
import path from 'node:path'

import { env } from '../../config/env'
import { PrismaService } from '../../prisma/prisma.service'

type FileSdGroup = {
  targets: string[]
  labels: Record<string, string>
}

/**
 * Writes Prometheus file_sd JSON for services with metrics enabled.
 * Prometheus must mount the same host directory (see docker-compose).
 */
@Injectable()
export class PrometheusTargetsService {
  private readonly logger = new Logger(PrometheusTargetsService.name)

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Rebuilds the file from the database. Safe to call on every service change.
   */
  async syncFromServices(): Promise<void> {
    const outPath = env.PROMETHEUS_FILE_SD_PATH
    if (!outPath) {
      return
    }

    const services = await this.prisma.service.findMany({
      where: { enabled: true, metricsEnabled: true },
      select: {
        id: true,
        name: true,
        domain: true,
        targetHost: true,
        targetPort: true,
        metricsPath: true,
        metricsPort: true
      }
    })

    const groups: FileSdGroup[] = services.map((s) => {
      const port = s.metricsPort ?? s.targetPort
      return {
        targets: [`${s.targetHost}:${port}`],
        labels: {
          edgecontrol_service: s.name,
          edgecontrol_domain: s.domain,
          edgecontrol_service_id: s.id,
          __metrics_path__: s.metricsPath
        }
      }
    })

    const dir = path.dirname(outPath)
    fs.mkdirSync(dir, { recursive: true })
    const tmp = `${outPath}.${process.pid}.tmp`
    fs.writeFileSync(tmp, `${JSON.stringify(groups, null, 2)}\n`, 'utf8')
    fs.renameSync(tmp, outPath)

    this.logger.log(`Wrote ${groups.length} Prometheus scrape group(s) to ${outPath}`)

    await this.maybeReloadPrometheus()
  }

  private async maybeReloadPrometheus(): Promise<void> {
    const url = env.PROMETHEUS_RELOAD_URL
    if (!url) {
      return
    }
    try {
      const res = await fetch(url, { method: 'POST' })
      if (!res.ok) {
        this.logger.warn(`Prometheus reload returned ${res.status}`)
      }
    } catch (err) {
      this.logger.warn(`Prometheus reload failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
