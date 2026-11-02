import bcrypt from 'bcrypt'
import { getPrisma } from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'
import asyncHandler from '../utils/asyncHandler.js'
import { signToken, adminTokenPayload } from '../utils/token.js'
import { writeAuditLog } from '../services/log.service.js'

function toPublicAdmin(admin) {
  return {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    role: admin.role,
    status: admin.status,
    lastLoginAt: admin.lastLoginAt,
  }
}

// POST /api/admin/auth/login
export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const prisma = await getPrisma()

  const admin = await prisma.admin.findUnique({ where: { email: email.toLowerCase() } })
  if (!admin) {
    await writeAuditLog({
      action: 'admin.login_failed',
      actor: email,
      actorRole: 'admin',
      details: { reason: 'unknown_email' },
      ip: req.ip,
    })
    throw ApiError.unauthorized('Invalid email or password')
  }

  const valid = await bcrypt.compare(password, admin.password)
  if (!valid) {
    await writeAuditLog({
      action: 'admin.login_failed',
      actor: admin.email,
      actorRole: 'admin',
      details: { reason: 'bad_password' },
      ip: req.ip,
    })
    throw ApiError.unauthorized('Invalid email or password')
  }

  if (admin.status !== 'active') throw ApiError.forbidden('Admin account is disabled')

  await prisma.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } })

  await writeAuditLog({
    action: 'admin.login',
    actor: admin.email,
    actorRole: admin.role,
    entityType: 'admin',
    entityId: admin.id,
    ip: req.ip,
  })

  res.json({ token: signToken(adminTokenPayload(admin)), admin: toPublicAdmin(admin) })
})

// GET /api/admin/auth/me
export const adminMe = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const admin = await prisma.admin.findUnique({ where: { id: req.auth.sub } })
  if (!admin) throw ApiError.notFound('Admin not found')
  res.json({ admin: toPublicAdmin(admin) })
})

// POST /api/admin/auth/logout
// JWTs are stateless, so the client discards its token; this endpoint records
// the sign-out in the audit trail (who, when, from where). The route sits
// behind requireAdmin, so a call without a valid admin session fails too.
export const adminLogout = asyncHandler(async (req, res) => {
  await writeAuditLog({
    action: 'admin.logout',
    actor: req.auth.email,
    actorRole: req.auth.role,
    entityType: 'admin',
    entityId: req.auth.sub,
    ip: req.ip,
  })
  res.json({ ok: true })
})

// PATCH /api/admin/auth/profile — admins may edit their own display name and
// change their own password (current password required). Email, role and
// status are deliberately NOT editable here: those are privileged fields
// with no self-service flow in XPO. Every change is audited; passwords are
// never logged or returned.
export const updateAdminProfile = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const { name, currentPassword, newPassword } = req.body

  const admin = await prisma.admin.findUnique({ where: { id: req.auth.sub } })
  if (!admin) throw ApiError.notFound('Admin not found')

  const changes = {}

  if (name !== undefined) {
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      throw ApiError.badRequest('Validation failed', ['name must be at least 2 characters'])
    }
    changes.name = trimmed
  }

  if (newPassword !== undefined) {
    // Password change requires the current password — a stolen session must
    // not be enough to lock the real admin out.
    if (typeof currentPassword !== 'string' || currentPassword.length < 1) {
      throw ApiError.badRequest('Validation failed', [
        'currentPassword is required to change the password',
      ])
    }
    if (newPassword.length < 8) {
      throw ApiError.badRequest('Validation failed', ['newPassword must be at least 8 characters'])
    }
    const valid = await bcrypt.compare(currentPassword, admin.password)
    if (!valid) {
      throw ApiError.badRequest('Validation failed', ['currentPassword is incorrect'])
    }
    changes.password = await bcrypt.hash(newPassword, 10)
  }

  if (Object.keys(changes).length === 0) {
    throw ApiError.badRequest('Validation failed', ['nothing to update — provide name and/or newPassword'])
  }

  const updated = await prisma.admin.update({
    where: { id: admin.id },
    data: changes,
    select: { id: true, email: true, name: true, role: true, status: true, lastLoginAt: true },
  })

  await writeAuditLog({
    action: 'admin.profile_update',
    actor: admin.email,
    actorRole: admin.role,
    entityType: 'admin',
    entityId: admin.id,
    details: {
      nameChanged: name !== undefined,
      passwordChanged: newPassword !== undefined,
    },
    ip: req.ip,
  })

  res.json({ admin: updated })
})
