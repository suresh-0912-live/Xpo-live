import { useState } from 'react'
import InvestmentSummary from './InvestmentSummary.jsx'
import {
  formatInr,
  formatQuantity,
  isUsablePrice,
  priceLabel,
} from '../utils/marketFormat.js'

const QUICK_AMOUNTS = [
  { label: '₹1K', value: 1000 },
  { label: '₹5K', value: 5000 },
  { label: '₹10K', value: 10000 },
  { label: '₹50K', value: 50000 },
]

const LEVERAGES = [1, 5, 10]

const INVEST_TYPES = [
  { id: 'spot', label: 'Spot' },
  { id: 'auto', label: 'Auto Invest' },
]

const TRADE_SIDES = [
  { id: 'buy', label: 'Buy' },
  { id: 'sell', label: 'Sell' },
]

const ORDER_NOTE =
  'Order placement activates once the live market API is connected — nothing was submitted.'

// Accepts digits and a single decimal point only.
function parseAmount(text) {
  if (!/^\d*\.?\d*$/.test(text)) return NaN
  const value = Number(text)
  return Number.isFinite(value) ? value : NaN
}

// Invest / Trade section shared by both detail pages.
//  - Crypto: ₹ amount → estimated coins at the CURRENT API price — quotes
//    are INR-denominated, so no conversion rate is involved.
//  - Forex: ₹ amount + UI-only leverage → required margin & position value.
export default function InvestmentForm({ market, asset, quote }) {
  const [tab, setTab] = useState('invest')
  const [type, setType] = useState('spot')
  const [side, setSide] = useState('buy')
  const [leverage, setLeverage] = useState(1)
  const [amountText, setAmountText] = useState('')
  const [note, setNote] = useState('')

  const isForex = market === 'forex'
  const amount = parseAmount(amountText.trim())
  const amountOk = isUsablePrice(amount)
  const price = quote && isUsablePrice(quote.price) ? quote.price : null

  function setAmount(next) {
    if (next === '' || /^\d*\.?\d*$/.test(next)) setAmountText(next)
    setNote('')
  }

  // ----- summary rows -----------------------------------------------------
  const rows = [{ label: 'Amount', value: formatInr(amountOk ? amount : null) }]

  if (isForex) {
    rows.push({ label: 'Leverage', value: `${leverage}x` })
    rows.push({
      label: 'Required Margin',
      value: formatInr(amountOk ? amount / leverage : null),
    })
    rows.push({
      label: 'Estimated Position Value',
      value: formatInr(amountOk ? amount : null),
    })
    rows.push({ label: 'Current Price', value: priceLabel(asset, quote) })
  } else {
    const priceInr = price // quotes are already in ₹ — no conversion
    rows.push({
      label: 'Current Price',
      value: priceLabel(asset, quote),
    })
    rows.push({
      label: tab === 'invest' ? 'Type' : 'Side',
      value:
        tab === 'invest'
          ? INVEST_TYPES.find((item) => item.id === type)?.label
          : TRADE_SIDES.find((item) => item.id === side)?.label,
    })
    const received = amountOk && priceInr !== null ? amount / priceInr : null
    rows.push({
      label: `Estimated ${asset.symbol} Received`,
      value: formatQuantity(received),
    })
  }

  // A live price is required to place either order type.
  const ready = amountOk && price !== null
  const subject = isForex ? asset.symbol : asset.name
  const ctaLabel =
    tab === 'invest'
      ? `Invest in ${subject}`
      : `${side === 'buy' ? 'Buy' : 'Sell'} ${subject}`

  return (
    <section className="form" aria-label="Investment">
      <div className="form__head">
        <h2 className="form__title">Investment</h2>
        <div className="form__tabs" role="group" aria-label="Investment mode">
          <button
            type="button"
            className={`tab${tab === 'invest' ? ' tab--on' : ''}`}
            aria-pressed={tab === 'invest'}
            onClick={() => {
              setTab('invest')
              setNote('')
            }}
          >
            Invest
          </button>
          <button
            type="button"
            className={`tab${tab === 'trade' ? ' tab--on' : ''}`}
            aria-pressed={tab === 'trade'}
            onClick={() => {
              setTab('trade')
              setNote('')
            }}
          >
            Trade
          </button>
        </div>
      </div>

      <div className="form__group">
        <label className="form__label" htmlFor="inv-amount">
          Amount
        </label>
        <div className="msearch__box">
          <input
            id="inv-amount"
            className="msearch__input form__amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="₹ Amount"
            value={amountText}
            onChange={(event) => setAmount(event.target.value)}
          />
        </div>
        <div className="form__chips">
          {QUICK_AMOUNTS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={`tab${amountOk && amount === item.value ? ' tab--on' : ''}`}
              aria-pressed={amountOk && amount === item.value}
              onClick={() => setAmount(String(item.value))}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'invest' && !isForex && (
        <div className="form__group" role="group" aria-label="Investment type">
          <span className="form__label">Investment Type</span>
          <div className="form__chips">
            {INVEST_TYPES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`tab${type === item.id ? ' tab--on' : ''}`}
                aria-pressed={type === item.id}
                onClick={() => setType(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {tab === 'trade' && (
        <div className="form__group" role="group" aria-label="Trade side">
          <span className="form__label">Side</span>
          <div className="form__chips">
            {TRADE_SIDES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`tab${side === item.id ? ' tab--on' : ''}`}
                aria-pressed={side === item.id}
                onClick={() => setSide(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {isForex && (
        <div className="form__group" role="group" aria-label="Leverage">
          <span className="form__label">Leverage</span>
          <div className="form__chips">
            {LEVERAGES.map((item) => (
              <button
                key={item}
                type="button"
                className={`tab${leverage === item ? ' tab--on' : ''}`}
                aria-pressed={leverage === item}
                onClick={() => setLeverage(item)}
              >
                {item}x
              </button>
            ))}
          </div>
          <p className="form__hint">
            Leverage is a preview — live leveraged trading is not enabled yet.
          </p>
        </div>
      )}

      <InvestmentSummary
        rows={rows}
        cta={{
          label: ctaLabel,
          disabled: !ready,
          note,
          onClick: () => setNote(ORDER_NOTE),
        }}
      />
    </section>
  )
}
