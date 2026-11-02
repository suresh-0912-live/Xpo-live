import { getPrisma } from '../config/prisma.js'
import env from '../config/env.js'
import { writeSystemLog } from './log.service.js'

function monthStart(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

function monthKey(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

// Persist one outbound provider request (success or failure).
export async function recordApiUsage({
  provider,
  endpoint,
  success,
  httpStatus = null,
  responseTimeMs = null,
  error = null,
}) {
  try {
    const prisma = await getPrisma()
    await prisma.apiUsage.create({
      data: {
        provider,
        endpoint,
        success,
        httpStatus,
        responseTimeMs,
        error: error ? String(error).slice(0, 1000) : null,
      },
    })
  } catch (dbError) {
    console.error(`[usage] failed to record API usage: ${dbError.message}`)
  }
}

export async function getMonthlyUsage(provider, now = new Date()) {
  const prisma = await getPrisma()
  return prisma.apiUsage.count({
    where: { provider, createdAt: { gte: monthStart(now) } },
  })
}

export async function getTodayUsage(provider, now = new Date()) {
  const prisma = await getPrisma()
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  return prisma.apiUsage.count({
    where: { provider, createdAt: { gte: dayStart } },
  })
}

// Monthly usage vs. limit + one-time warning SystemLog at the threshold.
export async function getUsageSummary(provider) {
  const now = new Date()
  const monthlyRequests = await getMonthlyUsage(provider, now)

  const isForex = provider === 'ibrlive'
  const limit = isForex ? env.forex.monthlyRequestLimit : null
  const threshold = isForex ? env.forex.warningThreshold : null
  const warning = Boolean(threshold && monthlyRequests >= threshold)

  if (warning && isForex) {
    const key = `usage-warning:${provider}:${monthKey(now)}`
    try {
      const prisma = await getPrisma()
      const existing = await prisma.systemLog.findFirst({
        where: { source: 'usage', details: { path: ['key'], equals: key } },
      })
      if (!existing) {
        await writeSystemLog({
          level: 'warn',
          source: 'usage',
          message: `Forex provider monthly usage ${monthlyRequests}/${limit} has reached the warning threshold (${threshold})`,
          details: { key, provider, monthlyRequests, threshold, limit },
        })
      }
    } catch {
      // warning log is best-effort
    }
  }

  return {
    monthlyRequests,
    monthlyLimit: limit,
    warningThreshold: threshold,
    warning,
    remaining: limit === null ? null : Math.max(0, limit - monthlyRequests),
  }
}

// Refuse to call the provider once the monthly limit is exhausted.
export async function canRequestProvider(provider) {
  if (provider !== 'ibrlive') return { allowed: true }
  const monthlyRequests = await getMonthlyUsage(provider)
  if (monthlyRequests >= env.forex.monthlyRequestLimit) {
    return {
      allowed: false,
      reason: `Monthly request limit reached (${monthlyRequests}/${env.forex.monthlyRequestLimit})`,
    }
  }
  return { allowed: true }
}
