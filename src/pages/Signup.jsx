import { useState } from 'react'
import { ArrowRight, Logo } from '../components/Icons.jsx'
import { registerUser } from '../api/auth.js'
import './Auth.css'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function errorMessage(error) {
  if (Array.isArray(error?.details) && error.details.length) return error.details.join(' · ')
  return error?.message || 'Sign up failed — please try again.'
}

export default function Signup({ onSwitch, onSuccess }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [securityQuestion, setSecurityQuestion] = useState('')
  const [securityAnswer, setSecurityAnswer] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    if (busy) return
    setError('')

    const trimmedEmail = email.trim()
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('Please enter a valid email address.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      const user = await registerUser({
        email: trimmedEmail,
        password,
        name: name.trim() || undefined,
        securityQuestion: securityQuestion.trim(),
        securityAnswer,
      })
      onSuccess(user)
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
        <h1 className="auth__title">Create account</h1>
        <p className="auth__sub">Join XPO in a few seconds</p>

        <form className="auth__form" data-form="signup" onSubmit={handleSubmit} noValidate>
          <label className="auth__field">
            <span>Name</span>
            <input
              type="text"
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name (optional)"
              autoComplete="name"
              maxLength={120}
            />
          </label>

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

          <label className="auth__field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label className="auth__field">
            <span>Confirm password</span>
            <input
              type="password"
              name="confirm"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Repeat your password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>

          <label className="auth__field">
            <span>Security question</span>
            <input
              type="text"
              name="securityQuestion"
              value={securityQuestion}
              onChange={(event) => setSecurityQuestion(event.target.value)}
              placeholder="For example: What was your first school?"
              autoComplete="off"
              minLength={5}
              maxLength={250}
              required
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
              maxLength={250}
              required
            />
          </label>

          {error && (
            <p className="auth__error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="auth__submit" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
            {!busy && <ArrowRight />}
          </button>
        </form>

        <p className="auth__switch">
          Already have an account?{' '}
          <button type="button" className="auth__link" onClick={onSwitch}>
            Sign in
          </button>
        </p>
        <p className="auth__hint">Password must be at least 8 characters.</p>
      </div>
    </div>
  )
}
