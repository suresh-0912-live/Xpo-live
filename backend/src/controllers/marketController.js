import { getLatestPrices, toQuote, getLastMarketUpdate } from '../services/market.service.js'
import { getStatus } from '../services/status.service.js'
import { isCryptoConfigured, getFreshCryptoQuotes } from '../services/cryptoProvider.service.js'
import ApiError from '../utils/ApiError.js'
import asyncHandler from '../utils/asyncHandler.js'

// GET /api/markets/forex — served from the DB cache populated by the
// scheduler. Never calls the provider (users cannot consume API quota).
export const getForex = asyncHandler(async (req, res) => {
  const rows = await getLatestPrices('forex')
  const now = new Date()
  const data = []
  for (const row of rows) data.push(await toQuote(row, now))

  res.json({
    provider: 'forex',
    source: 'cache',
    updatedAt: await getLastMarketUpdate(),
    data,
  })
})

// GET /api/markets/crypto — 503 until a crypto provider is configured.
// Never returns fake prices.
export const getCrypto = asyncHandler(async (req, res) => {
  if (!isCryptoConfigured()) {
    throw ApiError.serviceUnavailable('Crypto service is not available yet', {
      code: 'crypto_service_unavailable',
    })
  }

  // Throttled provider refresh (shared cache) — on failure fall back to
  // the last valid cached data.
  try {
    await getFreshCryptoQuotes()
  } catch (error) {
    const rows = await getLatestPrices('crypto')
    const hasCache = rows.some((row) => row.latest)
    if (!hasCache) throw error
  }

  const rows = await getLatestPrices('crypto')
  const now = new Date()
  const data = []
  for (const row of rows) data.push(await toQuote(row, now))

  res.json({
    provider: 'crypto',
    source: 'cache',
    updatedAt: await getLastMarketUpdate(),
    data,
  })
})

// GET /api/markets/status — providers, usage, backend and database status.
export const getStatusRoute = asyncHandler(async (req, res) => {
  res.json(await getStatus())
})
