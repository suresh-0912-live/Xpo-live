const W = 358
const H = 92
const PAD_TOP = 12
const PAD_BOTTOM = 10

function buildPath(values) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const usableH = H - PAD_TOP - PAD_BOTTOM
  const step = W / (values.length - 1)

  const points = values.map((value, i) => {
    const x = i * step
    const y = PAD_TOP + usableH - ((value - min) / span) * usableH
    return [Number(x.toFixed(2)), Number(y.toFixed(2))]
  })

  const line = points
    .map(([x, y], i) => (i === 0 ? `M${x} ${y}` : `L${x} ${y}`))
    .join(' ')

  const area = `${line} L${W} ${H} L0 ${H} Z`

  return { line, area, last: points[points.length - 1] }
}

export default function PerformanceChart({ series = [] }) {
  if (series.length < 2) return null

  const { line, area, last } = buildPath(series)

  return (
    <svg
      className="chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0066ff" stopOpacity="0.38" />
          <stop offset="60%" stopColor="#2563eb" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
        </linearGradient>
        <filter id="chartGlow" x="-20%" y="-40%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g stroke="rgba(59,130,246,0.16)" strokeWidth="0.6">
        <line x1="0" y1={H * 0.3} x2={W} y2={H * 0.3} />
        <line x1="0" y1={H * 0.6} x2={W} y2={H * 0.6} />
      </g>

      <path d={area} fill="url(#chartFill)" />
      <path
        d={line}
        fill="none"
        stroke="#0066ff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#chartGlow)"
      />
      <circle cx={last[0]} cy={last[1]} r="3" fill="#00e5a0" />
      <circle
        cx={last[0]}
        cy={last[1]}
        r="6"
        fill="none"
        stroke="rgba(0,229,160,0.4)"
        strokeWidth="1"
      />
    </svg>
  )
}