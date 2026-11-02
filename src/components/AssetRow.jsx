import { ChevronRight, CoinIcon, TrendDown, TrendUp } from './Icons.jsx'
import Sparkline from './Sparkline.jsx'
import { coinColor } from '../data/coinIcons.js'
import {
  changeLabel,
  hexTint,
  priceLabel,
} from '../utils/marketFormat.js'

// One asset row: icon · symbol/name · live price · 24h change pill ·
// trend indicator (sparkline once history exists, direction arrow before
// that) · details chevron. Clicking opens the detail / investment view.
export default function AssetRow({ asset, quote, spark = [], onSelect }) {
  const color = coinColor(asset.icon)
  const up = quote ? quote.up : true

  return (
    <button
      type="button"
      className="mrow mrow--btn"
      onClick={() => onSelect?.(asset)}
      aria-label={`Open ${asset.name}`}
    >
      <span className="mrow__asset">
        <span
          className="mrow__ico"
          style={{
            color,
            background: hexTint(color, 0.14),
            borderColor: hexTint(color, 0.4),
          }}
        >
          <CoinIcon name={asset.icon} size={16} />
        </span>
        <span className="mrow__text">
          <span className="mrow__sym">{asset.symbol}</span>
          <span className="mrow__name">{asset.name}</span>
        </span>
      </span>

      <span className="mrow__price">{priceLabel(asset, quote)}</span>

      <span className="mrow__chgcell">
        <span className={`mrow__chg ${up ? 'pos' : 'neg'}`}>{changeLabel(quote)}</span>
      </span>

      <span className="mrow__chart">
        {spark.length >= 2 ? (
          <Sparkline data={spark} up={up} />
        ) : quote ? (
          <span className={`mrow__trend ${up ? 'pos' : 'neg'}`} aria-hidden="true">
            {up ? <TrendUp /> : <TrendDown />}
          </span>
        ) : null}
      </span>

      <span className="mrow__chev" aria-hidden="true">
        <ChevronRight />
      </span>
    </button>
  )
}
