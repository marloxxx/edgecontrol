import test from 'node:test'
import assert from 'node:assert/strict'

import { Permission, hasPermission, normalizeRole } from '@edgecontrol/trpc'

test('normalizes legacy OPERATOR role to DEVELOPER', () => {
  assert.equal(normalizeRole('OPERATOR'), 'DEVELOPER')
})

test('admin has full panel permissions including settings and user management', () => {
  assert.equal(hasPermission('ADMIN', Permission.CREATE_SERVICE), true)
  assert.equal(hasPermission('ADMIN', Permission.EDIT_SETTINGS), true)
  assert.equal(hasPermission('ADMIN', Permission.MANAGE_ROLES), true)
})

test('developer remains read-only for service mutations', () => {
  assert.equal(hasPermission('DEVELOPER', Permission.VIEW_SERVICES), true)
  assert.equal(hasPermission('DEVELOPER', Permission.TEST_CONNECTION), true)
  assert.equal(hasPermission('DEVELOPER', Permission.EDIT_SERVICE), false)
  assert.equal(hasPermission('DEVELOPER', Permission.DELETE_SERVICE), false)
})

test('viewer has dashboard and monitoring only', () => {
  assert.equal(hasPermission('VIEWER', Permission.VIEW_DASHBOARD), true)
  assert.equal(hasPermission('VIEWER', Permission.VIEW_MONITORING), true)
  assert.equal(hasPermission('VIEWER', Permission.VIEW_AUDIT_LOGS), false)
})
