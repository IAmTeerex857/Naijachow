import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function AuthScreen({ planWaiting = false, user, onContinue }) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  async function submit(event) {
    event.preventDefault()
    if (!supabase || !email.trim()) return
    setStatus('sending')
    setMessage('')
    const redirectTo = window.location.origin
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    })
    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }
    setStatus('sent')
    setMessage('Check your email and open the secure sign-in link.')
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
          : 'We will email you a secure sign-in link. No password needed.'}
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
          {status === 'sending' ? 'Sending link…' : 'Email me a sign-in link'}
        </button>
      </form>
      {!supabase && <p className="error-banner">Authentication is not configured in this environment.</p>}
      {message && (
        <p className={status === 'error' ? 'error-banner' : 'success-banner'} role={status === 'error' ? 'alert' : 'status'}>
          {message}
        </p>
      )}
    </section>
  )
}
