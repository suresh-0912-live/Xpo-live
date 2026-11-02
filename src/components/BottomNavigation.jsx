import { NavIcon } from './Icons.jsx'

export default function BottomNavigation({ items, onSelect }) {
  return (
    <nav className="nav" aria-label="Primary">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`nav__item${item.active ? ' nav__item--on' : ''}`}
          aria-current={item.active ? 'page' : undefined}
          onClick={() => onSelect?.(item.id)}
        >
          <span className="nav__ico" aria-hidden="true">
            <NavIcon name={item.icon} />
          </span>
          {item.label}
        </button>
      ))}
    </nav>
  )
}