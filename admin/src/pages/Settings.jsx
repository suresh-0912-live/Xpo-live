import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { formatNumber } from '../format.js'
import { ErrorBox, PageHeader, Spinner, StatusBadge } from '../ui.jsx'

function Row({ label, value }) {
  return (
    <tr>
      <td className="settings__label">{label}</td>
      <td>{value}</td>
    </tr>
  )
}

export default function Settings() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api('/admin/settings')
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <ErrorBox>{error}</ErrorBox>
  if (!data) return <Spinner />

  return (
    <div>
      <PageHeader title="Settings" subtitle="Runtime configuration (secrets are never shown)" />

      <section className="grid grid--settings">
        <div className="card">
          <h2 className="card__title">Forex provider</h2>
          <table className="table table--pairs">
            <tbody>
              <Row label="Provider" value={data.forex.provider} />
              <Row
                label="API key"
                value={<StatusBadge status={data.forex.configured ? 'ok' : 'not_configured'} />}
              />
              <Row label="Symbols" value={data.forex.symbols.join(', ')} />
              <Row label="Refresh interval" value={`${data.forex.refreshIntervalSeconds} seconds`} />
              <Row
                label="Est. monthly requests"
                value={formatNumber(data.forex.estimatedMonthlyRequests)}
              />
              <Row label="Monthly limit" value={formatNumber(data.forex.monthlyRequestLimit)} />
              <Row label="Warning threshold" value={formatNumber(data.forex.warningThreshold)} />
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="card__title">Crypto provider</h2>
          <table className="table table--pairs">
            <tbody>
              <Row
                label="Status"
                value={<StatusBadge status={data.crypto.configured ? 'ok' : 'not_configured'} />}
              />
              <Row
                label="Refresh interval"
                value={`${data.crypto.refreshIntervalSeconds} seconds`}
              />
            </tbody>
          </table>
          <p className="muted">
            Until a provider URL is configured, the crypto API returns 503 service-unavailable —
            no fake prices are ever served.
          </p>
        </div>

        <div className="card">
          <h2 className="card__title">Server</h2>
          <table className="table table--pairs">
            <tbody>
              <Row label="Environment" value={data.server.environment} />
              <Row label="Database" value={<StatusBadge status={data.database.status} />} />
              <Row label="JWT expiry" value={data.security.jwtExpiresIn} />
              <Row label="CORS origins" value={data.security.corsOrigins.join(', ')} />
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
