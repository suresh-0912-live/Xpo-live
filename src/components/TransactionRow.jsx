import { UiIcon } from './Icons.jsx'

export default function TransactionRow({ title, subtitle, amount, date, icon, tone, status }) {
  const statusLabel = status ? status.charAt(0).toUpperCase() + status.slice(1) : ''

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
        <p className={`row__value ${tone}`}>{amount}</p>
        {statusLabel && (
          <p className={`row__sub row__sub--status row__sub--${tone}`}>{statusLabel}</p>
        )}
        <p className="row__sub">{date}</p>
      </div>
    </li>
  )
}