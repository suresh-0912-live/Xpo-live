import { getPrisma } from '../config/prisma.js'
import logger from '../utils/logger.js'

// Log writers never throw into the request path — failures fall back to
// the console logger only.

export async function writeSystemLog({ level = 'info', source = 'api', message, details }) {
  logger[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'info'](
    `[${source}] ${message}`,
    details,
  )
  try {
    const prisma = await getPrisma()
    await prisma.systemLog.create({
      data: { level, source, message, details: details ?? undefined },
    })
  } catch (error) {
    logger.error(`systemLog write failed: ${error.message}`)
  }
}

export async function writeAuditLog({
  action,
  actor,
  actorRole,
  entityType,
  entityId,
  details,
  ip,
}) {
  try {
    const prisma = await getPrisma()
    await prisma.auditLog.create({
      data: {
        action,
        actor,
        actorRole,
        entityType,
        entityId,
        details: details ?? undefined,
        ip,
      },
    })
  } catch (error) {
    logger.error(`auditLog write failed: ${error.message}`)
  }
}
