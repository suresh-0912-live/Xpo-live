import { Router } from 'express'
import {
  DEPOSIT_METHODS,
  createDeposit,
  createWithdrawal,
  getSummary,
  listHoldings,
  listTransactions,
} from '../controllers/finance.controller.js'
import { requireUser } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'
import {
  listMyNotifications,
  markAllMyNotificationsRead,
  markMyNotificationRead,
} from '../controllers/notificationController.js'

// User-scoped account/finance routes. Everything below requires a valid
// user JWT and only ever reads/writes the caller's own rows.
const router = Router()

// requireUser is applied per route (NOT router.use) so unknown API paths
// still fall through to the JSON 404 handler instead of returning 401.
router.get('/dashboard/summary', requireUser, getSummary)
router.get('/transactions', requireUser, listTransactions)
router.get('/holdings', requireUser, listHoldings)
router.get('/notifications', requireUser, listMyNotifications)
router.post('/notifications/read-all', requireUser, markAllMyNotificationsRead)
router.post('/notifications/:id/read', requireUser, markMyNotificationRead)

router.post(
  '/deposits',
  requireUser,
  validateBody({
    amount: { required: true, type: 'number' },
    method: { required: true, type: 'string', enum: DEPOSIT_METHODS },
  }),
  createDeposit,
)

router.post(
  '/withdrawals',
  requireUser,
  validateBody({
    amount: { required: true, type: 'number' },
  }),
  createWithdrawal,
)

export default router
