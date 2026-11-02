import { ChevronRight, CoinIcon } from './Icons.jsx'
import { coinColor } from '../data/coinIcons.js'
import Sparkline from './Sparkline.jsx'

function tint(hex, alpha) {
  const value = Number.parseInt(hex.slice(1), 16)
  if (Number.isNaN(value)) return 'rgba(37, 99, 235, 0.16)'
  const r = (value >> 16) & 255
  const g = (value >> 8) & 255
  const b = value & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// One market table row. A button (mirrors AssetRow) — clicking opens the
// asset's detail / investment view through onSelect.
export default function MarketRow({ market, onSelect }) {
  const { symbol, name, icon, price, change, up, spark } = market
  const color = coinColor(icon)

  return (
    <button
      type="button"
      className="mrow mrow--btn"
      onClick={() => onSelect?.(market)}
      aria-label={`Open ${name}`}
    >
      <span className="mrow__asset">
        <span
          className="mrow__ico"
          style={{
            color,
            background: tint(color, 0.14),
            borderColor: tint(color, 0.4),
          }}
        >
          <CoinIcon name={icon} size={16} />
        </span>
        <span className="mrow__text">
          <span className="mrow__sym">{symbol}</span>
          <span className="mrow__name">{name}</span>
        </span>
      </span>

      <span className="mrow__price">{price}</span>

      <span className="mrow__chgcell">
        <span className={`mrow__chg ${up ? 'pos' : 'neg'}`}>{change}</span>
      </span>

      <span className="mrow__chart">
        <Sparkline data={spark} up={up} />
      </span>

      <span className="mrow__chev" aria-hidden="true">
        <ChevronRight />
      </span>
    </button>
  )
}