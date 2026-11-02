// API-ready market data layer for the XPO Markets page.
//
// The real market data provider is NOT connected yet. This module only defines
// the request + normalization contract — no prices are generated, simulated,
// or faked here (no Math.random, no synthetic ticks). To connect a provider,
// set VITE_MARKET_API_URL (or replace the fetch/normalization below); the UI
// needs no changes.

const API_BASE = import.meta.env.VITE_MARKET_API_URL || ''
const DEFAULT_REFRESH_INTERVAL = 80000 // ms

// Poll interval for the Markets page; override with VITE_MARKET_REFRESH_INTERVAL.
export function getRefreshInterval() {
  const configured = Number(import.meta.env.VITE_MARKET_REFRESH_INTERVAL)
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_REFRESH_INTERVAL
}

function toFiniteNumber(value) {
  const num =
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof num === 'number' && Number.isFinite(num) ? num : null
}

// Normalizes one raw provider entry to:
//   { symbol, price, change, changePercent, open, high, low, volume,
//     marketCap, timestamp }
// Returns null when there is no usable price (missing, 0, or invalid), so
// invalid data never reaches the UI.
function normalizeQuote(raw, fallbackSymbol) {
  if (!raw || typeof raw !== 'object') return null

  const symbol = String(raw.symbol ?? raw.pair ?? fallbackSymbol ?? '')
    .replace('/', '')
    .toUpperCase()
  const price = toFiniteNumber(raw.price ?? raw.last ?? raw.close)
  if (!symbol || price === null || price <= 0) return null

  return {
    symbol,
    price,
    change: toFiniteNumber(raw.change),
    changePercent: toFiniteNumber(
      raw.changePercent ?? raw.change_percent ?? raw.percentChange,
    ),
    high: toFiniteNumber(raw.high),
    low: toFiniteNumber(raw.low),
    volume: toFiniteNumber(raw.volume),
    // Optional detail stats — absent until the provider sends them.
    open: toFiniteNumber(raw.open),
    marketCap: toFiniteNumber(raw.marketCap ?? raw.market_cap),
    // Receipt time when the provider omits its own timestamp.
    timestamp: toFiniteNumber(raw.timestamp) ?? Date.now(),
  }
}

// Accepts a bare array, { data: [...] }, or a { [symbol]: quote } map.
function extractEntries(payload) {
  if (Array.isArray(payload)) return payload.map((row) => [null, row])
  if (Array.isArray(payload?.data)) return payload.data.map((row) => [null, row])
  if (payload && typeof payload === 'object') {
    const quotes = payload.quotes && typeof payload.quotes === 'object'
      ? payload.quotes
      : payload
    return Object.entries(quotes).map(([symbol, row]) => [symbol, row])
  }
  return []
}

// Fetches live quotes for the given provider symbols.
// Resolves to an array of normalized quotes, or `null` when the provider is
// not configured, the request fails, or nothing valid came back — callers
// must treat `null` as "keep your last valid data".
export async function fetchMarketData(symbols = []) {
  if (!API_BASE) return null // provider not connected yet

  try {
    const separator = API_BASE.includes('?') ? '&' : '?'
    const query = symbols.length
      ? `symbols=${encodeURIComponent(symbols.join(','))}`
      : ''
    const response = await fetch(query ? `${API_BASE}${separator}${query}` : API_BASE, {
      headers: { accept: 'application/json' },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const wanted = symbols.length > 0 ? new Set(symbols) : null
    const quotes = extractEntries(await response.json())
      .map(([symbol, raw]) => normalizeQuote(raw, symbol))
      .filter(Boolean)
      .filter((quote) => !wanted || wanted.has(quote.symbol))

    return quotes.length > 0 ? quotes : null
  } catch {
    return null
  }
}