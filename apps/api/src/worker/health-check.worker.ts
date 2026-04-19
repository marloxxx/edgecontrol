import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { AlertSeverity, ServiceStatus } from '@edgecontrol/db'
import { Job, Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'

import { env } from '../config/env'
import { TelegramService } from '../infra/telegram/telegram.service'
import { AlertService } from '../modules/alert/alert.service'
import { HealthService } from '../modules/health/health.service'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class HealthCheckWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HealthCheckWorker.name)
  private readonly queueName = 'health-check'
  private readonly connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null })
  private readonly queue = new Queue(this.queueName, { connection: this.connection })
  private readonly worker = new Worker(
    this.queueName,
    async (job) => this.process(job),
    { connection: this.connection }
  )
  private readonly systemActor = {
    id: 'system-worker',
    email: 'admin@ptsi.co.id',
    role: 'ADMIN'
  }

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(HealthService) private readonly healthService: HealthService,
    @Inject(AlertService) private readonly alertService: AlertService,
    @Inject(TelegramService) private readonly telegramService: TelegramService
  ) { }

  async onModuleInit() {
    await this.queue.add(
      'scheduled-health-check',
      {},
      {
        repeat: { every: env.HEALTH_CHECK_INTERVAL_MS },
        removeOnComplete: 10,
        removeOnFail: 20
      }
    )
  }

  async onModuleDestroy() {
    await this.worker.close()
    await this.queue.close()
    await this.connection.quit()
  }

  private async process(_job: Job) {
    const services = await this.prisma.service.findMany({
      where: { enabled: true }
    })

    for (const service of services) {
      const check = await this.healthService.testConnection(service.id, this.systemActor)
      await this.healthService.recordCheck({
        serviceId: service.id,
        status: check.status as ServiceStatus,
        latencyMs: check.latencyMs,
        statusCode: check.statusCode,
        errorMessage: check.errorMessage
      })

      const recentDown = await this.prisma.healthCheck.count({
        where: {
          serviceId: service.id,
          status: ServiceStatus.DOWN,
          checkedAt: {
            gte: new Date(Date.now() - env.HEALTH_CHECK_INTERVAL_MS * env.MAX_CONSECUTIVE_FAILURES)
          }
        }
      })

      if (check.status === 'DOWN' && recentDown >= env.MAX_CONSECUTIVE_FAILURES) {
        const alert = await this.alertService.create({
          serviceId: service.id,
          severity: AlertSeverity.CRITICAL,
          message: `${service.name} is DOWN for ${recentDown} consecutive checks`
        })
        await this.telegramService.sendMessage(`[CRITICAL] ${alert.message}`)
      } else if (check.status === 'SLOW' && check.latencyMs > env.LATENCY_CRIT_MS) {
        const alert = await this.alertService.create({
          serviceId: service.id,
          severity: AlertSeverity.CRITICAL,
          message: `${service.name} latency is ${check.latencyMs}ms`
        })
        await this.telegramService.sendMessage(`[CRITICAL] ${alert.message}`)
      } else if (check.status === 'SLOW') {
        await this.alertService.create({
          serviceId: service.id,
          severity: AlertSeverity.WARNING,
          message: `${service.name} latency crossed warning threshold (${check.latencyMs}ms)`
        })
      }
    }

    this.logger.debug(`Processed ${services.length} health checks`)
  }
}
