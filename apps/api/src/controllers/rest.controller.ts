import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common'

import { env } from '../config/env'
import { AlertService } from '../modules/alert/alert.service'
import { VersionService } from '../modules/version/version.service'

@Controller('/api')
export class RestController {
  private readonly systemActor = {
    id: 'system-rest',
    email: 'system@edgecontrol.local',
    role: 'SUPER_ADMIN'
  }

  constructor(
    private readonly alertService: AlertService,
    private readonly versionService: VersionService
  ) {}

  @Get('/health')
  health() {
    return {
      status: 'ok',
      service: 'edgecontrol-api',
      timestamp: new Date().toISOString()
    }
  }

  @Get('/traefik/status')
  getTraefikStatus() {
    return this.versionService.getCurrent(this.systemActor)
  }

  @Post('/webhook/alert')
  async handleWebhookAlert(
    @Headers('x-webhook-secret') webhookSecret: string | undefined,
    @Body()
    input: {
      serviceId: string
      message: string
      severity?: 'INFO' | 'WARNING' | 'CRITICAL'
    }
  ) {
    if (env.WEBHOOK_ALERT_SECRET && webhookSecret !== env.WEBHOOK_ALERT_SECRET) {
      throw new UnauthorizedException('Invalid webhook secret')
    }

    const alert = await this.alertService.create({
      serviceId: input.serviceId,
      message: input.message,
      severity: input.severity ?? 'WARNING'
    })

    return {
      success: true,
      alertId: alert.id
    }
  }
}
