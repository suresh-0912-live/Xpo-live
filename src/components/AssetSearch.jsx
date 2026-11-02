import { Search } from './Icons.jsx'

// Search box using the existing .msearch markup from the Markets page.
export default function AssetSearch({ value, onChange, placeholder, label }) {
  return (
    <div className="msearch">
      <div className="msearch__box">
        <span className="msearch__icon" aria-hidden="true">
          <Search />
        </span>
        <input
          className="msearch__input"
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          aria-label={label}
        />
      </div>
    </div>
  )
}
