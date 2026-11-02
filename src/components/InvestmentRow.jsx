import { ChevronRight, CoinIcon, TrendUp } from './Icons.jsx'

export default function InvestmentRow({ name, icon, value, change, up = true }) {
  // '—' (no return data) stays neutral instead of being painted red/green.
  const flat = !change || change === '—'

  return (
    <li className="row">
      <span className="row__ico row__ico--blue" aria-hidden="true">
        <CoinIcon name={icon} size={16} />
      </span>

      <div className="row__body">
        <p className="row__name">{name}</p>
      </div>

      <div className="row__right">
        <p className="row__value">{value}</p>
        <p className={flat ? 'row__chg' : `row__chg ${up ? 'pos' : 'neg'}`}>
          {!flat && up && <TrendUp />}
          {change}
        </p>
      </div>

      <span className="row__chev" aria-hidden="true">
        <ChevronRight />
      </span>
    </li>
  )
}