import { useMemo, useState } from 'react'
import BottomNavigation from '../components/BottomNavigation.jsx'
import MobileHeader from '../components/MobileHeader.jsx'
import InvestmentHero from '../components/InvestmentHero.jsx'
import AssetTabs from '../components/AssetTabs.jsx'
import AssetSearch from '../components/AssetSearch.jsx'
import AssetList from '../components/AssetList.jsx'
import AssetDetail from '../components/AssetDetail.jsx'
import useMarketQuotes from '../hooks/useMarketQuotes.js'
import { cryptoAssets } from '../data/cryptoAssets.js'
import { navItemsFor } from '../data/dashboardData.js'
import '../dashboard.css'
import './Markets.css'
import './Investment.css'

// Static universe (metadata only). Every crypto quote is INR-denominated
// (quoteCurrency INR in src/data/cryptoAssets.js) — no conversion needed.
const symbols = cryptoAssets.map((asset) => asset.apiSymbol)

const TOP_10 = ['BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'USDC', 'DOGE', 'TRX', 'ADA']
const DEFI = ['UNI', 'HYPE', 'LINK']
const MEME = ['DOGE', 'SHIB']
const LAYER_1 = [
  'BTC', 'ETH', 'SOL', 'XRP', 'TRX', 'ADA', 'AVAX', 'SUI', 'HBAR',
  'TON', 'DOT', 'LTC', 'BCH', 'XMR', 'ZEC', 'ATOM', 'HYPE',
]

const CATEGORIES = [
  { id: 'all', label: 'All Coins', match: () => true },
  { id: 'top10', label: 'Top 10', match: (asset) => TOP_10.includes(asset.symbol) },
  { id: 'defi', label: 'DeFi', match: (asset) => DEFI.includes(asset.symbol) },
  { id: 'meme', label: 'Meme', match: (asset) => MEME.includes(asset.symbol) },
  { id: 'l1', label: 'Layer 1', match: (asset) => LAYER_1.includes(asset.symbol) },
]

const FEATURES = ['Global Access', 'Real-time Prices', 'Secure Trading']

export default function CryptoInvestment({ onNavigate }) {
  const [category, setCategory] = useState('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const { quotes, history } = useMarketQuotes(symbols)

  const visibleAssets = useMemo(() => {
    const active = CATEGORIES.find((item) => item.id === category) ?? CATEGORIES[0]
    const q = query.trim().toLowerCase()
    return cryptoAssets.filter((asset) => {
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
            market="crypto"
            asset={selected}
            quote={quotes[selected.apiSymbol]}
            spark={history[selected.apiSymbol] ?? []}
            onBack={closeDetail}
          />
        ) : (
          <>
            <InvestmentHero
              title="Crypto Investment"
              description="Invest in top cryptocurrencies and grow your wealth with XPO."
              features={FEATURES}
            />

            <AssetTabs
              options={CATEGORIES}
              active={category}
              onChange={setCategory}
              label="Crypto categories"
            />

            <AssetSearch
              value={query}
              onChange={setQuery}
              placeholder="Search by cryptocurrency name or symbol"
              label="Search cryptocurrencies"
            />

            <AssetList
              assets={visibleAssets}
              quotes={quotes}
              history={history}
              onSelect={openDetail}
              query={query.trim()}
              label="Crypto assets"
            />
          </>
        )}
      </main>

      <BottomNavigation items={navItemsFor('markets')} onSelect={onNavigate} />
    </div>
  )
}
