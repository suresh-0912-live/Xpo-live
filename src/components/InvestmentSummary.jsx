// Computed rows + primary CTA for the investment sections (Crypto & Forex).
// Every value is passed in already formatted; missing data stays '—'.
export default function InvestmentSummary({ rows = [], cta }) {
  return (
    <div className="sum">
      <dl className="sum__rows">
        {rows.map((row) => (
          <div className="sum__row" key={row.label}>
            <dt className="sum__label">{row.label}</dt>
            <dd className="sum__value">
              {row.value}
              {row.sub ? <span className="sum__sub">{row.sub}</span> : null}
            </dd>
          </div>
        ))}
      </dl>

      <button
        type="button"
        className="sum__cta"
        disabled={Boolean(cta?.disabled)}
        onClick={cta?.onClick}
      >
        {cta?.label}
      </button>

      {cta?.note ? <p className="sum__note">{cta.note}</p> : null}
    </div>
  )
}
