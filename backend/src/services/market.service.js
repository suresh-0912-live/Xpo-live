import { getPrisma } from '../config/prisma.js'

// Persist provider quotes as the cache of record. Missing symbols are
// simply skipped — valid data is never replaced with fake/null values.

export async function saveQuotes(provider, quotes, fetchedAt = new Date()) {
  const prisma = await getPrisma()
  let saved = 0

  for (const quote of quotes) {
    const market = await prisma.market.findUnique({
      where: { provider_symbol: { provider, symbol: quote.symbol } },
    })
    if (!market || !market.active) continue

    await prisma.marketPrice.create({
      data: {
        marketId: market.id,
        provider,
        price: quote.price,
        bid: quote.bid ?? null,
        ask: quote.ask ?? null,
        fetchedAt,
      },
    })
    saved += 1
  }
  return saved
}

// Latest price for each active market of a provider.
export async function getLatestPrices(provider) {
  const prisma = await getPrisma()
  const markets = await prisma.market.findMany({
    where: { provider, active: true },
    orderBy: { symbol: 'asc' },
  })

  const rows = []
  for (const market of markets) {
    const latest = await prisma.marketPrice.findFirst({
      where: { marketId: market.id },
      orderBy: { fetchedAt: 'desc' },
    })
    rows.push({ market, latest })
  }
  return rows
}

// Day change: baseline is today's first price, or the last price before
// today when the market only has older data. null when no baseline exists.
async function getChangeBaseline(marketId, dayStart) {
  const prisma = await getPrisma()
  const firstToday = await prisma.marketPrice.findFirst({
    where: { marketId, fetchedAt: { gte: dayStart } },
    orderBy: { fetchedAt: 'asc' },
  })
  if (firstToday) return firstToday
  return prisma.marketPrice.findFirst({
    where: { marketId, fetchedAt: { lt: dayStart } },
    orderBy: { fetchedAt: 'desc' },
  })
}

function round(value, digits) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

// Shape one cached market row for API responses.
export async function toQuote(row, now = new Date()) {
  const { market, latest } = row
  if (!latest) {
    return {
      symbol: market.symbol,
      pair: market.pair,
      name: market.name,
      price: null,
      bid: null,
      ask: null,
      changePercent: null,
      fetchedAt: null,
    }
  }

  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  const baseline = await getChangeBaseline(market.id, dayStart)
  let changePercent = null
  if (baseline && baseline.price > 0 && baseline.id !== latest.id) {
    changePercent = round(((latest.price - baseline.price) / baseline.price) * 100, 4)
  }

  return {
    symbol: market.symbol,
    pair: market.pair,
    name: market.name,
    price: round(latest.price, 6),
    bid: latest.bid === null ? null : round(latest.bid, 6),
    ask: latest.ask === null ? null : round(latest.ask, 6),
    changePercent,
    fetchedAt: latest.fetchedAt,
  }
}

// Most recent successful update across all providers (dashboard "last
// market update").
export async function getLastMarketUpdate() {
  const prisma = await getPrisma()
  const latest = await prisma.marketPrice.findFirst({ orderBy: { fetchedAt: 'desc' } })
  return latest ? latest.fetchedAt : null
}
