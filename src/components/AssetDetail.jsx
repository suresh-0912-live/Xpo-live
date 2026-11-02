import { useState } from 'react'
import { ChevronLeft, CoinIcon, TrendDown, TrendUp } from './Icons.jsx'
import TimeFilter from './TimeFilter.jsx'
import PriceChart from './PriceChart.jsx'
import InvestmentForm from './InvestmentForm.jsx'
import { coinColor } from '../data/coinIcons.js'
import {
  formatChange,
  formatCompactInr,
  hexTint,
  isUsablePrice,
  priceLabel,
  statPrice,
} from '../utils/marketFormat.js'

const RANGES = ['1D', '1W', '1M', '3M', '1Y', 'All']

function previousClose(quote) {
  if (!quote || !isUsablePrice(quote.price) || !Number.isFinite(quote.change)) {
    return null
  }
  return quote.price - quote.change
}

// Detail / investment view for one crypto asset or forex pair: identity,
// live status, price + change, chart with range filters, key stats and the
// shared InvestmentForm. All values come from the live-quote store —
// anything the API hasn't sent renders as '—'.
export default function AssetDetail({
  market,
  asset,
  quote,
  spark = [],
  onBack,
}) {
  const [range, setRange] = useState('1D')

  const isForex = market === 'forex'
  const color = coinColor(asset.icon)
  const quoteColor = coinColor(String(asset.quoteCurrency ?? '').toLowerCase())
  const up = quote ? quote.up : true

  const statRows = [
    { label: 'Open', value: statPrice(asset, quote?.open) },
    { label: 'High', value: statPrice(asset, quote?.high) },
    { label: 'Low', value: statPrice(asset, quote?.low) },
    { label: 'Previous Close', value: statPrice(asset, previousClose(quote)) },
    isForex
      ? { label: '52W High', value: statPrice(asset, quote?.high) }
      : { label: '24h Volume', value: formatCompactInr(quote?.volume) },
    isForex
      ? { label: '52W Low', value: statPrice(asset, quote?.low) }
      : { label: 'Market Cap', value: formatCompactInr(quote?.marketCap) },
  ]

  const priceText = priceLabel(asset, quote)
  const [whole, cents] = priceText.split('.')
  const pct =
    quote && Number.isFinite(quote.changePercent)
      ? formatChange(quote.changePercent)
      : null

  return (
    <div className="det">
      <div className="det__bar">
        <button type="button" className="det__back" onClick={onBack}>
          <ChevronLeft />
          Back
        </button>
      </div>

      <section className="det__id">
        <span className="det__icons">
          <span
            className="det__ico"
            style={{
              color,
              background: hexTint(color, 0.14),
              borderColor: hexTint(color, 0.4),
            }}
          >
            <CoinIcon name={asset.icon} size={17} />
          </span>
          {isForex && (
            <span
              className="det__ico"
              style={{
                color: quoteColor,
                background: hexTint(quoteColor, 0.14),
                borderColor: hexTint(quoteColor, 0.4),
              }}
            >
              <CoinIcon name={String(asset.quoteCurrency).toLowerCase()} size={17} />
            </span>
          )}
        </span>

        <div className="det__text">
          <p className="det__sym">{asset.symbol}</p>
          <p className="det__name">{asset.name}</p>
        </div>

        <span className={`pill${quote ? ' pill--live' : ''}`}>
          {quote && <span className="pill__dot" aria-hidden="true" />}
          {quote ? 'Live' : 'No live data'}
        </span>
      </section>

      <section className="hero">
        <p className="hero__label">
          Current Price
          <span className="muted">· 24h</span>
        </p>

        <p className="hero__value">
          {whole}
          {cents !== undefined ? <span className="hero__cents">.{cents}</span> : null}
        </p>

        <p className="hero__delta">
          {pct ? (
            <>
              <span className={up ? 'pos' : 'neg'} aria-hidden="true">
                {up ? <TrendUp /> : <TrendDown />}
              </span>
              <span className={up ? 'pos' : 'neg'}>{pct}</span>
              <span className="muted">· 24h</span>
            </>
          ) : (
            <span className="muted">24h change not available yet</span>
          )}
        </p>

        <TimeFilter options={RANGES} active={range} onChange={setRange} />
        <PriceChart series={spark} range={range} />
      </section>

      <dl className="det__stats">
        {statRows.map((row) => (
          <div className="stat" key={row.label}>
            <dt className="stat__label">{row.label}</dt>
            <dd className="stat__value">{row.value}</dd>
          </div>
        ))}
      </dl>

      <InvestmentForm
        market={market}
        asset={asset}
        quote={quote}
      />
    </div>
  )
}
