process.env.NODE_ENV = 'test'

import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

const { default: app } = await import('../src/app.js')
const { getPrisma } = await import('../src/config/prisma.js')
const { adminTokenPayload, signToken } = await import('../src/utils/token.js')

let server
let base
let admin
let adminToken
let firstUser
let firstUserToken
let secondUser
let secondUserToken
const notificationIds = []
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`

async function call(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: response.status, data: await response.json().catch(() => null) }
}

before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`

  const prisma = await getPrisma()
  admin = await prisma.admin.create({
    data: { email: `notifications-admin-${suffix}@example.test`, password: 'unused', role: 'admin' },
  })
  adminToken = signToken(adminTokenPayload(admin))

  const first = await call('/auth/register', {
    method: 'POST',
    body: { email: `notification-user-a-${suffix}@example.test`, password: 'password123', securityQuestion: 'First school?', securityAnswer: 'North' },
  })
  const second = await call('/auth/register', {
    method: 'POST',
    body: { email: `notification-user-b-${suffix}@example.test`, password: 'password123', securityQuestion: 'First school?', securityAnswer: 'South' },
  })
  assert.equal(first.status, 201)
  assert.equal(second.status, 201)
  firstUser = first.data.user
  firstUserToken = first.data.token
  secondUser = second.data.user
  secondUserToken = second.data.token
})

after(async () => {
  try {
    const prisma = await getPrisma()
    if (notificationIds.length) {
      await prisma.notificationDelivery.deleteMany({ where: { notificationId: { in: notificationIds } } })
      await prisma.notification.deleteMany({ where: { id: { in: notificationIds } } })
    }
    const userIds = [firstUser?.id, secondUser?.id].filter(Boolean)
    if (userIds.length) {
      await prisma.passwordReset.deleteMany({ where: { userId: { in: userIds } } })
      await prisma.user.deleteMany({ where: { id: { in: userIds } } })
      await prisma.auditLog.deleteMany({ where: { entityId: { in: userIds } } })
    }
    if (admin?.id) await prisma.admin.delete({ where: { id: admin.id } })
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve))
  }
})

