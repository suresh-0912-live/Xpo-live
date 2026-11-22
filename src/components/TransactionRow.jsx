import { UiIcon } from './Icons.jsx'

const STATUS_TONE = {
  pending: 'pending',
  completed: 'completed',
  processing: 'processing',
  rejected: 'rejected',
  failed: 'failed',
}

export default function TransactionRow({ title, subtitle, amount, date, icon, tone, status, referenceNumber }) {
  const sign = amount.startsWith('-') ? 'neg' : 'pos'
  const statusTone = STATUS_TONE[status] || tone || 'pending'

  return (
    <li className="row">
      <span className={`row__ico row__ico--${statusTone}`} aria-hidden="true">
        <UiIcon name={icon} size={15} />
      </span>

      <div className="row__body">
        <p className="row__name">{title}</p>
        <p className="row__sub">{subtitle}{referenceNumber ? ` · #${referenceNumber}` : ''}</p>
      </div>

      <div className="row__right">
        <p className={`row__value ${sign}`}>{amount}</p>
        <p className="row__sub">{date}</p>
        <span className={`row__status row__status--${status}`}>{status}</span>
      </div>
    </li>
  )
}