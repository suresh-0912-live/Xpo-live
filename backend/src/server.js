import app from './app.js'
import env from './config/env.js'
import logger from './utils/logger.js'
import { startForexScheduler } from './jobs/forexScheduler.js'

const server = app.listen(env.port, () => {
  logger.info(`XPO backend listening on http://localhost:${env.port} (${env.nodeEnv})`)

  // Market data scheduler — one shared source of provider requests for all
  // users. Skipped during tests.
  if (!env.isTest) startForexScheduler()
})

function shutdown(signal) {
  logger.info(`${signal} received, shutting down`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 5000).unref()
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

export default server
