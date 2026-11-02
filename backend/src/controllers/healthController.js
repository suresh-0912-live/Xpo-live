import { pingDatabase } from '../config/prisma.js'
import env from '../config/env.js'
import asyncHandler from '../utils/asyncHandler.js'

// GET /api/health — API + database status.
export const getHealth = asyncHandler(async (req, res) => {
  const database = await pingDatabase()

  res.json({
    status: database.status === 'up' ? 'ok' : 'degraded',
    api: 'up',
    database,
    environment: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  })
})
