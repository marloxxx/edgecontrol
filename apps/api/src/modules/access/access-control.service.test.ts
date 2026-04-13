import test from 'node:test'
import assert from 'node:assert/strict'
import { ForbiddenException } from '@nestjs/common'

import { AccessControlService } from './access-control.service'

function createServiceAccessControl(overrides?: { canEdit?: boolean; hasAccess?: boolean }) {
  const prisma = {
    serviceAccess: {
      findUnique: async () => {
        if (!overrides?.hasAccess) return null
        return { canEdit: overrides?.canEdit ?? false }
      }
    }
  }

  const auditService = {
    log: async () => undefined
  }

  return new AccessControlService(prisma as never, auditService as never)
}

test('privileged roles bypass service access rows', async () => {
  const service = createServiceAccessControl()
  const actor = { id: '1', email: 'admin@example.com', role: 'ADMIN' }

  assert.equal(await service.canViewService(actor, 'svc-1'), true)
  assert.equal(await service.canEditService(actor, 'svc-1'), true)
})

test('non-privileged role requires service access row', async () => {
  const denied = createServiceAccessControl({ hasAccess: false })
  const actor = { id: '2', email: 'dev@example.com', role: 'DEVELOPER' }

  assert.equal(await denied.canViewService(actor, 'svc-1'), false)
  await assert.rejects(
    denied.assertCanViewService(actor, 'svc-1'),
    (error: Error) => error instanceof ForbiddenException
  )
})

test('non-privileged edit requires canEdit=true', async () => {
  const readOnly = createServiceAccessControl({ hasAccess: true, canEdit: false })
  const writable = createServiceAccessControl({ hasAccess: true, canEdit: true })
  const actor = { id: '2', email: 'dev@example.com', role: 'DEVELOPER' }

  assert.equal(await readOnly.canEditService(actor, 'svc-1'), false)
  assert.equal(await writable.canEditService(actor, 'svc-1'), true)
})
