import PerformanceChart from './PerformanceChart.jsx'

// Detail chart. Plots only real prices accumulated from the live API —
// until there are at least two points it shows an honest empty state
// instead of a fabricated curve.
export default function PriceChart({ series = [], range = '1D' }) {
  if (series.length < 2) {
    return (
      <div className="invchart">
        <p>
          {range} chart renders automatically once live prices stream in from
          the market API.
        </p>
      </div>
    )
  }

  return <PerformanceChart series={series} />
}
