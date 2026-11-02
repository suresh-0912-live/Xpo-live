const W = 100
const H = 28

export default function Sparkline({ data = [], up = true }) {
  if (data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const step = W / (data.length - 1)

  const points = data.map((value, i) => {
    const x = i * step
    const y = H - 3 - ((value - min) / span) * (H - 6)
    return [x, y]
  })

  const line = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ')

  const area = `${line} L${W} ${H} L0 ${H} Z`

  return (
    <svg
      className="spark"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={area}
        fill={up ? 'rgba(0, 229, 160, 0.12)' : 'rgba(255, 59, 92, 0.12)'}
      />
      <path
        className={up ? 'spark-pos' : 'spark-neg'}
        d={line}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}