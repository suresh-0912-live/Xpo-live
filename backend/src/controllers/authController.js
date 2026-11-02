import bcrypt from 'bcrypt'
import { getPrisma } from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'
import asyncHandler from '../utils/asyncHandler.js'
import { signToken, userTokenPayload } from '../utils/token.js'
import { writeAuditLog } from '../services/log.service.js'

const SALT_ROUNDS = 10

export function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  }
}

// POST /api/auth/register
export const register = asyncHandler(async (req, res) => {
  const { email, password, name, securityQuestion, securityAnswer } = req.body
  const prisma = await getPrisma()

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) throw ApiError.conflict('Email is already registered')

  const normalizedSecurityAnswer = normalizeSecurityAnswer(securityAnswer)
  if (!securityQuestion.trim() || !normalizedSecurityAnswer) {
    throw ApiError.badRequest('Security question and answer are required')
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  const securityAnswerHash = await bcrypt.hash(normalizedSecurityAnswer, SALT_ROUNDS)
  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(), password: passwordHash, name: name || null,
      securityQuestion: securityQuestion.trim(), securityAnswerHash,
    },
  })

  await writeAuditLog({
    action: 'user.register',
    actor: user.email,
    entityType: 'user',
    entityId: user.id,
    ip: req.ip,
  })

  res.status(201).json({ token: signToken(userTokenPayload(user)), user: toPublicUser(user) })
})

export function normalizeSecurityAnswer(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US')
}

// POST /api/auth/login
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body
  const prisma = await getPrisma()

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  // Same message for unknown email / wrong password — no user enumeration.
  if (!user) throw ApiError.unauthorized('Invalid email or password')
  if (user.status !== 'active') throw ApiError.forbidden('Account is suspended')

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    const recovery = await findTemporaryPasswordRecovery(prisma, user.id, password)
    if (!recovery) throw ApiError.unauthorized('Invalid email or password')
    const recoveryToken = signToken(
      { sub: user.id, type: 'recovery', recoveryId: recovery.id, sessionVersion: user.sessionVersion ?? 0 },
      { expiresIn: '10m' },
    )
    return res.json({
      recovery: { token: recoveryToken, question: user.securityQuestion, expiresAt: recovery.expiresAt },
    })
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })

  res.json({ token: signToken(userTokenPayload(user)), user: toPublicUser(user) })
})

async function findTemporaryPasswordRecovery(prisma, userId, password) {
  const request = await prisma.passwordReset.findFirst({
    where: { userId, status: 'approved', used: false, revokedAt: null, temporaryUsedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { approvedAt: 'desc' },
  })
  if (!request || !(await bcrypt.compare(password, request.tokenHash))) return null
  // A valid temporary password may begin exactly one recovery session. A bad
  // password never reaches this conditional update and therefore never burns it.
  const claimed = await prisma.passwordReset.updateMany({
    where: { id: request.id, status: 'approved', temporaryUsedAt: null, expiresAt: { gt: new Date() } },
    data: { temporaryUsedAt: new Date() },
  })
  return claimed.count === 1 ? request : null
}

// GET /api/auth/me
export const me = asyncHandler(async (req, res) => {
  const prisma = await getPrisma()
  const user = await prisma.user.findUnique({ where: { id: req.auth.sub } })
  if (!user) throw ApiError.notFound('User not found')
  res.json({ user: toPublicUser(user) })
})
