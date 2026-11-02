import { useCallback, useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatDateTime, formatPrice } from '../format.js'
import {
  ErrorBox,
  PageHeader,
  Spinner,
  StatusBadge,
} from '../ui.jsx'

// Markets administration. Prices come from the server-side cache only —
// a market without cached data shows '—' (formatPrice), never a fabricated
// value, and no USD/INR conversion is ever guessed. Provider health is
// rendered from /admin/markets.providers (no secrets included).

function ProviderCard({ title, provider }) {
  if (!provider) return null
  return (
    <div className="card stat">
      <span className="stat__label">{title}</span>
      <span className="stat__value">
        <StatusBadge status={provider.status} />
      </span>
      <span className="stat__hint">
        {provider.configured
          ? `last success ${formatDateTime(provider.lastSuccessAt)}${
              provider.lastError ? ` · last error ${formatDateTime(provider.lastErrorAt)}` : ''
            }`
          : 'not configured — no prices will be fetched'}
      </span>
    </div>
  )
}

export default function Markets() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    api('/admin/markets')
      .then((result) => {
        setData(result)
        setError(null)
      })
      .catch((err) => setError(err.message))
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 15000)
    return () => clearInterval(timer)
  }, [load])

  async function toggleMarket(market) {
    setBusy(true)
    try {
      await api(`/admin/markets/${market.id}`, {
        method: 'PATCH',
        body: { active: !market.active },
      })
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function refreshForex() {
    setBusy(true)
    try {
      const { result } = await api('/admin/markets/forex/refresh', { method: 'POST' })
      if (!result.ok && result.error) setError(result.error)
      load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title="Markets"
        subtitle="INR-quoted asset universe — prices from the provider cache only"
        action={
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy}
            onClick={refreshForex}
          >
            Refresh forex now
          </button>
        }
      />

      {error && <ErrorBox>{error}</ErrorBox>}
      {!data && !error && <Spinner />}

      {data && (
        <>
          {/* Provider / quote health */}
          <section className="grid grid--finance">
            <ProviderCard title="Forex provider (IBRLive)" provider={data.providers?.forex} />
            <ProviderCard title="Crypto provider" provider={data.providers?.crypto} />
          </section>

          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th>Quote</th>
                  <th>Last price</th>
                  <th>Price at</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.markets.map((market) => (
                  <tr key={market.id}>
                    <td>{market.name}</td>
                    <td className="cell-mono">{market.symbol}</td>
                    <td>{market.type || market.category}</td>
                    <td className="cell-mono">{market.quote}</td>
                    <td>{formatPrice(market.lastPrice)}</td>
                    <td>{formatDateTime(market.lastPriceAt)}</td>
                    <td>
                      <StatusBadge status={market.active ? 'active' : 'off'} />
                    </td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="btn btn--ghost"
                        disabled={busy}
                        onClick={() => toggleMarket(market)}
                      >
                        {market.active ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
