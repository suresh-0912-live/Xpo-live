import { Router } from 'express'
import { register, login, me } from '../controllers/authController.js'
import { requestPasswordRecoveryRoute, completePasswordRecoveryRoute } from '../controllers/passwordResetController.js'
import { requireUser } from '../middleware/auth.js'
import { authLimiter, recoveryLimiter } from '../middleware/rateLimit.js'
import { validateBody } from '../middleware/validate.js'

const router = Router()

router.post(
  '/register',
  authLimiter,
  validateBody({
    email: { required: true, type: 'string', email: true, max: 255 },
    password: { required: true, type: 'string', min: 8, max: 72 },
    name: { type: 'string', max: 120 },
    securityQuestion: { required: true, type: 'string', min: 5, max: 250 },
    securityAnswer: { required: true, type: 'string', min: 1, max: 250 },
  }),
  register,
)

router.post(
  '/login',
  authLimiter,
  validateBody({
    email: { required: true, type: 'string', email: true, max: 255 },
    password: { required: true, type: 'string', min: 1, max: 72 },
  }),
  login,
)

router.get('/me', requireUser, me)
router.post(
  '/password-recovery/request',
  recoveryLimiter,
  validateBody({ email: { required: true, type: 'string', email: true, max: 255 } }),
  requestPasswordRecoveryRoute,
)
router.post(
  '/password-recovery/complete',
  recoveryLimiter,
  validateBody({
    recoveryToken: { required: true, type: 'string', min: 20, max: 2000 },
    securityAnswer: { required: true, type: 'string', min: 1, max: 250 },
    newPassword: { required: true, type: 'string', min: 8, max: 72 },
  }),
  completePasswordRecoveryRoute,
)

export default router
