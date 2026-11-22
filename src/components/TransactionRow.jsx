import { UiIcon } from './Icons.jsx'

export default function TransactionRow({ title, subtitle, amount, date, icon, tone }) {
  const sign = amount.startsWith('-') ? 'neg' : 'pos'

  return (
    <li className="row">
      <span className={`row__ico row__ico--${tone}`} aria-hidden="true">
        <UiIcon name={icon} size={15} />
      </span>

      <div className="row__body">
        <p className="row__name">{title}</p>
        <p className="row__sub">{subtitle}</p>
      </div>

      <div className="row__right">
        <p className={`row__value ${sign}`}>{amount}</p>
        <p className="row__sub">{date}</p>
      </div>
    </li>
  )
}