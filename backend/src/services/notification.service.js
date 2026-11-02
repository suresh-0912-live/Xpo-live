import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcrypt'
import { getPrisma } from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'
import { writeAuditLog } from './log.service.js'

const NOTIFICATION_TYPES = ['general', 'deposit_status', 'withdrawal_status', 'announcement']
const TARGETS = ['all', 'selected', 'individual']
const NOTIFICATION_STATUSES = ['draft', 'scheduled', 'sent', 'failed', 'read']
const RESET_STATUSES = ['pending', 'approved', 'rejected', 'locked', 'used', 'expired', 'revoked']
const MAX_PAGE_SIZE = 100

function pagination(page, pageSize) {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1)
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(pageSize, 10) || 25))
  return { page: safePage, pageSize: safePageSize, skip: (safePage - 1) * safePageSize }
}

function validateRecipientIds(target, recipientIds) {
  const errors = []
  if (target !== 'selected' && target !== 'individual') return errors
  if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
    errors.push('recipientIds is required for target=selected|individual')
  } else if (recipientIds.length > 500) {
    errors.push('recipientIds must not exceed 500 recipients')
  } else if (!recipientIds.every((id) => typeof id === 'string' && id.trim())) {
    errors.push('recipientIds must contain only valid user IDs')
  } else if (target === 'individual' && recipientIds.length !== 1) {
    errors.push('target=individual requires exactly one recipient')
  }
  return errors
}

export function validateNotification(input = {}) {
  const errors = []
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return ['notification must be an object']
  }
  if (typeof input.title !== 'string' || input.title.trim().length < 3) {
    errors.push('title must be at least 3 characters')
  }
  if (typeof input.title === 'string' && input.title.length > 200) {
    errors.push('title must be at most 200 characters')
  }
  if (typeof input.body !== 'string' || input.body.trim().length < 10) {
    errors.push('body must be at least 10 characters')
  }
  if (typeof input.body === 'string' && input.body.length > 10000) {
    errors.push('body must be at most 10000 characters')
  }
  if (!NOTIFICATION_TYPES.includes(input.type || 'general')) {
    errors.push(`type must be one of: ${NOTIFICATION_TYPES.join(', ')}`)
  }
  const target = input.target || 'all'
  if (!TARGETS.includes(target)) errors.push(`target must be one of: ${TARGETS.join(', ')}`)
  errors.push(...validateRecipientIds(target, input.recipientIds))
  if (input.scheduledAt) errors.push('Scheduled notifications are unavailable because no scheduler is configured')
  if (input.data !== undefined && input.data !== null && (typeof input.data !== 'object' || Array.isArray(input.data))) {
    errors.push('data must be a JSON object')
  }
  return errors
}

export function parseRecipientIds(recipientIds) {
  if (Array.isArray(recipientIds)) {
    return [...new Set(recipientIds.filter((id) => typeof id === 'string').map((id) => id.trim()).filter(Boolean))]
  }
  if (typeof recipientIds !== 'string') return []
  return [...new Set(recipientIds.split(',').map((id) => id.trim()).filter(Boolean))]
}

function assertValid(errors) {
  if (errors.length) throw ApiError.badRequest('Validation failed', errors)
}

async function validateActiveRecipients(prisma, target, recipientIds) {
  if (target === 'all') return undefined
  const ids = parseRecipientIds(recipientIds)
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, status: 'active' },
    select: { id: true },
  })
  if (users.length !== ids.length) {
    throw ApiError.badRequest('One or more recipients do not exist or are not active')
  }
  return ids.join(',')
}

export async function listNotifications({ page = 1, pageSize = 25, status, type, target, query, sort = 'desc' } = {}) {
  const prisma = await getPrisma()
  const paging = pagination(page, pageSize)
  const where = {}
  if (status) {
    if (!NOTIFICATION_STATUSES.includes(status)) throw ApiError.badRequest('Invalid status filter')
    where.status = status
  }
  if (type) {
    if (!NOTIFICATION_TYPES.includes(type)) throw ApiError.badRequest('Invalid type filter')
    where.type = type
  }
  if (target) {
    if (!TARGETS.includes(target)) throw ApiError.badRequest('Invalid target filter')
    where.target = target
  }
  if (query) {
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { body: { contains: query, mode: 'insensitive' } },
    ]
  }

  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: sort === 'asc' ? 'asc' : 'desc' },
      skip: paging.skip,
      take: paging.pageSize,
      include: { _count: { select: { deliveries: true } } },
    }),
  ])
  return { notifications, total, page: paging.page, pageSize: paging.pageSize }
}

