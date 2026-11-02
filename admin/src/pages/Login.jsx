import { useRef, useState } from 'react'
import { api } from '../api.js'
import { Button, FormField } from '../ui.jsx'

// Mobile-first sign-in (320–430px). The auth flow is unchanged: POST
// /api/admin/auth/login with the entered credentials, then onLogin(token, admin).
// No credentials are prefilled, no reset-password flow exists, and there are
// no fake success states — local validation only checks that the fields are
// filled and the email is well-formed before the real request runs.

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Inline icons — no icon dependency, currentColor for theme consistency.
function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 7.5 7.4 5.1a2 2 0 0 0 2.2 0l7.4-5.1" strokeLinecap="round" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.5" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" strokeLinecap="round" />
      <circle cx="12" cy="15.3" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  )
}

function EyeIcon({ off }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M4 20 20 4" />}
    </svg>
  )
}

export default function Login({ onLogin, notice }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  // Which field a validation error points at ('email' | 'password'); null
  // for server-side auth errors, which must not mark either field invalid.
  const [errorField, setErrorField] = useState(null)
  const [busy, setBusy] = useState(false)
  const passwordRef = useRef(null)

  async function submit(event) {
    event.preventDefault()

    // Local validation before the network call — honest error states only.
    const trimmed = email.trim()
    if (!trimmed) {
      setError('Enter your email address.')
      setErrorField('email')
      return
    }
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('Enter a valid email address.')
      setErrorField('email')
      return
    }
    if (!password) {
      setError('Enter your password.')
      setErrorField('password')
      return
    }

    setError(null)
    setErrorField(null)
    setBusy(true)
    try {
      const data = await api('/admin/auth/login', {
        method: 'POST',
        body: { email: trimmed, password },
      })
      onLogin(data.token, data.admin)
    } catch (err) {
      setError(err.message)
      setErrorField(null)
    } finally {
      setBusy(false)
    }
  }

  function focusPassword(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      passwordRef.current?.focus()
    }
  }

  return (
    <div className="login">
      <main className="login__card">
        <div className="login__brand">
          <span className="login__logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
              <path d="M5.5 5.5 18.5 18.5M18.5 5.5 5.5 18.5" />
            </svg>
          </span>
          <div>
            <span className="login__wordmark">XPO</span>
            <span className="login__brand-sub">Admin Panel</span>
          </div>
        </div>

        <h1 className="login__title">Sign in</h1>
        <p className="login__intro">Use your administrator account to continue.</p>

        <form onSubmit={submit} noValidate>
          <FormField label="Email" htmlFor="admin-email">
            <div className="login__wrap login__wrap--icon">
              <input
                id="admin-email"
                className="input"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="next"
                placeholder="admin@example.com"
                aria-invalid={errorField === 'email' ? true : undefined}
                value={email}
                required
                disabled={busy}
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (error) {
                    setError(null)
                    setErrorField(null)
                  }
                }}
                onKeyDown={focusPassword}
              />
              <span className="login__icon">
                <MailIcon />
              </span>
            </div>
          </FormField>

          <FormField label="Password" htmlFor="admin-password">
            <div className="login__wrap login__wrap--icon login__wrap--password">
              <input
                id="admin-password"
                ref={passwordRef}
                className="input"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                enterKeyHint="go"
                placeholder="Your password"
                aria-invalid={errorField === 'password' ? true : undefined}
                value={password}
                required
                disabled={busy}
                onChange={(event) => {
                  setPassword(event.target.value)
                  if (error) {
                    setError(null)
                    setErrorField(null)
                  }
                }}
              />
              <span className="login__icon">
                <LockIcon />
              </span>
              <button
                type="button"
                className="login__toggle"
                // Keep focus in the field while toggling visibility.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                disabled={busy}
              >
                <EyeIcon off={!showPassword} />
              </button>
            </div>
          </FormField>

          {notice && <p className="alert alert--info">{notice}</p>}
          {error && (
            <p className="alert alert--error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" block loading={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>

        <p className="login__foot muted">
          Admin accounts are created by operators only — there is no self-registration.
        </p>
      </main>
    </div>
  )
}
