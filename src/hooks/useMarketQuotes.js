import { useEffect, useState } from 'react'
import { fetchMarketData, getRefreshInterval } from '../api/marketApi.js'
import { isUsablePrice } from '../utils/marketFormat.js'

// First-ever quote: trust the provider's own change fields; neutral (up)
// when it sent none.
function firstDirection(quote) {
  const source = Number.isFinite(quote.changePercent)
    ? quote.changePercent
    : quote.change
  return Number.isFinite(source) ? source >= 0 : true
}

// Up when the new API price is higher than the previous one, down when
// lower, previous direction when unchanged.
function directionFor(previous, quote) {
  if (!previous) return firstDirection(quote)
  if (quote.price > previous.price) return true
  if (quote.price < previous.price) return false
  return previous.up
}

// Live-quote store shared by the Crypto and Forex investment pages.
// Mirrors the Markets page contract: fetch on mount + every refresh tick,
// a `null` API result keeps the last valid data, invalid prices are never
// stored, and every accepted price is appended to a short history that
// feeds the detail chart once it has enough points.
//
// NOTE: pass a stable (module-level) `symbols` array — the effect keys on it.
export default function useMarketQuotes(symbols) {
  const [quotes, setQuotes] = useState({})
  const [history, setHistory] = useState({})

  useEffect(() => {
    let active = true

    const load = async () => {
      const data = await fetchMarketData(symbols)
      if (!active || !Array.isArray(data)) return

      setQuotes((prev) => {
        const next = { ...prev }
        for (const quote of data) {
          if (!isUsablePrice(quote.price)) continue // never store 0/invalid
          const previous = prev[quote.symbol]
          next[quote.symbol] = { ...quote, up: directionFor(previous, quote) }
        }
        return next
      })

      setHistory((prev) => {
        const next = { ...prev }
        for (const quote of data) {
          if (!isUsablePrice(quote.price)) continue
          next[quote.symbol] = [...(prev[quote.symbol] ?? []), quote.price].slice(-40)
        }
        return next
      })
    }

    load()
    const timer = setInterval(load, getRefreshInterval())
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [symbols])

  return { quotes, history }
}
