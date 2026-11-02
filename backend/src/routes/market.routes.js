import { Router } from 'express'
import { getForex, getCrypto, getStatusRoute } from '../controllers/marketController.js'

const router = Router()

router.get('/forex', getForex)
router.get('/crypto', getCrypto)
router.get('/status', getStatusRoute)

export default router
