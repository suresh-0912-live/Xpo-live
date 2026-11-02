import { useEffect, useState } from 'react'
import {
  createDeposit,
  createWithdrawal,
  DEPOSIT_METHODS,
} from '../api/finance.js'
import { DEV_AUTH_BYPASS } from '../utils/devAuthBypass.js'
import { transactionWhatsAppLink } from '../utils/whatsapp.js'

// Bottom-sheet dialog backing the three Home quick actions:
//   deposit  — request a bank-transfer deposit. Recorded as `pending`; the
//              balance is credited only after a verified payment (no payment
//              provider is connected yet, so nothing is credited here).
//   withdraw — request a withdrawal. The backend reserves the funds atomically
//              and stores only masked bank details.
//   invest   — pick an investment page; no orders are executed from Home.
// API errors render inline — success is never faked.

const TITLES = {
  deposit: 'Deposit funds',
  withdraw: 'Withdraw funds',
  invest: 'Invest',
}

const METHOD_LABELS = { bank_transfer: 'Bank Transfer' }

const BANK_FIELDS = [
  ['accountHolder', 'Account holder'],
  ['accountNumber', 'Account number'],
  ['routingCode', 'Routing / IFSC code'],
  ['bankName', 'Bank name'],
]

const EMPTY_BANK = { accountHolder: '', accountNumber: '', routingCode: '', bankName: '' }

function parseAmount(raw) {
  const value = Number(raw)
  if (!raw || !Number.isFinite(value) || value <= 0) return null
  if (Math.round(value * 100) / 100 !== value) return null // max 2 decimals
  return value
}

export default function ActionDialog({ type, user, onClose, onChanged, onNavigate }) {
  const [amount, setAmount] = useState('')
  const [bank, setBank] = useState(EMPTY_BANK)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [submittedRequest, setSubmittedRequest] = useState(null)

  // Escape closes the sheet. App renders this dialog keyed by `type`, so
  // opening a different action remounts it with fresh form state.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const locked = busy || Boolean(notice)

  function fail(message) {
    setError(message)
    setNotice('')
  }

  async function submitDeposit() {
    // Dev bypass: there is no token or wallet to post against — say so
    // instead of firing a request that can only 401.
    if (DEV_AUTH_BYPASS) {
      return fail('Deposits need a signed-in backend session — the dev auth bypass has no account.')
    }
    const value = parseAmount(amount)
    if (value === null) {
      return fail('Enter an amount greater than 0 with at most 2 decimals.')
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await createDeposit({ amount: value, method: DEPOSIT_METHODS[0] })
      setNotice(result.message ?? 'Deposit request created.')
      setSubmittedRequest(result.transaction)
      onChanged?.()
    } catch (err) {
      setError(err.message || 'The deposit request failed.')
    } finally {
      setBusy(false)
    }
  }

  async function submitWithdrawal() {
    if (DEV_AUTH_BYPASS) {
      return fail('Withdrawals need a signed-in backend session — the dev auth bypass has no account.')
    }
    const value = parseAmount(amount)
    if (value === null) {
      return fail('Enter an amount greater than 0 with at most 2 decimals.')
    }
    if (Object.values(bank).some((entry) => entry.trim().length < 2)) {
      return fail('Fill in all bank detail fields (at least 2 characters each).')
    }
    if (!/^[0-9A-Za-z]{6,34}$/.test(bank.accountNumber.trim())) {
      return fail('Account number must be 6–34 letters or digits.')
    }
    if (!/^[0-9A-Za-z-]{3,20}$/.test(bank.routingCode.trim())) {
      return fail('Routing code must be 3–20 letters, digits or dashes.')
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await createWithdrawal({
        amount: value,
        bankDetails: {
          accountHolder: bank.accountHolder.trim(),
          accountNumber: bank.accountNumber.trim(),
          routingCode: bank.routingCode.trim(),
          bankName: bank.bankName.trim(),
        },
      })
      setNotice(result.message ?? 'Withdrawal requested.')
      setSubmittedRequest(result.transaction)
      onChanged?.()
    } catch (err) {
      setError(err.message || 'The withdrawal request failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sheet-backdrop" role="presentation" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="action-sheet-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet__head">
          <h2 className="sheet__title" id="action-sheet-title">
            {TITLES[type]}
          </h2>
          <button
            type="button"
            className="sheet__close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {notice ? (
          <>
            <p className="sheet__msg sheet__msg--ok" role="status">
              {notice}
            </p>
            <div className="sheet__actions">
              {submittedRequest && (
                <a className="btn btn--ghost" href={transactionWhatsAppLink({ user, transaction: submittedRequest })} target="_blank" rel="noreferrer">
                  Review in WhatsApp
                </a>
              )}
              <button type="button" className="btn btn--primary" onClick={onClose}>
                Done
              </button>
            </div>
          </>
        ) : type === 'invest' ? (
          <>
            <p className="sheet__sub">Choose where you want to invest.</p>
            <div className="sheet__choices">
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => onNavigate('crypto-investment')}
              >
                Crypto
              </button>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => onNavigate('forex-investment')}
              >
                Forex
              </button>
            </div>
          </>
        ) : (
          <form
            className="sheet__form"
            onSubmit={(event) => {
              event.preventDefault()
              if (type === 'deposit') submitDeposit()
              else submitWithdrawal()
            }}
          >
            <label className="field">
              <span className="field__label">Amount (₹)</span>
              <input
                className="field__input"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                disabled={locked}
                required
              />
            </label>

            {type === 'deposit' ? (
              <p className="sheet__note">
                Payment method: {METHOD_LABELS[DEPOSIT_METHODS[0]]}. No payment provider is
                connected yet — your request stays <strong>pending</strong> and the balance is
                credited only after the payment is verified.
              </p>
            ) : (
              <>
                <p className="sheet__note">
                  Withdrawals are reviewed before transfer; only masked bank details are stored.
                </p>
                {BANK_FIELDS.map(([field, label]) => (
                  <label className="field" key={field}>
                    <span className="field__label">{label}</span>
                    <input
                      className="field__input"
                      type="text"
                      value={bank[field]}
                      onChange={(event) =>
                        setBank((prev) => ({ ...prev, [field]: event.target.value }))
                      }
                      disabled={locked}
                      required
                    />
                  </label>
                ))}
              </>
            )}

            {error && (
              <p className="sheet__msg sheet__msg--err" role="alert">
                {error}
              </p>
            )}

            <div className="sheet__actions">
              <button
                type="button"
                className="btn btn--ghost"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={busy}>
                {busy
                  ? 'Sending…'
                  : type === 'deposit'
                    ? 'Request deposit'
                    : 'Request withdrawal'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
