import { SortArrows } from './Icons.jsx'
import MarketRow from './MarketRow.jsx'

// Market list. Rows are interactive buttons (see MarketRow), so the list is
// a plain grid rather than an ARIA table.
export default function MarketTable({ markets = [], query = '', onSelect }) {
  return (
    <div className="mtable">
      <div className="mtable__head">
        <span className="mtable__th mtable__th--asset">Asset</span>
        <span className="mtable__th mtable__th--price">
          Price
          <SortArrows />
        </span>
        <span className="mtable__th mtable__th--chg">
          24h Change
          <SortArrows />
        </span>
        <span className="mtable__th mtable__th--chart">Chart</span>
        <span className="mtable__th mtable__th--chev" aria-hidden="true" />
      </div>

      {markets.length > 0 ? (
        <div className="mtable__body">
          {markets.map((market) => (
            <MarketRow key={market.id} market={market} onSelect={onSelect} />
          ))}
        </div>
      ) : (
        <p className="mtable__empty">
          No markets match {query ? `“${query}”` : 'the current filters'}.
        </p>
      )}
    </div>
  )
}