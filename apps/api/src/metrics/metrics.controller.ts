import { Controller, Get, Header, UseGuards } from '@nestjs/common'

import { MetricsAccessGuard } from './metrics-access.guard'
import { metricsRegister } from './prometheus.js'

@Controller()
@UseGuards(MetricsAccessGuard)
export class MetricsController {
  @Get('metrics')
  @Header('Content-Type', metricsRegister.contentType)
  async metrics(): Promise<string> {
    return metricsRegister.metrics()
  }
}
