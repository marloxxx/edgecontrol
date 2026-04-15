import { Module } from '@nestjs/common'

import { AuthService } from './auth/auth.service'
import { AppConfigService } from './config/config.service'
import { RestController } from './controllers/rest.controller'
import { TelegramService } from './infra/telegram/telegram.service'
import { PrometheusTargetsService } from './infra/prometheus/prometheus-targets.service'
import { TraefikService } from './infra/traefik/traefik.service'
import { AccessControlService } from './modules/access/access-control.service'
import { AlertService } from './modules/alert/alert.service'
import { AuditService } from './modules/audit/audit.service'
import { HealthService } from './modules/health/health.service'
import { OpsService } from './modules/ops/ops.service'
import { NodeService } from './modules/node/node.service'
import { ServiceService } from './modules/service/service.service'
import { VersionService } from './modules/version/version.service'
import { PrismaService } from './prisma/prisma.service'
import { MetricsController } from './metrics/metrics.controller'
import { HealthCheckWorker } from './worker/health-check.worker'

@Module({
  imports: [],
  controllers: [RestController, MetricsController],
  providers: [
    PrismaService,
    AppConfigService,
    AuditService,
    AccessControlService,
    PrometheusTargetsService,
    NodeService,
    ServiceService,
    HealthService,
    AlertService,
    VersionService,
    OpsService,
    AuthService,
    TraefikService,
    TelegramService,
    HealthCheckWorker
  ]
})
export class AppModule {}
