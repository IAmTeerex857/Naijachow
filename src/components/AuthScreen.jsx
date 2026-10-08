import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthScreen({ planWaiting = false, user, onContinue }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [otp, setOtp] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!supabase || !email.trim()) return
    setStatus('sending')
    setMessage('')
    try {
      const response = await fetch('/api/auth-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Could not send the sign in email.')
      setStatus('sent')
      setMessage('Check your email for your six digit sign in code.')
    } catch (error) {
      setStatus('error')
      setMessage(error.message || 'Could not send the sign in email.')
    }
  }

  async function verifyCode(event) {
    event.preventDefault()
    if (!supabase || !email.trim() || !/^\d{6}$/.test(otp)) return
    setStatus('verifying')
    setMessage('')
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp, type: 'email' })
    if (error) {
      setStatus('sent')
      setMessage('That code is invalid or expired. Use the newest email or request another.')
      return
    }
    setStatus('verified')
    setMessage('Signed in. You can continue securely.')
  }

  if (user) {
    return (
      <section className="screen coming-soon auth-panel" aria-labelledby="auth-title">
        <p className="eyebrow">SIGNED IN</p>
        <h1 id="auth-title">Welcome back</h1>
        <p>{user.email}</p>
        <button className="btn btn-primary" onClick={onContinue}>Continue to your plan</button>
      </section>
    )
  }

  return (
    <section className="screen coming-soon auth-panel" aria-labelledby="auth-title">
      <p className="eyebrow">EMAIL SIGN-IN</p>
      <h1 id="auth-title">{planWaiting ? 'Your plan is ready' : 'Sign in to Naijachow'}</h1>
      <p>
        {planWaiting
          ? 'Enter your email to securely claim and view the plan we just prepared.'
          : 'We will email you a six digit sign in code. No password needed.'}
      </p>
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="auth-email">Email address</label>
        <input
          id="auth-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
        <button className="btn btn-primary" type="submit" disabled={!supabase || status === 'sending'}>
          {status === 'sending' ? 'Sending code...' : 'Email me a sign in code'}
        </button>
      </form>
      {!supabase && <p className="error-banner">Authentication is not configured in this environment.</p>}
      {message && (
        <p className={status === 'error' ? 'error-banner' : 'success-banner'} role={status === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
      )}
      {['sent', 'verifying'].includes(status) && (
        <form className="auth-form auth-code-form" onSubmit={verifyCode}>
          <label htmlFor="auth-code">Enter the 6 digit code</label>
          <input
            id="auth-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
          />
          <button className="btn btn-outline" type="submit" disabled={status === 'verifying' || otp.length !== 6}>
            {status === 'verifying' ? 'Checking code...' : 'Use sign in code'}
          </button>
        </form>
      )}
    </section>
  )
}
