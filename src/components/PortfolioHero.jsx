import { useState } from 'react'
import TimeFilter from './TimeFilter.jsx'
import PerformanceChart from './PerformanceChart.jsx'
import { ArrowUp, Eye, TrendDown } from './Icons.jsx'

// `portfolio.value` / `portfolio.change` come from the backend summary and
// fall back to '—' when account data is unavailable. The performance chart
// only draws when real series points are passed — there is no portfolio
// history source yet, so the chart stays hidden instead of showing a
// fabricated curve.
export default function PortfolioHero({ portfolio, series = {} }) {
  const [range, setRange] = useState(portfolio.activeFilter)
  const points = series[range] ?? []
  const hasChange = Boolean(portfolio.change) && portfolio.change !== '—'
  const negative = hasChange && portfolio.change.startsWith('-')
  const [whole, cents] = String(portfolio.value).split('.')

  return (
    <section className="hero">
      <p className="hero__label">
        {portfolio.label}
        <span className="muted">
          <Eye />
        </span>
      </p>

      <p className="hero__value">
        {cents === undefined ? (
          whole
        ) : (
          <>
            {whole}
            <span className="hero__cents">.{cents}</span>
          </>
        )}
      </p>

      <p className="hero__delta">
        {hasChange && (
          <span className={negative ? 'neg' : 'pos'}>
            {negative ? <TrendDown /> : <ArrowUp />}
          </span>
        )}
        <span className={hasChange ? (negative ? 'neg' : 'pos') : 'muted'}>
          {portfolio.change}
        </span>
        <span className="muted">· {portfolio.period}</span>
      </p>

      <TimeFilter
        options={portfolio.timeFilters}
        active={range}
        onChange={setRange}
      />

      <PerformanceChart series={points} />
    </section>
  )
}