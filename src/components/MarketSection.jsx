import MarketCard from './MarketCard.jsx'
import SectionHeader from './SectionHeader.jsx'
import useMarketQuotes from '../hooks/useMarketQuotes.js'
import { formatPrice, changeLabel } from '../utils/marketFormat.js'

// Provider symbols for the Top Markets cards (module-level so the quote
// hook's effect does not re-subscribe on every render). Every pair is
// quoted against the Indian Rupee.
const QUOTE_SYMBOLS = ['BTC', 'ETH', 'EURINR', 'XAUINR']

// Live-quote overlay: cards show the provider's price when the quote layer
// has one and the '—' placeholder otherwise — the static card values are
// never displayed. Forex quotes stay plain (91.2345); crypto/commodity get '₹'.
function withQuote(market, quotes, history) {
  const quote = market.apiSymbol ? quotes[market.apiSymbol] : null
  if (!quote) return { ...market, price: '—', change: '—', spark: [] }
  const series = history[market.apiSymbol] ?? []
  return {
    ...market,
    price: `${market.category === 'Forex' ? '' : '₹'}${formatPrice(quote.price)}`,
    change: changeLabel(quote),
    up: quote.up !== false,
    spark: series.length >= 2 ? series : [],
  }
}

export default function MarketSection({ title = 'Top Markets', markets, onNavigate }) {
  const { quotes, history } = useMarketQuotes(QUOTE_SYMBOLS)
  return (
    <section>
      <SectionHeader
        title={title}
        onViewAll={onNavigate ? () => onNavigate('markets') : undefined}
      />
      <div className="rail">
        {markets.map((market) => (
          <MarketCard key={market.id} {...withQuote(market, quotes, history)} />
        ))}
      </div>
    </section>
  )
}