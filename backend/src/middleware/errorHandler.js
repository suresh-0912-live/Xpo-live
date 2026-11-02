import env from '../config/env.js'
import ApiError from '../utils/ApiError.js'
import logger from '../utils/logger.js'

// Centralized error handling — the only place that formats error responses.
export default function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)

  let status = 500
  let message = 'Internal server error'
  let details

  if (error instanceof ApiError) {
    status = error.status
    message = error.message
    details = error.details
  } else if (error?.name === 'SyntaxError' && error?.status === 400) {
    status = 400
    message = 'Invalid JSON body'
  } else if (error?.code === 'P2002') {
    status = 409
    message = 'Unique constraint violation'
  } else if (error?.code === 'P2025') {
    status = 404
    message = 'Record not found'
  }

  logger.error(`${req.method} ${req.originalUrl} -> ${status} ${message}`, {
    stack: env.isProd ? undefined : error?.stack,
  })

  res.status(status).json({ error: message, ...(details !== undefined ? { details } : {}) })
}