test('admin in-app notifications are targeted, idempotent, and user-read state is isolated', async () => {
  const invalid = await call('/admin/notifications', {
    method: 'POST',
    token: adminToken,
    body: { title: 'Bad', body: 'too short', target: 'individual', recipientIds: [] },
  })
  assert.equal(invalid.status, 400)

  const created = await call('/admin/notifications', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Account update',
      body: 'Your account settings are ready to review.',
      target: 'individual',
      recipientIds: [firstUser.id],
    },
  })
  assert.equal(created.status, 201)
  const notificationId = created.data.notification.id
  notificationIds.push(notificationId)
  assert.equal(created.data.notification.status, 'draft')

  const changed = await call(`/admin/notifications/${notificationId}`, {
    method: 'PATCH',
    token: adminToken,
    body: { title: 'Updated account update' },
  })
  assert.equal(changed.status, 200)
  assert.equal(changed.data.notification.title, 'Updated account update')

  const [sent, duplicateSend] = await Promise.all([
    call(`/admin/notifications/${notificationId}/send`, { method: 'POST', token: adminToken }),
    call(`/admin/notifications/${notificationId}/send`, { method: 'POST', token: adminToken }),
  ])
  assert.equal(sent.status, 200)
  assert.equal(duplicateSend.status, 200)
  assert.equal(sent.data.created + duplicateSend.data.created, 1)
  assert.equal([sent, duplicateSend].filter((result) => result.data.skipped).length, 1)
  assert.equal(sent.data.notification.status, 'sent')

  const selected = await call('/admin/notifications', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'Selected account update',
      body: 'This message is intended for both test accounts.',
      target: 'selected',
      recipientIds: [firstUser.id, secondUser.id],
    },
  })
  assert.equal(selected.status, 201)
  notificationIds.push(selected.data.notification.id)
  const selectedSend = await call(`/admin/notifications/${selected.data.notification.id}/send`, {
    method: 'POST',
    token: adminToken,
  })
  assert.equal(selectedSend.status, 200)
  assert.equal(selectedSend.data.created, 2)

  const firstInbox = await call('/notifications?page=1&pageSize=10', { token: firstUserToken })
  assert.equal(firstInbox.status, 200)
  assert.equal(firstInbox.data.unreadCount, 2)
  assert.ok(firstInbox.data.notifications.some((row) => row.notification.title === 'Updated account update'))

  const secondInbox = await call('/notifications?page=1&pageSize=10', { token: secondUserToken })
  assert.equal(secondInbox.status, 200)
  assert.equal(secondInbox.data.total, 1)
  assert.equal(secondInbox.data.unreadCount, 1)

  const foreignRead = await call(`/notifications/${notificationId}/read`, { method: 'POST', token: secondUserToken })
  assert.equal(foreignRead.status, 404)

  const read = await call(`/notifications/${notificationId}/read`, { method: 'POST', token: firstUserToken })
  assert.equal(read.status, 200)
  assert.equal(read.data.read, true)
  const afterRead = await call('/notifications?page=1&pageSize=10', { token: firstUserToken })
  assert.equal(afterRead.data.unreadCount, 1)
  assert.equal(afterRead.data.notifications.find((row) => row.notificationId === notificationId).status, 'read')

  const readAll = await call('/notifications/read-all', { method: 'POST', token: secondUserToken })
  assert.equal(readAll.status, 200)
  const secondAfterRead = await call('/notifications?page=1&pageSize=10', { token: secondUserToken })
  assert.equal(secondAfterRead.data.unreadCount, 0)

  const allDraft = await call('/admin/notifications', {
    method: 'POST',
    token: adminToken,
    body: {
      title: 'All users draft',
      body: 'This draft targets all active users and will not be sent.',
      target: 'all',
    },
  })
  assert.equal(allDraft.status, 201)
  const deleted = await call(`/admin/notifications/${allDraft.data.notification.id}`, {
    method: 'DELETE',
    token: adminToken,
  })
  assert.equal(deleted.status, 200)

  const history = await call('/admin/notifications/deliveries', { token: adminToken })
  assert.equal(history.status, 200)
  assert.ok(history.data.deliveries.some((delivery) => delivery.notificationId === notificationId))
})

test('admin-managed password recovery uses a temporary password and security answer once', async () => {
  const submitted = await call('/auth/password-recovery/request', {
    method: 'POST',
    body: { email: firstUser.email },
  })
  assert.equal(submitted.status, 202)

  const prisma = await getPrisma()
  const pending = await prisma.passwordReset.findFirst({ where: { userId: firstUser.id, status: 'pending' } })
  assert.ok(pending)

  const approval = await call(`/admin/password-resets/${pending.id}/approve`, { method: 'POST', token: adminToken })
  assert.equal(approval.status, 200)
  assert.match(approval.data.temporaryPassword, /[A-Za-z]/)
  assert.match(approval.data.temporaryPassword, /[0-9]/)
  assert.match(approval.data.temporaryPassword, /[!@#$%*?]/)

  const temporaryLogin = await call('/auth/login', {
    method: 'POST', body: { email: firstUser.email, password: approval.data.temporaryPassword },
  })
  assert.equal(temporaryLogin.status, 200)
  assert.equal(temporaryLogin.data.recovery.question, 'First school?')

  const reset = await call('/auth/password-recovery/complete', {
    method: 'POST',
    body: { recoveryToken: temporaryLogin.data.recovery.token, securityAnswer: ' north ', newPassword: 'a-new-password-123' },
  })
  assert.equal(reset.status, 200)

  const user = await prisma.user.findUnique({ where: { id: firstUser.id } })
  const bcrypt = await import('bcrypt')
  assert.equal(await bcrypt.default.compare('a-new-password-123', user.password), true)
  assert.notEqual(user.password, 'a-new-password-123')

  const reused = await call('/auth/password-recovery/complete', {
    method: 'POST',
    body: { recoveryToken: temporaryLogin.data.recovery.token, securityAnswer: 'north', newPassword: 'another-password-123' },
  })
  assert.equal(reused.status, 401)

  const listed = await call('/admin/password-resets', { token: adminToken })
  assert.equal(listed.status, 200)
  assert.ok(listed.data.requests.every((request) => !('tokenHash' in request)))
})
