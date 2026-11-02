import { useState } from 'react'
import { ArrowRight, Logo } from '../components/Icons.jsx'
import { loginUser, request } from '../api/auth.js'
import { recoveryWhatsAppLink } from '../utils/whatsapp.js'
import './Auth.css'

function errorMessage(error) {
  if (Array.isArray(error?.details) && error.details.length) return error.details.join(' · ')
  return error?.message || 'Sign in failed — please try again.'
}

export default function Login({ onSwitch, onSuccess }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [securityQuestion, setSecurityQuestion] = useState('')
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [mode, setMode] = useState('login')
  const [notice, setNotice] = useState('')
  const [recoverySubmitted, setRecoverySubmitted] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    setError('')
    setBusy(true)
    try {
      const result = await loginUser({ email: email.trim(), password })
      if (result.recovery) {
        setResetToken(result.recovery.token)
        setSecurityQuestion(result.recovery.question)
        setNotice('Temporary password accepted. Answer your security question to continue.')
        setError('')
        setMode('recover')
        return
      }
      onSuccess(result.user)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleForgot(event) {
    event.preventDefault()
    if (busy) return
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await request('/auth/password-recovery/request', { method: 'POST', body: { email: email.trim() } })
      setNotice('If the account is eligible, a recovery request has been submitted for review.')
      setRecoverySubmitted(true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleRecovery(event) {
    event.preventDefault()
    if (busy) return
    setError('')
    setNotice('')
    setBusy(true)
    try {
      await request('/auth/password-recovery/complete', {
        method: 'POST',
        body: { recoveryToken: resetToken, securityAnswer, newPassword },
      })
      setNotice('Password updated. Sign in with your new password.')
      setResetToken('')
      setSecurityQuestion('')
      setSecurityAnswer('')
      setNewPassword('')
      setMode('login')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth">
      <div className="auth__card">
        <span className="auth__brand">
          <Logo />
        </span>
        <h1 className="auth__title">{mode === 'recover' ? 'Confirm your identity' : mode === 'forgot' ? 'Forgot password' : 'Welcome back'}</h1>
        <p className="auth__sub">{mode === 'recover' ? 'Answer your security question and choose a new password' : mode === 'forgot' ? 'Ask an administrator to review your recovery request' : 'Sign in to your XPO account'}</p>

        <form className="auth__form" data-form={mode} onSubmit={mode === 'recover' ? handleRecovery : mode === 'forgot' ? handleForgot : handleSubmit} noValidate>
          {mode === 'recover' ? (
            <>
              <label className="auth__field">
                <span>Security question</span>
                <input
                  type="text"
                  value={securityQuestion}
                  aria-label="Security question"
                  readOnly
                  disabled
                />
              </label>
              <label className="auth__field">
                <span>Security answer</span>
                <input
                  type="password"
                  name="securityAnswer"
                  value={securityAnswer}
                  onChange={(event) => setSecurityAnswer(event.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
              <label className="auth__field">
                <span>New password</span>
                <input
                  type="password"
                  name="newPassword"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  required
                />
              </label>
            </>
          ) : (
            <>
          <label className="auth__field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          {mode === 'login' && <label className="auth__field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              autoComplete="current-password"
              required
            />
          </label>}
            </>
          )}

          {error && (
            <p className="auth__error" role="alert">
              {error}
            </p>
          )}
          {notice && <p className="auth__success" role="status">{notice}</p>}
          {mode === 'forgot' && recoverySubmitted && (
            <a className="auth__link auth__whatsapp" href={recoveryWhatsAppLink(email.trim())} target="_blank" rel="noreferrer">
              Review recovery request in WhatsApp
            </a>
          )}

          <button type="submit" className="auth__submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'recover' ? 'Update password' : mode === 'forgot' ? 'Submit recovery request' : 'Sign in'}
            {!busy && <ArrowRight />}
          </button>
        </form>

        {mode === 'recover' || mode === 'forgot' ? (
          <p className="auth__switch">
            <button type="button" className="auth__link" onClick={() => { setMode('login'); setError(''); setNotice(''); setRecoverySubmitted(false) }}>
              Back to sign in
            </button>
          </p>
        ) : (
          <>
            <p className="auth__switch">
              <button type="button" className="auth__link" onClick={() => { setMode('forgot'); setError(''); setNotice(''); setRecoverySubmitted(false) }}>
                Forgot Password?
              </button>
            </p>
            <p className="auth__switch">
              Don&apos;t have an account?{' '}
              <button type="button" className="auth__link" onClick={onSwitch}>
                Sign up
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
