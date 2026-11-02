import { CoinIcon } from './Icons.jsx'

const W = 116
const H = 26

function points(values) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const step = W / (values.length - 1)
  return values
    .map((value, i) => {
      const x = i * step
      const y = H - 3 - ((value - min) / span) * (H - 6)
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

export default function MarketCard({
  symbol,
  name,
  icon,
  price,
  change,
  up,
  spark,
  onSelect,
}) {
  // Live-data guards: no sparkline until there are ≥2 real points, and a
  // neutral (uncoloured) change for the '—' placeholder.
  const sparkPath = Array.isArray(spark) && spark.length >= 2 ? points(spark) : null
  const hasChange = Boolean(change) && change !== '—'

  // With an onSelect the card renders as a button (Markets featured cards
  // open the asset detail); without one it stays a plain article (home rail).
  const interactive = typeof onSelect === 'function'
  const Tag = interactive ? 'button' : 'article'

  return (
    <Tag
      className={interactive ? 'mcard mcard--btn' : 'mcard'}
      {...(interactive ? { type: 'button', onClick: onSelect } : {})}
    >
      <div className="mcard__top">
        <span className="ibadge ibadge--sm" aria-hidden="true">
          <CoinIcon name={icon} size={14} />
        </span>
        <div>
          <p className="mcard__sym">{symbol}</p>
          <p className="mcard__pair">{name}</p>
        </div>
      </div>

      {sparkPath && (
        <svg
          className="mcard__spark"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path className={up ? 'spark-pos' : 'spark-neg'} d={sparkPath} />
        </svg>
      )}

      <p className="mcard__price">{price ?? '—'}</p>
      <p className={hasChange ? `mcard__chg ${up ? 'pos' : 'neg'}` : 'mcard__chg'}>
        {change ?? '—'}
      </p>
    </Tag>
  )
}