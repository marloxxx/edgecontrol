import { Injectable } from '@nestjs/common'
import type { CreateNodeInput } from '@edgecontrol/trpc'

import { AuthenticatedUser } from '../../auth/auth.types'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * Deployment nodes (VPS / workers): optional records so services can be linked for labelling.
 * They do not affect Traefik or Prometheus directly unless you use them in your own workflows.
 */
@Injectable()
export class NodeService {
  constructor(private readonly prisma: PrismaService) {}

  async list(_actor: AuthenticatedUser) {
    return this.prisma.node.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    })
  }

  async create(input: CreateNodeInput, _actor: AuthenticatedUser) {
    return this.prisma.node.create({
      data: {
        name: input.name,
        host: input.host,
        region: input.region ?? null
      }
    })
  }
}
