export default function TimeFilter({ options, active, onChange }) {
  return (
    <div className="hero__filters" role="tablist" aria-label="Time range">
      {options.map((option) => {
        const selected = option === active
        return (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={selected}
            className={`tf${selected ? ' tf--on' : ''}`}
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}