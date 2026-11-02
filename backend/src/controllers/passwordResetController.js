import ApiError from '../utils/ApiError.js'
import asyncHandler from '../utils/asyncHandler.js'
import {
  approvePasswordRecoveryRequest,
  completePasswordRecovery,
  createPasswordRecoveryRequest,
  deletePasswordResetRequest,
  getPasswordResetRequest,
  listPasswordResetRequests,
  rejectPasswordRecoveryRequest,
} from '../services/notification.service.js'
import { verifyToken } from '../utils/token.js'

export const listPasswordResetRequestsRoute = asyncHandler(async (req, res) => {
  const { page, pageSize, status, query, sort } = req.query
  const result = await listPasswordResetRequests({
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 25,
    status,
    query,
    sort,
  })
  res.json(result)
})

export const getPasswordResetRequestRoute = asyncHandler(async (req, res) => {
  const request = await getPasswordResetRequest(req.params.id)
  res.json({ request })
})

export const requestPasswordRecoveryRoute = asyncHandler(async (req, res) => {
  await createPasswordRecoveryRequest({
    email: req.body.email.trim(),
    ip: req.ip,
    userAgent: req.get('user-agent') || undefined,
  })
  // Identical response for all inputs prevents email enumeration.
  res.status(202).json({ message: 'If the account is eligible, a recovery request has been submitted for review.' })
})

export const completePasswordRecoveryRoute = asyncHandler(async (req, res) => {
  const { recoveryToken, securityAnswer, newPassword } = req.body
  let payload
  try {
    payload = verifyToken(recoveryToken)
  } catch {
    throw ApiError.unauthorized('Recovery session is invalid or expired')
  }
  if (payload.type !== 'recovery' || typeof payload.sub !== 'string' || typeof payload.recoveryId !== 'string') {
    throw ApiError.unauthorized('Recovery session is invalid or expired')
  }
  res.json(await completePasswordRecovery({ recoveryId: payload.recoveryId, userId: payload.sub, securityAnswer, newPassword, ip: req.ip, userAgent: req.get('user-agent') || undefined }))
})

export const approvePasswordRecoveryRequestRoute = asyncHandler(async (req, res) => {
  const result = await approvePasswordRecoveryRequest(req.params.id, req.auth.email, req.ip)
  res.json(result)
})

export const rejectPasswordRecoveryRequestRoute = asyncHandler(async (req, res) => {
  const result = await rejectPasswordRecoveryRequest(req.params.id, req.auth.email, req.ip)
  res.json(result)
})

export const deletePasswordResetRequestRoute = asyncHandler(async (req, res) => {
  const result = await deletePasswordResetRequest(req.params.id, req.auth.email, req.ip)
  res.json(result)
})
