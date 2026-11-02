import env from '../config/env.js'
import { getPrisma, pingDatabase } from '../config/prisma.js'
import { getProviderState } from './providerState.js'
import { isForexConfigured } from './ibrlive.service.js'
import { isCryptoConfigured } from './cryptoProvider.service.js'
import { getUsageSummary } from './usage.service.js'
import { getLastMarketUpdate } from './market.service.js'

function healthFromState(state) {
  if (state.consecutiveFailures >= 3) return 'degraded'
  if (state.lastError && !state.lastSuccessAt) return 'degraded'
  if (state.lastError && state.lastErrorAt && state.lastSuccessAt) {
    return new Date(state.lastErrorAt) > new Date(state.lastSuccessAt) ? 'degraded' : 'ok'
  }
  return 'ok'
}

// Last known attempt from the ApiUsage table — used when the process has
// just restarted and in-memory state is empty.
async function lastUsage(provider, successOnly) {
  const prisma = await getPrisma()
  return prisma.apiUsage.findFirst({
    where: { provider, ...(successOnly ? { success: true } : {}) },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, httpStatus: true, error: true, success: true },
  })
}

export async function getForexProviderStatus() {
  const configured = isForexConfigured()
  const state = getProviderState('forex')
  const usage = await getUsageSummary('ibrlive')

  const lastSuccessAt =
    state.lastSuccessAt || (await lastUsage('ibrlive', true))?.createdAt || null
  const lastAttemptRow = await lastUsage('ibrlive', false)
  const attemptFailed = Boolean(lastAttemptRow && !lastAttemptRow.success)
  const lastErrorAt =
    state.lastErrorAt || (attemptFailed ? lastAttemptRow.createdAt : null)
  const lastError =
    state.lastError || (attemptFailed ? lastAttemptRow.error : null)

  // Only surface the error while it is the newest event (i.e. unfixed).
  const errorIsCurrent =
    Boolean(lastErrorAt) &&
    (!lastSuccessAt || new Date(lastErrorAt) > new Date(lastSuccessAt))

  return {
    provider: 'forex',
    name: 'IBRLive',
    configured,
    status: !configured ? 'not_configured' : healthFromState(state),
    refreshIntervalSeconds: env.forex.refreshIntervalSeconds,
    nextRefreshAt: state.nextRefreshAt,
    lastAttemptAt: state.lastAttemptAt || lastAttemptRow?.createdAt || null,
    lastSuccessAt,
    lastErrorAt: errorIsCurrent ? lastErrorAt : null,
    lastError: errorIsCurrent ? lastError : null,
    consecutiveFailures: state.consecutiveFailures,
    usage,
    symbols: env.ibrlive.symbols,
  }
}

export async function getCryptoProviderStatus() {
  const configured = isCryptoConfigured()
  const state = getProviderState('crypto')

  return {
    provider: 'crypto',
    name: 'Crypto provider',
    configured,
    status: !configured ? 'not_configured' : healthFromState(state),
    refreshIntervalSeconds: env.cryptoProvider.refreshIntervalSeconds,
    lastSuccessAt: state.lastSuccessAt,
    lastErrorAt: state.lastError,
    lastError: state.lastError,
    consecutiveFailures: state.consecutiveFailures,
  }
}

// Full status used by GET /api/markets/status, the admin dashboard and
// GET /api/health-adjacent views.
export async function getStatus() {
  const [database, forex, crypto, lastMarketUpdate] = await Promise.all([
    pingDatabase(),
    getForexProviderStatus(),
    getCryptoProviderStatus(),
    getLastMarketUpdate(),
  ])

  return {
    backend: {
      status: 'up',
      uptimeSeconds: Math.round(process.uptime()),
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    },
    database,
    lastMarketUpdate,
    providers: { forex, crypto },
  }
}
