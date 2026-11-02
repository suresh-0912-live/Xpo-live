import { CoinIcon } from './Icons.jsx'

export default function IndexCard({
  name,
  return: ret,
  risk,
  riskLevel,
  icons,
  onClick,
}) {
  // '—' = no index-performance source yet: render neutral, never a fake %.
  const hasReturn = Boolean(ret) && ret !== '—'

  return (
    <article className="icard">
      <div className="icard__icons">
        {icons.map((icon) => (
          <span className="ibadge" key={icon} aria-hidden="true">
            <CoinIcon name={icon} size={13} />
          </span>
        ))}
      </div>

      <p className="icard__name">{name}</p>

      <p className={hasReturn ? 'icard__ret pos' : 'icard__ret'}>
        {ret} <span className="icard__retlabel">1Y Return</span>
      </p>

      <span className={`risk risk--${riskLevel}`}>{risk}</span>

      <button type="button" className="icard__cta" onClick={onClick}>
        Invest Now
      </button>
    </article>
  )
}