export async function getNotification(id) {
  const prisma = await getPrisma()
  const notification = await prisma.notification.findUnique({
    where: { id },
    include: {
      deliveries: {
        orderBy: { createdAt: 'desc' },
        select: {
          userId: true,
          status: true,
          deliveredAt: true,
          user: { select: { email: true, name: true } },
        },
      },
    },
  })
  if (!notification) throw ApiError.notFound('Notification not found')
  return notification
}

export async function createNotification(input, actorEmail, ip) {
  assertValid(validateNotification(input))
  const prisma = await getPrisma()
  const target = input.target || 'all'
  const recipientIds = await validateActiveRecipients(prisma, target, input.recipientIds)
  const notification = await prisma.notification.create({
    data: {
      title: input.title.trim(),
      body: input.body.trim(),
      type: input.type || 'general',
      target,
      recipientIds: recipientIds ?? null,
      data: input.data ?? undefined,
      status: 'draft',
    },
  })
  await writeAuditLog({
    action: 'notification.created',
    actor: actorEmail,
    actorRole: 'admin',
    entityType: 'notification',
    entityId: notification.id,
    details: { target, recipientCount: recipientIds ? parseRecipientIds(recipientIds).length : null },
    ip,
  })
  return notification
}

export async function updateNotification(id, input, actorEmail, ip) {
  const prisma = await getPrisma()
  const existing = await prisma.notification.findUnique({ where: { id } })
  if (!existing) throw ApiError.notFound('Notification not found')
  if (existing.status !== 'draft') throw ApiError.badRequest('Only draft notifications can be edited')
  const merged = {
    title: input.title ?? existing.title,
    body: input.body ?? existing.body,
    type: input.type ?? existing.type,
    target: input.target ?? existing.target,
    recipientIds: input.recipientIds ?? parseRecipientIds(existing.recipientIds),
    data: input.data === undefined ? existing.data : input.data,
    scheduledAt: input.scheduledAt,
  }
  assertValid(validateNotification(merged))
  const recipientIds = await validateActiveRecipients(prisma, merged.target, merged.recipientIds)
  const notification = await prisma.notification.update({
    where: { id },
    data: {
      title: merged.title.trim(),
      body: merged.body.trim(),
      type: merged.type,
      target: merged.target,
      recipientIds: recipientIds ?? null,
      data: merged.data ?? undefined,
    },
  })
  await writeAuditLog({
    action: 'notification.updated',
    actor: actorEmail,
    actorRole: 'admin',
    entityType: 'notification',
    entityId: id,
    details: { target: merged.target },
    ip,
  })
  return notification
}

export async function updateNotificationStatus(id, status, actorEmail, ip) {
  if (status !== 'draft') throw ApiError.badRequest('Notifications can only be sent through the send action')
  const prisma = await getPrisma()
  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) throw ApiError.notFound('Notification not found')
  if (notification.status !== 'draft') throw ApiError.badRequest('Only draft notifications can remain drafts')
  await writeAuditLog({
    action: 'notification.draft_saved',
    actor: actorEmail,
    actorRole: 'admin',
    entityType: 'notification',
    entityId: id,
    ip,
  })
  return notification
}

export async function deleteNotification(id, actorEmail, ip) {
  const prisma = await getPrisma()
  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) throw ApiError.notFound('Notification not found')
  if (notification.status !== 'draft') throw ApiError.badRequest('Only draft notifications can be deleted')
  await prisma.$transaction(async (tx) => {
    await tx.notificationDelivery.deleteMany({ where: { notificationId: id } })
    await tx.notification.delete({ where: { id } })
  })
  await writeAuditLog({
    action: 'notification.deleted',
    actor: actorEmail,
    actorRole: 'admin',
    entityType: 'notification',
    entityId: id,
    ip,
  })
  return { success: true }
}

async function resolveRecipients(prisma, notification) {
  if (notification.target === 'all') {
    const users = await prisma.user.findMany({ where: { status: 'active' }, select: { id: true } })
    return users.map((user) => user.id)
  }
  const ids = parseRecipientIds(notification.recipientIds)
  const users = await prisma.user.findMany({
    where: { id: { in: ids }, status: 'active' },
    select: { id: true },
  })
  if (users.length !== ids.length) throw ApiError.badRequest('One or more recipients are no longer active')
  return ids
}

