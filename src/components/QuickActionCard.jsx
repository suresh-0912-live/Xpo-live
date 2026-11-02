import { UiIcon } from './Icons.jsx'

export default function QuickActionCard({ label, icon, primary = false, onClick }) {
  return (
    <button
      type="button"
      className={`qac${primary ? ' qac--primary' : ''}`}
      onClick={onClick}
    >
      <span className="qac__ico" aria-hidden="true">
        <UiIcon name={icon} size={17} />
      </span>
      {label}
    </button>
  )
}