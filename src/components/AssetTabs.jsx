// Category pills (Crypto: All Coins / Top 10 / ... · Forex: All Pairs / ...).
// Same rail + .tab pattern the Markets page uses.
export default function AssetTabs({ options = [], active, onChange, label = 'Categories' }) {
  return (
    <div className="rail mk__tabs" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={`tab${option.id === active ? ' tab--on' : ''}`}
          aria-pressed={option.id === active}
          onClick={() => onChange?.(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
