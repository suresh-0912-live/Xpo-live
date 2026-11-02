import env from '../config/env.js'
import { getPrisma } from '../config/prisma.js'
import ApiError from '../utils/ApiError.js'
import { recordApiUsage } from './usage.service.js'
import { markAttempt, markSuccess, markFailure } from './providerState.js'
import logger from '../utils/logger.js'

// Crypto provider service. NO fake prices: if the provider is not
// configured, callers get a 503 service-unavailable error. When configured,
// responses are cached in MarketPrice so users never trigger one provider
// request each (refresh is throttled to CRYPTO_REFRESH_INTERVAL_SECONDS).

const TIMEOUT_MS = 10_000
const cache = {
  lastFetchAt: null,
  inFlight: null,
}

export function isCryptoConfigured() {
  return env.isCryptoConfigured
}

function cryptoSymbols() {
  return env.cryptoProvider.symbols
}

// Tolerant parser — accepts { quotes: [...] }, { data: [...] } or a bare array
// with quote objects containing symbol/price fields.
function parseQuotes(body) {
  const list = Array.isArray(body)
    ? body
    : body?.quotes || body?.data || body?.results || []
  return list
    .map((item) => ({
      symbol: String(item.symbol || item.s || '').toUpperCase(),
      price: Number(item.price ?? item.last ?? item.p),
      bid: Number.isFinite(Number(item.bid ?? item.b)) ? Number(item.bid ?? item.b) : null,
      ask: Number.isFinite(Number(item.ask ?? item.a)) ? Number(item.ask ?? item.a) : null,
    }))
    .filter((quote) => quote.symbol && Number.isFinite(quote.price) && quote.price > 0)
}

function cacheIsFresh() {
  if (!cache.lastFetchAt) return false
  const ageMs = Date.now() - cache.lastFetchAt.getTime()
  return ageMs < env.cryptoProvider.refreshIntervalSeconds * 1000
}

// Fetches crypto quotes from the configured provider, throttled by the
// refresh interval. Throws 503 when not configured.
export async function getFreshCryptoQuotes() {
  if (!isCryptoConfigured()) {
    throw ApiError.serviceUnavailable('Crypto service is not configured yet', {
      code: 'crypto_service_unavailable',
    })
  }

  // Serve from cache while fresh — one provider request per interval max.
  if (cacheIsFresh()) {
    return { cached: true }
  }
  if (cache.inFlight) return cache.inFlight

  cache.inFlight = (async () => {
    const endpoint = `${env.cryptoProvider.url}/quotes?symbols=${cryptoSymbols().join(',')}`
    const started = performance.now()
    let httpStatus = null

    markAttempt('crypto')
    try {
      const response = await fetch(endpoint, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: {
          accept: 'application/json',
          ...(env.cryptoProvider.apiKey
            ? { authorization: `Bearer ${env.cryptoProvider.apiKey}` }
            : {}),
        },
      })
      httpStatus = response.status
      if (!response.ok) throw new Error(`Crypto provider HTTP ${response.status}`)

      const quotes = parseQuotes(await response.json())
      if (quotes.length === 0) throw new Error('Crypto provider returned no usable quotes')

      const responseTimeMs = Math.round(performance.now() - started)
      await recordApiUsage({
        provider: 'crypto',
        endpoint: `GET ${env.cryptoProvider.url}/quotes`,
        success: true,
        httpStatus,
        responseTimeMs,
      })
      markSuccess('crypto')

      // Persist so /api/markets/crypto can serve from the DB cache next time.
      const prisma = await getPrisma()
      for (const quote of quotes) {
        const market = await prisma.market.findUnique({
          where: { provider_symbol: { provider: 'crypto', symbol: quote.symbol } },
        })
        if (!market || !market.active) continue
        await prisma.marketPrice.create({
          data: {
            marketId: market.id,
            provider: 'crypto',
            price: quote.price,
            bid: quote.bid,
            ask: quote.ask,
          },
        })
      }

      cache.lastFetchAt = new Date()
      return { cached: false, quotes }
    } catch (error) {
      const responseTimeMs = Math.round(performance.now() - started)
      await recordApiUsage({
        provider: 'crypto',
        endpoint: `GET ${env.cryptoProvider.url}/quotes`,
        success: false,
        httpStatus,
        responseTimeMs,
        error: error.message,
      })
      markFailure('crypto', error)
      logger.warn(`Crypto provider fetch failed: ${error.message}`)
      throw error
    } finally {
      cache.inFlight = null
    }
  })()

  return cache.inFlight
}
