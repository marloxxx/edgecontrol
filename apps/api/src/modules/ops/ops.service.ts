import { Injectable } from '@nestjs/common'

import { AuthenticatedUser } from '../../auth/auth.types'
import { ServiceService } from '../service/service.service'
import { VersionService } from '../version/version.service'

@Injectable()
export class OpsService {
  constructor(
    private readonly serviceService: ServiceService,
    private readonly versionService: VersionService
  ) {}

  async setCircuitBreaker(id: string, status: 'OPEN' | 'CLOSED', actor: AuthenticatedUser) {
    await this.serviceService.setCircuitBreaker(id, status, actor)
    await this.versionService.regenerate(actor)
    return this.serviceService.getById(id, actor)
  }

  async setCanary(id: string, weight: number, actor: AuthenticatedUser) {
    await this.serviceService.setWeight(id, weight, actor)
    await this.versionService.regenerate(actor)
    return this.serviceService.getById(id, actor)
  }

  async setRateLimit(id: string, avg: number, burst: number, actor: AuthenticatedUser) {
    await this.serviceService.setRateLimit(id, avg, burst, actor)
    await this.versionService.regenerate(actor)
    return this.serviceService.getById(id, actor)
  }
}