export async function sendNotification(id, actorEmail, { ip } = {}) {
  const prisma = await getPrisma()
  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification) throw ApiError.notFound('Notification not found')
  if (notification.status === 'sent') {
    return { notification, created: 0, skipped: true }
  }
  if (notification.status !== 'draft') throw ApiError.badRequest('Only draft notifications can be sent')
  const recipientIds = await resolveRecipients(prisma, notification)
  if (recipientIds.length === 0) throw ApiError.badRequest('There are no active recipients')
  const deliveredAt = new Date()

  const delivery = await prisma.$transaction(async (tx) => {
    const claimed = await tx.notification.updateMany({
      where: { id, status: 'draft' },
      data: { status: 'sent', deliveredAt, lastError: null },
    })
    if (claimed.count !== 1) {
      const current = await tx.notification.findUnique({ where: { id } })
      if (current?.status === 'sent') return { notification: current, created: 0, skipped: true }
      throw ApiError.conflict('Notification was changed before it could be sent')
    }
    const created = await tx.notificationDelivery.createMany({
      data: recipientIds.map((userId) => ({
        notificationId: id,
        userId,
        status: 'sent',
        deliveredAt,
      })),
      skipDuplicates: true,
    })
    const updatedNotification = await tx.notification.findUnique({ where: { id } })
    return { notification: updatedNotification, created: created.count, skipped: false }
  })

  if (delivery.skipped) return delivery

  await writeAuditLog({
    action: 'notification.sent',
    actor: actorEmail,
    actorRole: 'admin',
    entityType: 'notification',
    entityId: id,
    details: { recipientCount: recipientIds.length, delivery: 'in_app' },
    ip,
  })
  return delivery
}

export async function getDeliveryStatus(notificationId) {
  const prisma = await getPrisma()
  const notification = await prisma.notification.findUnique({ where: { id: notificationId }, select: { id: true } })
  if (!notification) throw ApiError.notFound('Notification not found')
  const grouped = await prisma.notificationDelivery.groupBy({
    by: ['status'],
    where: { notificationId },
    _count: { _all: true },
  })
  return { notificationId, statuses: Object.fromEntries(grouped.map((entry) => [entry.status, entry._count._all])) }
}

export async function listDeliveryHistory({ notificationId, page = 1, pageSize = 100 } = {}) {
  const prisma = await getPrisma()
  const paging = pagination(page, pageSize)
  const where = notificationId ? { notificationId } : {}
  return prisma.notificationDelivery.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: paging.skip,
    take: paging.pageSize,
    include: {
      user: { select: { id: true, email: true, name: true } },
      notification: { select: { id: true, title: true, type: true } },
    },
  })
}

export async function listUserNotifications(userId, { page = 1, pageSize = 25, unreadOnly = false } = {}) {
  const prisma = await getPrisma()
  const paging = pagination(page, pageSize)
  const where = { userId, ...(unreadOnly ? { status: 'sent' } : {}) }
  const [total, notifications, unreadCount] = await Promise.all([
    prisma.notificationDelivery.count({ where }),
    prisma.notificationDelivery.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: paging.skip,
      take: paging.pageSize,
      select: {
        id: true,
        notificationId: true,
        status: true,
        deliveredAt: true,
        notification: { select: { title: true, body: true, type: true, data: true, createdAt: true } },
      },
    }),
    prisma.notificationDelivery.count({ where: { userId, status: 'sent' } }),
  ])
  return { notifications, total, unreadCount, page: paging.page, pageSize: paging.pageSize }
}

export async function markNotificationRead(notificationId, userId) {
  const prisma = await getPrisma()
  const result = await prisma.notificationDelivery.updateMany({
    where: { notificationId, userId, status: 'sent' },
    data: { status: 'read' },
  })
  if (result.count === 0) {
    const delivery = await prisma.notificationDelivery.findFirst({ where: { notificationId, userId } })
    if (!delivery) throw ApiError.notFound('Notification not found')
  }
  return { success: true, read: result.count > 0 }
}

export async function markAllNotificationsRead(userId) {
  const prisma = await getPrisma()
  const result = await prisma.notificationDelivery.updateMany({
    where: { userId, status: 'sent' },
    data: { status: 'read' },
  })
  return { success: true, updated: result.count }
}

function resetStatusWhere(status, now) {
  if (status === 'pending') return { status: 'pending' }
  if (status === 'approved') return { status: 'approved', used: false, revokedAt: null, expiresAt: { gt: now } }
  if (status === 'rejected') return { status: 'rejected' }
  if (status === 'locked') return { status: 'locked' }
  if (status === 'used') return { status: 'used' }
  if (status === 'expired') return { status: 'approved', used: false, revokedAt: null, expiresAt: { lte: now } }
  if (status === 'revoked') return { revokedAt: { not: null } }
  return {}
}

