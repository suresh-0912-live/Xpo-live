import env from '../config/env.js'
import { recordApiUsage, canRequestProvider } from './usage.service.js'
import { markAttempt, markSuccess, markFailure } from './providerState.js'
import logger from '../utils/logger.js'

// IBRLive Forex provider — server-side only. The API key is passed as a
// query parameter per IBRLive docs and MUST never reach React.

const FOREX_ENDPOINT_PATH = '/api/forex/snapshot/symbols'
const TIMEOUT_MS = 10_000

export function isForexConfigured() {
  return env.isForexConfigured
}

export function forexEndpointLabel() {
  return `GET ${env.ibrlive.baseUrl}${FOREX_ENDPOINT_PATH}`
}

// One provider request fetches ALL XPO forex symbols (multi-symbol batch).
// Records an ApiUsage row for every attempt — success or failure.
export async function fetchForexSnapshot({ symbols = env.ibrlive.symbols } = {}) {
  if (!isForexConfigured()) {
    const error = new Error('Forex provider is not configured (IBRLIVE_API_KEY missing)')
    error.code = 'forex_not_configured'
    throw error
  }

  const gate = await canRequestProvider('ibrlive')
  if (!gate.allowed) {
    const error = new Error(gate.reason)
    error.code = 'forex_limit_reached'
    throw error
  }

  const url = new URL(`${env.ibrlive.baseUrl}${FOREX_ENDPOINT_PATH}`)
  url.searchParams.set('symbols', symbols.join(','))
  url.searchParams.set('apiKey', env.ibrlive.apiKey)

  markAttempt('forex')
  const started = performance.now()
  let httpStatus = null

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { accept: 'application/json' },
    })
    httpStatus = response.status

    if (!response.ok) {
      throw new Error(`IBRLive responded with HTTP ${response.status}`)
    }

    const body = await response.json()
    if (!body?.success) {
      throw new Error(body?.error || 'IBRLive response indicated failure')
    }

    const quotes = (body.lastQuotes || [])
      .map((quote) => ({
        symbol: String(quote.s || '').toUpperCase(),
        bid: Number.isFinite(Number(quote.b)) ? Number(quote.b) : null,
        ask: Number.isFinite(Number(quote.a)) ? Number(quote.a) : null,
        providerTimestamp: Number.isFinite(Number(quote.t)) ? Number(quote.t) : null,
      }))
      .map((quote) => {
        const price =
          quote.bid !== null && quote.ask !== null
            ? (quote.bid + quote.ask) / 2
            : (quote.bid ?? quote.ask)
        return { ...quote, price }
      })
      .filter((quote) => quote.symbol && Number.isFinite(quote.price) && quote.price > 0)

    if (quotes.length === 0) {
      throw new Error('IBRLive returned no usable quotes')
    }

    const responseTimeMs = Math.round(performance.now() - started)
    await recordApiUsage({
      provider: 'ibrlive',
      endpoint: forexEndpointLabel(),
      success: true,
      httpStatus,
      responseTimeMs,
    })
    markSuccess('forex')

    return { quotes, receivedAt: new Date().toISOString(), source: body.source || null }
  } catch (error) {
    const responseTimeMs = Math.round(performance.now() - started)
    await recordApiUsage({
      provider: 'ibrlive',
      endpoint: forexEndpointLabel(),
      success: false,
      httpStatus,
      responseTimeMs,
      error: error.message,
    })
    markFailure('forex', error)
    logger.warn(`IBRLive fetch failed: ${error.message}`)
    throw error
  }
}
