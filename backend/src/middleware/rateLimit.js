import rateLimit from 'express-rate-limit'
import env from '../config/env.js'

// Generous limits in tests so the suite never trips the limiter.
const testLimits = env.isTest

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: testLimits ? 10000 : 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
})

// Stricter limit for credential endpoints (brute-force protection).
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: testLimits ? 10000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
})

// Recovery starts and answer verification are deliberately separated from
// ordinary login throttling so a recovery workflow cannot be brute-forced.
export const recoveryLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: testLimits ? 10000 : 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many recovery attempts, please try again later.' },
})