function publicResetRequest(request) {
  const { tokenHash, ...safeRequest } = request
  return {
    ...safeRequest,
    status: request.revokedAt ? 'revoked' : request.status === 'approved' && request.expiresAt <= new Date() ? 'expired' : request.status,
  }
}

export async function listPasswordResetRequests({ page = 1, pageSize = 25, status, query, sort = 'desc' } = {}) {
  const prisma = await getPrisma()
  const paging = pagination(page, pageSize)
  const where = {}
  if (status) {
    if (!RESET_STATUSES.includes(status)) throw ApiError.badRequest('Invalid status filter')
    Object.assign(where, resetStatusWhere(status, new Date()))
  }
  if (query) {
    where.user = {
      OR: [
        { email: { contains: query, mode: 'insensitive' } },
        { name: { contains: query, mode: 'insensitive' } },
      ],
    }
  }
  const [total, rows] = await Promise.all([
    prisma.passwordReset.count({ where }),
    prisma.passwordReset.findMany({
      where,
      orderBy: { createdAt: sort === 'asc' ? 'asc' : 'desc' },
      skip: paging.skip,
      take: paging.pageSize,
      include: { user: { select: { id: true, email: true, name: true, status: true } } },
    }),
  ])
  return { requests: rows.map(publicResetRequest), total, page: paging.page, pageSize: paging.pageSize }
}

export async function getPasswordResetRequest(id) {
  const prisma = await getPrisma()
  const request = await prisma.passwordReset.findUnique({
    where: { id },
    include: { user: { select: { id: true, email: true, name: true, status: true } } },
  })
  if (!request) throw ApiError.notFound('Password reset request not found')
  return publicResetRequest(request)
}

export async function createPasswordRecoveryRequest({ email, ip, userAgent }) {
  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, status: true, securityQuestion: true, securityAnswerHash: true },
  })
  // Intentionally return the same result for unknown, suspended, and legacy
  // accounts so this endpoint cannot be used to enumerate users.
  if (!user || user.status !== 'active' || !user.securityQuestion || !user.securityAnswerHash) return { created: false }
  const now = new Date()
  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.passwordReset.findFirst({ where: { userId: user.id, status: 'pending' }, select: { id: true } })
    if (existing) return false
    await tx.passwordReset.updateMany({
      where: { userId: user.id, status: 'approved', used: false, revokedAt: null },
      data: { status: 'revoked', used: true, usedAt: now, revokedAt: now },
    })
    await tx.passwordReset.create({
      // A pending request has no credential. Keep the legacy non-null column
      // populated with an unrecoverable random digest until approval.
      data: {
        userId: user.id, tokenHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
        expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), status: 'pending',
        ipAddress: ip || null, userAgent: userAgent || null,
      },
    })
    return true
  })
  if (created) await writeAuditLog({ action: 'password_recovery.requested', actor: user.id, actorRole: 'user', entityType: 'user', entityId: user.id, ip })
  return { created }
}

export async function approvePasswordRecoveryRequest(id, actorEmail, ip) {
  const prisma = await getPrisma()
  const request = await prisma.passwordReset.findUnique({ where: { id }, include: { user: { select: { status: true } } } })
  if (!request) throw ApiError.notFound('Password recovery request not found')
  if (request.status !== 'pending' || request.user.status !== 'active') throw ApiError.badRequest('Only pending requests for active users can be approved')
  const temporaryPassword = generateTemporaryPassword()
  const now = new Date()
  const changed = await prisma.passwordReset.updateMany({
    where: { id, status: 'pending' },
    data: { status: 'approved', tokenHash: await bcrypt.hash(temporaryPassword, 10), expiresAt: new Date(now.getTime() + 10 * 60 * 1000), approvedAt: now, approvedBy: actorEmail },
  })
  if (changed.count !== 1) throw ApiError.conflict('Recovery request was changed before approval')
  await writeAuditLog({ action: 'password_recovery.approved', actor: actorEmail, actorRole: 'admin', entityType: 'password_reset', entityId: id, details: { userId: request.userId, temporaryCredentialExpiresIn: '10m' }, ip })
  return { temporaryPassword, expiresAt: new Date(now.getTime() + 10 * 60 * 1000) }
}

