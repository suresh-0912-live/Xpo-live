import { useMemo, useState } from 'react'
import BottomNavigation from '../components/BottomNavigation.jsx'
import MobileHeader from '../components/MobileHeader.jsx'
import InvestmentHero from '../components/InvestmentHero.jsx'
import AssetTabs from '../components/AssetTabs.jsx'
import AssetSearch from '../components/AssetSearch.jsx'
import AssetList from '../components/AssetList.jsx'
import AssetDetail from '../components/AssetDetail.jsx'
import useMarketQuotes from '../hooks/useMarketQuotes.js'
import { forexAssets, indianForexAssets } from '../data/forexAssets.js'
import { navItemsFor } from '../data/dashboardData.js'
import '../dashboard.css'
import './Markets.css'
import './Investment.css'

// Static universe (metadata only); live quotes come from the shared layer.
// Every pair is quoted against the Indian Rupee.
const symbols = forexAssets.map((asset) => asset.apiSymbol)

const INR_SYMBOLS = new Set(indianForexAssets.map((asset) => asset.apiSymbol))

const CATEGORIES = [
  { id: 'all', label: 'All Pairs', match: () => true },
  { id: 'inr', label: 'INR Pairs', match: (asset) => INR_SYMBOLS.has(asset.apiSymbol) },
]

const FEATURES = ['Global Market Access', 'Low Spread', '24/7 Market Access']

export default function ForexInvestment({ onNavigate }) {
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const { quotes, history } = useMarketQuotes(symbols)

  const visibleAssets = useMemo(() => {
    const active = CATEGORIES.find((item) => item.id === category) ?? CATEGORIES[0]
    const q = query.trim().toLowerCase()
    return forexAssets.filter((asset) => {
      if (!active.match(asset)) return false
      if (!q) return true
      return (
        asset.name.toLowerCase().includes(q) ||
        asset.symbol.toLowerCase().includes(q) ||
        asset.apiSymbol.toLowerCase().includes(q)
      )
    })
  }, [category, query])

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
      <MobileHeader />

      <main className="mk__body">
        {selected ? (
          <AssetDetail
            market="forex"
            asset={selected}
            quote={quotes[selected.apiSymbol]}
            spark={history[selected.apiSymbol] ?? []}
            onBack={closeDetail}
          />
        ) : (
          <>
            <InvestmentHero
              title="Forex Investment"
              description="Access global currency markets and invest with XPO."
              features={FEATURES}
            />

            <AssetTabs
              options={CATEGORIES}
              active={category}
              onChange={setCategory}
              label="Forex categories"
            />

            <AssetSearch
              value={query}
              onChange={setQuery}
              placeholder="Search by pair or currency name"
              label="Search forex pairs"
            />

            <AssetList
              assets={visibleAssets}
              quotes={quotes}
              history={history}
              onSelect={openDetail}
              query={query.trim()}
              label="Forex pairs"
            />
          </>
        )}
      </main>

      <BottomNavigation items={navItemsFor('markets')} onSelect={onNavigate} />
    </div>
  )
}
