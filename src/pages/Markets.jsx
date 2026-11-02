import { useEffect, useMemo, useState } from 'react'
import { Search, Sliders } from '../components/Icons.jsx'
import BottomNavigation from '../components/BottomNavigation.jsx'
import MarketCard from '../components/MarketCard.jsx'
import MarketTable from '../components/MarketTable.jsx'
import MobileHeader from '../components/MobileHeader.jsx'
import AssetDetail from '../components/AssetDetail.jsx'
import { fetchMarketData, getRefreshInterval } from '../api/marketApi.js'
import { cryptoAssets } from '../data/cryptoAssets.js'
import { forexAssets } from '../data/forexAssets.js'
import { featuredMarkets, marketsNavItems } from '../data/marketsData.js'
import '../dashboard.css'
import './Markets.css'
import './Investment.css'

// Static asset universe (metadata only — no prices live here).
const assets = [...cryptoAssets, ...forexAssets]
// Table symbols plus the featured cards' symbols (XAUINR for the Gold card)
// so a detail view can show a live quote whenever the provider has one.
const assetSymbols = [
  ...new Set([
    ...assets.map((asset) => asset.apiSymbol),
    ...featuredMarkets.map((market) => market.apiSymbol),
  ]),
]
const categories = ['All', ...new Set(assets.map((asset) => asset.category))]

// Map a display entry (table rows and featured cards only carry display
// fields) back to its full static asset — AssetDetail needs apiSymbol and
// quoteCurrency. The Gold card has no table asset, so the featured entry
// itself is the fallback.
function resolveAsset(entry) {
  const key = entry.apiSymbol ?? entry.id
  return assets.find((asset) => asset.apiSymbol === key) ?? entry
}

// Formats a live price the same way the static data does
// (91.2345 / 149.23 / 3456.78).
function formatPrice(price) {
  if (price >= 1000) return price.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  if (price >= 100) return price.toFixed(2)
  if (price >= 10) return price.toFixed(3)
  return price.toFixed(4)
}

function formatChange(percent) {
  const rounded = Math.round(percent * 100) / 100
  return `${rounded >= 0 ? '+' : ''}${rounded.toFixed(2)}%`
}

function displayPrice(asset, quote) {
  if (!quote) return '—' // no valid data yet — never a fabricated 0
  const value = formatPrice(quote.price)
  // Forex rows stay plain (91.2345); crypto/commodity show "₹56,23,421.00".
  return asset.category === 'Forex' ? value : `₹${value}`
}

function isUsablePrice(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

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

export default function Markets({ onNavigate }) {
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [quotes, setQuotes] = useState({})
  const [history, setHistory] = useState({})
  const [selected, setSelected] = useState(null)

  // Fetch on mount and every VITE_MARKET_REFRESH_INTERVAL ms (default 80s).
  // A failed fetch resolves to `null`, so the last valid quotes — including
  // their direction — are left untouched.
  useEffect(() => {
    let active = true

    const load = async () => {
      const data = await fetchMarketData(assetSymbols)
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
  }, [])

  const displayMarkets = useMemo(
    () =>
      assets.map((asset) => {
        const quote = quotes[asset.apiSymbol]
        return {
          id: asset.apiSymbol,
          symbol: asset.symbol,
          name: asset.name,
          category: asset.category,
          icon: asset.icon,
          price: displayPrice(asset, quote),
          change:
            quote && Number.isFinite(quote.changePercent)
              ? formatChange(quote.changePercent)
              : '—',
          up: quote ? quote.up : true,
          spark: history[asset.apiSymbol] ?? [],
        }
      }),
    [quotes, history],
  )

  // Featured cards overlay live quotes when we have them; otherwise the
  // existing placeholder entries stay untouched (silent fallback, no UI change).
  const displayFeatured = useMemo(
    () =>
      featuredMarkets.map((market) => {
        const quote = quotes[market.apiSymbol]
        if (!quote) return market
        const series = history[market.apiSymbol] ?? []
        return {
          ...market,
          price:
            market.category === 'Forex'
              ? formatPrice(quote.price)
              : `₹${formatPrice(quote.price)}`,
          change: Number.isFinite(quote.changePercent)
            ? formatChange(quote.changePercent)
            : market.change,
          up: quote.up,
          spark: series.length >= 2 ? series : market.spark,
        }
      }),
    [quotes, history],
  )

  const visibleMarkets = useMemo(() => {
    const q = query.trim().toLowerCase()
    return displayMarkets.filter((market) => {
      const inCategory = category === 'All' || market.category === category
      if (!inCategory) return false
      if (!q) return true
      return (
        market.id.toLowerCase().includes(q) ||
        market.symbol.toLowerCase().includes(q) ||
        market.name.toLowerCase().includes(q) ||
        market.category.toLowerCase().includes(q)
      )
    })
  }, [category, query, displayMarkets])

  // Detail view (same pattern as the investment pages): opens the shared
  // AssetDetail for the tapped row or featured card.
  function openDetail(asset) {
    setSelected(asset)
    window.scrollTo({ top: 0 })
  }

  function closeDetail() {
    setSelected(null)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="mk">
      <MobileHeader showSearch />

      <main className="mk__body">
        {selected ? (
          <AssetDetail
            market={
              selected.category === 'Forex'
                ? 'forex'
                : selected.category.toLowerCase()
            }
            asset={selected}
            quote={quotes[selected.apiSymbol]}
            spark={history[selected.apiSymbol] ?? []}
            onBack={closeDetail}
          />
        ) : (
          <>
            <section className="mk__head">
              <h1 className="mk__title">Markets</h1>
              <p className="mk__sub">Explore global markets and track live prices</p>
            </section>

            <div
              className="rail mk__tabs"
              role="group"
              aria-label="Market categories"
            >
              {categories.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`tab${item === category ? ' tab--on' : ''}`}
                  aria-pressed={item === category}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            <section aria-label="Featured markets">
              <div className="rail rail--featured">
                {displayFeatured.map((market) => (
                  <MarketCard
                    key={market.id}
                    {...market}
                    onSelect={() => openDetail(resolveAsset(market))}
                  />
                ))}
              </div>
            </section>

            <div className="msearch">
              <div className="msearch__box">
                <span className="msearch__icon" aria-hidden="true">
                  <Search />
                </span>
                <input
                  className="msearch__input"
                  type="text"
                  placeholder="Search assets, pairs, or markets..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Search assets, pairs, or markets"
                />
              </div>
              <button
                type="button"
                className="msearch__filter"
                aria-label="Reset filters"
                onClick={() => {
                  setCategory('All')
                  setQuery('')
                }}
              >
                <Sliders />
              </button>
            </div>

            <MarketTable
              markets={visibleMarkets}
              query={query.trim()}
              onSelect={(entry) => openDetail(resolveAsset(entry))}
            />
          </>
        )}
      </main>

      <BottomNavigation items={marketsNavItems} onSelect={onNavigate} />
    </div>
  )
}