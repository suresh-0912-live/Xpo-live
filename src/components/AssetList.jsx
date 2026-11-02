import AssetRow from './AssetRow.jsx'

// Asset table reusing the Markets page's .mtable/.mrow grid (same columns,
// same breakpoints). Rows are clickable and open the detail view.
export default function AssetList({
  assets = [],
  quotes = {},
  history = {},
  onSelect,
  query = '',
  label = 'Assets',
}) {
  return (
    <div className="mtable" role="table" aria-label={label}>
      <div className="mtable__head" role="row">
        <span className="mtable__th mtable__th--asset" role="columnheader">
          Asset
        </span>
        <span className="mtable__th mtable__th--price" role="columnheader">
          Price
        </span>
        <span className="mtable__th mtable__th--chg" role="columnheader">
          24h Change
        </span>
        <span className="mtable__th mtable__th--chart" role="columnheader">
          Trend
        </span>
        <span className="mtable__th mtable__th--chev" aria-hidden="true" />
      </div>

      {assets.length > 0 ? (
        <div className="mtable__body" role="rowgroup">
          {assets.map((asset) => (
            <AssetRow
              key={asset.apiSymbol}
              asset={asset}
              quote={quotes[asset.apiSymbol]}
              spark={history[asset.apiSymbol] ?? []}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <p className="mtable__empty">
          No assets match {query ? `“${query}”` : 'the current filters'}.
        </p>
      )}
    </div>
  )
}
