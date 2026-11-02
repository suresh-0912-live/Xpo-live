import env from '../config/env.js'
import { fetchForexSnapshot, isForexConfigured } from '../services/ibrlive.service.js'
import { saveQuotes } from '../services/market.service.js'
import { setNextRefresh } from '../services/providerState.js'
import { writeSystemLog } from '../services/log.service.js'
import logger from '../utils/logger.js'

// ONE backend scheduler → cache → XPO API. All users read the database
// cache; the number of provider requests is fixed by the refresh interval,
// independent of user count.
//
// 80s interval => ~32,400 requests/month against a 35,000/month limit.

let timer = null
let running = false
let announcedFirstSuccess = false

function intervalMs() {
  return env.forex.refreshIntervalSeconds * 1000
}

// Runs one refresh cycle. Never throws — a failed provider call keeps the
// last valid cached data untouched and records the failure.
export async function runForexFetch() {
  if (running) return { skipped: 'in_flight' }
  running = true

  try {
    const { quotes } = await fetchForexSnapshot()
    const saved = await saveQuotes('forex', quotes)

    if (saved === 0) {
      await writeSystemLog({
        level: 'warn',
        source: 'scheduler',
        message: 'Forex refresh returned quotes but none matched active markets',
      })
    } else if (!announcedFirstSuccess) {
      announcedFirstSuccess = true
      await writeSystemLog({
        level: 'info',
        source: 'scheduler',
        message: `Forex scheduler active: ${saved} quotes cached every ${env.forex.refreshIntervalSeconds}s`,
        details: { symbols: env.ibrlive.symbols },
      })
    }

    return { ok: true, saved }
  } catch (error) {
    // Keep last valid data — do NOT write null/fake prices.
    await writeSystemLog({
      level: 'error',
      source: 'scheduler',
      message: `Forex refresh failed, keeping last valid cache: ${error.message}`,
      details: { code: error.code || null },
    })
    return { ok: false, error: error.message }
  } finally {
    running = false
    if (timer) {
      setNextRefresh('forex', new Date(Date.now() + intervalMs()).toISOString())
    }
  }
}

export function startForexScheduler() {
  if (timer) return { started: false, reason: 'already_running' }

  if (!isForexConfigured()) {
    logger.warn('Forex scheduler NOT started: IBRLIVE_API_KEY is not set')
    writeSystemLog({
      level: 'warn',
      source: 'scheduler',
      message: 'Forex scheduler idle: IBRLIVE_API_KEY missing (set it and restart)',
    })
    return { started: false, reason: 'not_configured' }
  }

  timer = setInterval(runForexFetch, intervalMs())
  setNextRefresh('forex', new Date(Date.now() + intervalMs()).toISOString())

  logger.info(
    `Forex scheduler started: every ${env.forex.refreshIntervalSeconds}s ` +
      `(~${Math.round((30 * 24 * 3600) / env.forex.refreshIntervalSeconds)} req/month, ` +
      `limit ${env.forex.monthlyRequestLimit})`,
  )
  runForexFetch() // immediate first fetch
  return { started: true }
}

export function stopForexScheduler() {
  if (timer) clearInterval(timer)
  timer = null
  setNextRefresh('forex', null)
}

export function getSchedulerStatus() {
  return {
    running: Boolean(timer),
    intervalSeconds: env.forex.refreshIntervalSeconds,
    inFlight: running,
  }
}
