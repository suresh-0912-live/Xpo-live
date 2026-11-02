import ApiError from '../utils/ApiError.js'
import { verifyToken } from '../utils/token.js'
import asyncHandler from '../utils/asyncHandler.js'
import { getPrisma } from '../config/prisma.js'

// Roles in the Admin table that may use the admin API. Fail closed: an
// unknown role is rejected like a missing account.
const ADMIN_ROLES = ['superadmin', 'admin']

function extractToken(req) {
  const header = req.headers.authorization || ''
  if (!header.startsWith('Bearer ')) return null
  return header.slice(7).trim() || null
}

function authenticate(req, expectedType) {
  const token = extractToken(req)
  if (!token) throw ApiError.unauthorized('Missing bearer token')

  let payload
  try {
    payload = verifyToken(token)
  } catch {
    throw ApiError.unauthorized('Invalid or expired token')
  }

  if (payload.type !== expectedType) {
    throw ApiError.forbidden('Insufficient permissions')
  }
  req.auth = payload
  return payload
}

// Requires a valid user JWT.
export const requireUser = asyncHandler(async (req, _res, next) => {
  authenticate(req, 'user')
  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({
    where: { id: req.auth.sub },
    select: { id: true, email: true, status: true, sessionVersion: true },
  })
  if (!user || user.status !== 'active' || (req.auth.sessionVersion ?? 0) !== user.sessionVersion) {
    throw ApiError.unauthorized('User session is no longer valid')
  }
  req.auth = { ...req.auth, sub: user.id, email: user.email, sessionVersion: user.sessionVersion }
  next()
})

// Requires a valid admin JWT **and** a matching, active admin row in the
// database. The token alone is never trusted for authorization: a deleted,
// disabled or non-admin account is locked out immediately (401) even while
// its token is still cryptographically valid. The fresh DB role replaces the
// (possibly stale) role claim from the token.
export const requireAdmin = asyncHandler(async (req, _res, next) => {
  authenticate(req, 'admin')

  const prisma = await getPrisma()
  const admin = await prisma.admin.findUnique({
    where: { id: req.auth.sub },
    select: { id: true, email: true, role: true, status: true },
  })

  if (!admin || admin.status !== 'active' || !ADMIN_ROLES.includes(admin.role)) {
    throw ApiError.unauthorized('Admin session is no longer valid')
  }

  req.auth = { ...req.auth, sub: admin.id, email: admin.email, role: admin.role }
  next()
})
