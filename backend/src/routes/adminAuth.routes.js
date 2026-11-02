import { Router } from 'express'
import {
  adminLogin,
  adminLogout,
  adminMe,
  updateAdminProfile,
} from '../controllers/adminAuthController.js'
import { requireAdmin } from '../middleware/auth.js'
import { authLimiter } from '../middleware/rateLimit.js'
import { validateBody } from '../middleware/validate.js'

const router = Router()

router.post(
  '/login',
  authLimiter,
  validateBody({
    email: { required: true, type: 'string', email: true, max: 255 },
    password: { required: true, type: 'string', min: 1, max: 72 },
  }),
  adminLogin,
)

router.get('/me', requireAdmin, adminMe)

router.post('/logout', requireAdmin, adminLogout)

// Self-service profile: name and/or password change. Type/length rules are
// validated here; the current-password check lives in the controller.
router.patch(
  '/profile',
  requireAdmin,
  validateBody({
    name: { type: 'string', min: 2, max: 100 },
    currentPassword: { type: 'string', min: 1, max: 72 },
    newPassword: { type: 'string', min: 8, max: 72 },
  }),
  updateAdminProfile,
)

export default router
