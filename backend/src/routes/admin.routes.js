import { Router } from 'express'
import {
  getDashboard,
  listUsers,
  getUserDetail,
  listUserTransactions,
  updateUserStatus,
  deleteUser,
  listMarkets,
  updateMarket,
  refreshForex,
  listApiUsage,
  listSystemLogs,
  listAuditLogs,
  getActivity,
  getSettings,
  getAdminHealth,
} from '../controllers/adminController.js'
import {
  listDeposits,
  getDepositDetail,
  approveDeposit,
  rejectDeposit,
  listWithdrawals,
  getWithdrawalDetail,
  approveWithdrawal,
  rejectWithdrawal,
  listAllTransactions,
  getTransactionDetail,
  exportTransactionsCsv,
} from '../controllers/adminFinanceController.js'
import {
  listNotifications,
  getNotification,
  createNotification,
  updateNotification,
  deleteNotification,
  updateNotificationStatusRoute,
  sendNotificationRoute,
  getDeliveryStatusRoute,
  listDeliveriesRoute,
  listAllDeliveriesRoute,
} from '../controllers/notificationController.js'
import {
  listPasswordResetRequestsRoute,
  getPasswordResetRequestRoute,
  approvePasswordRecoveryRequestRoute,
  rejectPasswordRecoveryRequestRoute,
  deletePasswordResetRequestRoute,
} from '../controllers/passwordResetController.js'
import { requireAdmin } from '../middleware/auth.js'
import { validateBody } from '../middleware/validate.js'

const router = Router()

// Every /api/admin route (except auth, mounted separately) requires a
// valid admin JWT.
router.use(requireAdmin)

router.get('/dashboard', getDashboard)
router.get('/health', getAdminHealth)

router.get('/users', listUsers)
router.get('/users/:id', getUserDetail)
router.get('/users/:id/transactions', listUserTransactions)
router.patch(
  '/users/:id',
  validateBody({
    status: { required: true, type: 'string', enum: ['active', 'suspended'] },
    reason: { required: true, type: 'string', min: 3, max: 500 },
  }),
  updateUserStatus,
)
router.delete(
  '/users/:id',
  validateBody({
    reason: { required: true, type: 'string', min: 3, max: 500 },
  }),
  deleteUser,
)

// ---------------------------------------------------------------- finance --
// Deposit/withdrawal review + cross-user ledger (Part 3). All decisions are
// atomic server-side; reject always requires a reason (validated below).

router.get('/deposits', listDeposits)
router.get('/deposits/:id', getDepositDetail)
router.post('/deposits/:id/approve', approveDeposit)
router.post(
  '/deposits/:id/reject',
  validateBody({ reason: { required: true, type: 'string', min: 3, max: 500 } }),
  rejectDeposit,
)

router.get('/withdrawals', listWithdrawals)
router.get('/withdrawals/:id', getWithdrawalDetail)
router.post('/withdrawals/:id/approve', approveWithdrawal)
router.post(
  '/withdrawals/:id/reject',
  validateBody({ reason: { required: true, type: 'string', min: 3, max: 500 } }),
  rejectWithdrawal,
)

// NOTE: export.csv is registered BEFORE /transactions/:id so the literal
// path is not swallowed by the :id parameter.
router.get('/transactions', listAllTransactions)
router.get('/transactions/export.csv', exportTransactionsCsv)
router.get('/transactions/:id', getTransactionDetail)

router.get('/markets', listMarkets)
router.patch(
  '/markets/:id',
  validateBody({ active: { required: true, type: 'boolean' } }),
  updateMarket,
)
router.post('/markets/forex/refresh', refreshForex)

router.get('/api-usage', listApiUsage)
router.get('/system-logs', listSystemLogs)
router.get('/audit-logs', listAuditLogs)
router.get('/activity', getActivity)
router.get('/settings', getSettings)

// ------------------------------------------------------------- notifications
router.get('/notifications', listNotifications)
router.get('/notifications/deliveries', listAllDeliveriesRoute)
router.get('/notifications/:id', getNotification)
router.post('/notifications', createNotification)
router.patch('/notifications/:id', updateNotification)
router.delete('/notifications/:id', deleteNotification)
router.post('/notifications/:id/status', updateNotificationStatusRoute)
router.post('/notifications/:id/send', sendNotificationRoute)
router.get('/notifications/:id/delivery-status', getDeliveryStatusRoute)
router.get('/notifications/:id/deliveries', listDeliveriesRoute)

// ----------------------------------------------------------- password resets
router.get('/password-resets', listPasswordResetRequestsRoute)
router.get('/password-resets/:id', getPasswordResetRequestRoute)
router.post('/password-resets/:id/approve', approvePasswordRecoveryRequestRoute)
router.post('/password-resets/:id/reject', rejectPasswordRecoveryRequestRoute)
router.delete('/password-resets/:id', deletePasswordResetRequestRoute)

export default router
