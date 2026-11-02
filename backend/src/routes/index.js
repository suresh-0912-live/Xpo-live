import { Router } from 'express'
import { getHealth } from '../controllers/healthController.js'
import authRoutes from './auth.routes.js'
import adminAuthRoutes from './adminAuth.routes.js'
import marketRoutes from './market.routes.js'
import adminRoutes from './admin.routes.js'
import financeRoutes from './finance.routes.js'

const router = Router()

router.get('/health', getHealth)
router.use('/auth', authRoutes)
router.use('/admin/auth', adminAuthRoutes)
router.use('/markets', marketRoutes)
router.use('/admin', adminRoutes)
// Account/finance endpoints (/dashboard/summary, /transactions, /holdings,
// /deposits, /withdrawals) — all user-scoped, defined in finance.routes.js.
router.use('/', financeRoutes)

export default router

