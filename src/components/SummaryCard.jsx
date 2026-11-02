import { UiIcon } from './Icons.jsx'

export default function SummaryCard({ icon, label, value, change, tone = 'neutral' }) {
  const isPositive = tone === 'pos'

  return (
    <article className="scard">
      <span
        className={`scard__ico${isPositive ? ' scard__ico--pos' : ''}`}
        aria-hidden="true"
      >
        <UiIcon name={icon} size={13} />
      </span>
      <p className="scard__label">{label}</p>
      <p className="scard__value">{value}</p>
      {change && (
        <p className={`scard__pct${isPositive ? ' pos' : ' neg'}`}>{change}</p>
      )}
    </article>
  )
}