export async function rejectPasswordRecoveryRequest(id, actorEmail, ip) {
  const prisma = await getPrisma()
  const request = await prisma.passwordReset.findUnique({ where: { id } })
  if (!request) throw ApiError.notFound('Password recovery request not found')
  if (request.status !== 'pending') throw ApiError.badRequest('Only pending recovery requests can be rejected')
  const now = new Date()
  const changed = await prisma.passwordReset.updateMany({
    where: { id, status: 'pending' }, data: { status: 'rejected', rejectedAt: now, rejectedBy: actorEmail },
  })
  if (changed.count !== 1) throw ApiError.conflict('Recovery request was changed before rejection')
  await writeAuditLog({
    action: 'password_recovery.rejected',
    actor: actorEmail,
    actorRole: 'admin',
    entityType: 'password_reset',
    entityId: id,
    details: { userId: request.userId },
    ip,
  })
  return { success: true }
}

export async function completePasswordRecovery({ recoveryId, userId, securityAnswer, newPassword, ip, userAgent }) {
  const { normalizeSecurityAnswer } = await import('../controllers/authController.js')
  const prisma = await getPrisma()
  const request = await prisma.passwordReset.findUnique({ where: { id: recoveryId }, include: { user: { select: { securityAnswerHash: true } } } })
  const now = new Date()
  if (!request || request.userId !== userId || request.status !== 'approved' || request.used || request.revokedAt || request.expiresAt <= now || !request.user.securityAnswerHash) {
    throw ApiError.unauthorized('Recovery session is invalid or expired')
  }
  const answerMatches = await bcrypt.compare(normalizeSecurityAnswer(securityAnswer), request.user.securityAnswerHash)
  if (!answerMatches) {
    const changed = await prisma.passwordReset.updateMany({
      where: { id: recoveryId, status: 'approved', securityAttempts: { lt: 5 } },
      data: { securityAttempts: { increment: 1 } },
    })
    if (changed.count === 1) {
      const latest = await prisma.passwordReset.findUnique({ where: { id: recoveryId }, select: { securityAttempts: true } })
      if (latest?.securityAttempts >= 5) {
        await prisma.passwordReset.updateMany({ where: { id: recoveryId, status: 'approved', securityAttempts: { gte: 5 } }, data: { status: 'locked', lockedAt: now, used: true, usedAt: now } })
        await writeAuditLog({ action: 'password_recovery.locked', actor: userId, actorRole: 'user', entityType: 'password_reset', entityId: recoveryId, ip })
      }
    }
    throw ApiError.unauthorized('Security answer is incorrect')
  }
  const passwordHash = await bcrypt.hash(newPassword, 10)
  const consumed = await prisma.$transaction(async (tx) => {
    const claimed = await tx.passwordReset.updateMany({
      where: { id: recoveryId, userId, status: 'approved', used: false, revokedAt: null, expiresAt: { gt: now }, securityAttempts: { lt: 5 } },
      data: { status: 'used', used: true, usedAt: now },
    })
    if (claimed.count !== 1) return false
    await tx.user.update({ where: { id: userId }, data: { password: passwordHash, sessionVersion: { increment: 1 } } })
    return true
  })
  if (!consumed) throw ApiError.unauthorized('Recovery session is invalid or expired')
  await writeAuditLog({ action: 'password_recovery.completed', actor: userId, actorRole: 'user', entityType: 'password_reset', entityId: recoveryId, details: { userAgent }, ip })
  return { success: true }
}

export function generateTemporaryPassword() {
  const pools = ['ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%*?']
  const pick = (pool) => pool[randomBytes(1)[0] % pool.length]
  const chars = [pick(pools[0]), pick(pools[1]), pick(pools[2]), pick(pools.join('')), pick(pools.join(''))]
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swap = randomBytes(1)[0] % (index + 1)
    ;[chars[index], chars[swap]] = [chars[swap], chars[index]]
  }
  return chars.join('')
}

export async function deletePasswordResetRequest(id, actorEmail, ip) {
  const prisma = await getPrisma()
  const request = await prisma.passwordReset.findUnique({ where: { id } })
  if (!request) throw ApiError.notFound('Password reset request not found')
  if (request.used || request.revokedAt) throw ApiError.badRequest('Cannot delete a consumed reset token')
  await prisma.passwordReset.delete({ where: { id } })
  await writeAuditLog({
    action: 'password_reset.deleted',
    actor: actorEmail,
    actorRole: 'admin',
    entityType: 'password_reset',
    entityId: id,
    details: { userId: request.userId },
    ip,
  })
  return { success: true }
}
