import { useState } from 'react'
import { accessToken, supabase } from '../lib/supabase'

async function authenticatedRequest(path, options = {}) {
  const token = await accessToken()
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error || 'The account request failed.')
  }
  return response
}

export default function AccountScreen({ user, onDeleted, onEditPreferences, onSignOut }) {
  const [confirmation, setConfirmation] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')

  async function exportData() {
    setStatus('exporting')
    setMessage('')
    try {
      const response = await authenticatedRequest('/api/account-export')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'naijachow-data.json'
      link.click()
      URL.revokeObjectURL(url)
      setMessage('Your data export has downloaded.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setStatus('idle')
    }
  }

  async function deleteAccount() {
    if (confirmation !== 'DELETE') return
    setStatus('deleting')
    setMessage('')
    try {
      await authenticatedRequest('/api/account-delete', {
        method: 'DELETE',
        body: JSON.stringify({ confirmation }),
      })
      await supabase.auth.signOut()
      onDeleted()
    } catch (error) {
      setMessage(error.message)
      setStatus('idle')
    }
  }

  return (
    <section className="screen account-screen" aria-labelledby="account-title">
      <header className="screenhead">
        <p className="eyebrow">ACCOUNT & PRIVACY</p>
        <h1 id="account-title">Your account</h1>
      </header>

      <div className="account-grid">
        <article className="answer-card account-session-card">
          <div>
            <p className="eyebrow">SIGNED IN AS</p>
            <h2>{user.email}</h2>
          </div>
          <button className="btn btn-outline" onClick={onSignOut}>Sign out</button>
        </article>

        <article className="answer-card">
          <h2>Planning preferences</h2>
          <p>Update your goals, health considerations, food avoidances, and cooking time.</p>
          <button className="btn btn-outline" onClick={onEditPreferences}>Edit preferences</button>
        </article>

        <article className="answer-card">
          <h2>Download your data</h2>
          <p>Export your profile, health preferences, meal plans, and payment records.</p>
          <button className="btn btn-outline" onClick={exportData} disabled={status !== 'idle'}>
            {status === 'exporting' ? 'Preparing...' : 'Download'}
          </button>
        </article>

        <article className="answer-card danger-card">
          <h2>Delete account</h2>
          <p>This permanently removes your account, health profile, saved plans, and private files. Payment records may be retained where required for security, disputes, or legal obligations.</p>
          <label className="answer-field">
            Type DELETE to confirm
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
          </label>
          <button className="btn btn-outline" onClick={deleteAccount} disabled={confirmation !== 'DELETE' || status === 'deleting'}>
            {status === 'deleting' ? 'Deleting...' : 'Permanently delete account'}
          </button>
        </article>
      </div>
      {message && <p className="notice info" role={status === 'idle' ? 'alert' : 'status'}>{message}</p>}
    </section>
  )
}
