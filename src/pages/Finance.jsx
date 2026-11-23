import { useCallback, useEffect, useState } from 'react'
import BottomNavigation from '../components/BottomNavigation.jsx'
import MobileHeader from '../components/MobileHeader.jsx'
import { createDeposit, createWithdrawal, DEPOSIT_METHODS, fetchSummary, fetchTransactions } from '../api/finance.js'
import { navItemsFor } from '../data/dashboardData.js'
import { transactionWhatsAppLink } from '../utils/whatsapp.js'
import '../dashboard.css'
import './Finance.css'

const PANELS = ['wallet', 'deposits', 'withdrawals']

const EMPTY_BANK = { accountHolder: '', accountNumber: '', routingCode: '', bankName: '' }

const METHOD_LABELS = { bank_transfer: 'Bank Transfer' }

function money(value, currency) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(Number(value) || 0)
}

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

export default function Finance({ onNavigate, user }) {
  const [panel, setPanel] = useState('wallet')
  const [summary, setSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [amount, setAmount] = useState('')
  const [bank, setBank] = useState({ accountHolder: '', accountNumber: '', routingCode: '', bankName: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submittedRequest, setSubmittedRequest] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [nextSummary, result] = await Promise.all([
        fetchSummary(),
        fetchTransactions({ limit: 50 }),
      ])
      setSummary(nextSummary)
      setTransactions(Array.isArray(result.data) ? result.data : [])
      setError('')
    } catch (err) {
      setError(err.message || 'Account data is unavailable.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])

  // Status colour depends on status AND transaction type — never on type alone.
  function txTone(type, status) {
    switch (status) {
      case 'pending':
      case 'processing':
        return 'warn' // yellow — still awaiting approval
      case 'completed':
        return type === 'withdrawal' ? 'neg' : 'pos' // withdrawal = red, deposit = green
      case 'rejected':
      case 'failed':
        return 'reject' // orange
      default:
        return 'neutral'
    }
  }

  function statusLabel(status) {
    const labels = { pending: 'Pending', processing: 'Processing', completed: 'Completed', failed: 'Failed', rejected: 'Rejected' }
    return labels[status] || status
  }

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setNotice('')
    try {
      const value = Number(amount)
      if (panel === 'deposits') {
        const result = await createDeposit({ amount: value, method: DEPOSIT_METHODS[0] })
        const ref = result.transaction?.reference
        setNotice(result.message || `Deposit request created — Ref: ${ref}`)
        setSubmittedRequest(result.transaction)
        // Deposits redirect directly to WhatsApp — no confirmation modal first.
        const link = transactionWhatsAppLink({ user, transaction: result.transaction })
        window.open(link, '_blank', 'noopener')
      } else {
        const result = await createWithdrawal({ amount: value, bankDetails: bank })
        const ref = result.transaction?.reference
        setNotice(result.message || `Withdrawal requested — Ref: ${ref}`)
        setSubmittedRequest(result.transaction)
        // Withdrawals stay inside the app — no WhatsApp redirect.
      }
      setAmount('')
      setBank(EMPTY_BANK)
      await load()
    } catch (err) {
      setError(err.message || 'Could not submit your request.')
    } finally {
      setSubmitting(false)
    }
  }

  const currency = summary?.currency || 'INR'
  const rows = transactions.filter((row) =>
    panel === 'wallet' || row.type === (panel === 'deposits' ? 'deposit' : 'withdrawal'),
  )

  return (
    <div className="shell">
      <MobileHeader showAvatar={false} />
      <main className="screen finance-screen">
        <header className="finance-head">
          <div>
            <h1 className="finance-title">Wallet</h1>
            <p className="finance-subtitle">Your balance and transfer requests</p>
          </div>
          <button type="button" className="finance-refresh" onClick={load} disabled={loading} aria-label="Refresh wallet data">↻</button>
        </header>

        <div className="finance-tabs" role="tablist" aria-label="Wallet sections">
          {PANELS.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={panel === item}
              className={panel === item ? 'finance-tab finance-tab--on' : 'finance-tab'}
              onClick={() => { setPanel(item); setNotice(''); setError(''); setSubmittedRequest(null) }}
            >
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>

        {loading && <p className="finance-state" role="status">Loading account data…</p>}
        {error && <div className="finance-error" role="alert"><span>{error}</span><button type="button" onClick={load}>Retry</button></div>}
        {!loading && !error && summary && (
          <section className="finance-balance" aria-label="Wallet balance">
            <span>Available balance</span>
            <strong>{money(summary.cashBalance, currency)}</strong>
          </section>
        )}
        {notice && <p className="finance-notice" role="status">{notice}</p>}

        {panel !== 'wallet' && (
          <form className="finance-form" onSubmit={submit}>
            <h2>Request a {panel === 'deposits' ? 'deposit' : 'withdrawal'}</h2>
            <label>
              <span>Amount ({currency})</span>
              <input type="number" min="0.01" max="1000000" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            {panel === 'deposits' ? (
              <p className="finance-help">Bank transfer requests remain pending until an administrator verifies the payment.</p>
            ) : (
              <>
                {[
                  ['accountHolder', 'Account holder'],
                  ['accountNumber', 'Account number'],
                  ['routingCode', 'Routing / IFSC code'],
                  ['bankName', 'Bank name'],
                ].map(([key, title]) => (
                  <label key={key}>
                    <span>{title}</span>
                    <input type="text" required value={bank[key]} onChange={(event) => setBank((current) => ({ ...current, [key]: event.target.value }))} />
                  </label>
                ))}
                <p className="finance-help">The server stores masked account details and reserves the requested funds.</p>
              </>
            )}
            <button className="finance-submit" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : `Submit ${panel === 'deposits' ? 'deposit' : 'withdrawal'} request`}</button>
          </form>
        )}

        <section className="finance-history">
          <div className="finance-history-head">
            <h2>{panel === 'wallet' ? 'Recent activity' : `${panel[0].toUpperCase()}${panel.slice(1)} history`}</h2>
            <button type="button" onClick={() => onNavigate?.('transactions')}>All transactions</button>
          </div>
          {!loading && !error && rows.length === 0 && <p className="finance-state">No {panel === 'wallet' ? 'wallet activity' : panel} yet.</p>}
          {rows.map((row) => {
            const tone = txTone(row.type, row.status)
            return (
              <article className="finance-row" key={row.id}>
                <div>
                  <strong>{row.type[0].toUpperCase() + row.type.slice(1)}</strong>
                  <span>Ref: {row.reference || '—'} · {METHOD_LABELS[row.method] || row.method || '—'} · {formatDate(row.createdAt)}</span>
                </div>
                <div className="finance-row-side">
                  <strong className={`finance-status--${tone}`}>{money(row.amount, currency)}</strong>
                  <span className={`finance-status finance-status--${tone}`}>{statusLabel(row.status)}</span>
                </div>
              </article>
            )
          })}
        </section>
      </main>
      <BottomNavigation items={navItemsFor('more')} onSelect={onNavigate} />
    </div>
  )
}
