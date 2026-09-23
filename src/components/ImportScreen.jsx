import { useEffect, useState } from 'react'
import { accessToken } from '../lib/supabase'
import { haptic } from '../lib/haptics'
import RecipeEditor from './RecipeEditor'

async function request(path, options = {}) {
  const token = await accessToken()
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'The import request failed.')
  return body
}

export default function ImportScreen() {
  const [url, setUrl] = useState('')
  const [imports, setImports] = useState([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [editingRecipeId, setEditingRecipeId] = useState(null)

  async function load() {
    try {
      const data = await request('/api/imports')
      setImports(data.imports || [])
    } catch (loadError) {
      setError(loadError.message)
    }
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 5000)
    return () => clearInterval(timer)
  }, [])

  async function submit(event) {
    event.preventDefault()
    setStatus('submitting')
    setError('')
    try {
      await request('/api/imports', { method: 'POST', body: JSON.stringify({ url }) })
      setUrl('')
      setStatus('idle')
      haptic('success')
      await load()
    } catch (submitError) {
      setStatus('idle')
      setError(submitError.message)
      haptic('warning')
    }
  }

  async function review(importId, action) {
    setError('')
    try {
      await request('/api/import-review', {
        method: 'POST',
        body: JSON.stringify({ importId, action }),
      })
      haptic('success')
      await load()
    } catch (reviewError) {
      setError(reviewError.message)
    }
  }

  async function retry(importId) {
    setError('')
    try {
      await request('/api/import-retry', {
        method: 'POST',
        body: JSON.stringify({ importId }),
      })
      haptic('success')
      await load()
    } catch (retryError) {
      setError(retryError.message)
    }
  }

  async function saveRecipe(recipe) {
    try {
      await request('/api/recipe-update', {
        method: 'PATCH',
        body: JSON.stringify(recipe),
      })
      setEditingRecipeId(null)
      haptic('success')
      await load()
    } catch (saveError) {
      setError(saveError.message)
      throw saveError
    }
  }

  return (
    <section className="screen imports-screen" aria-labelledby="imports-title">
      <header className="screenhead">
        <p className="eyebrow">YOUR RECIPE INBOX</p>
        <h1 id="imports-title">Import from social</h1>
        <p>Paste a public TikTok or Instagram post. We will extract a private recipe draft for you to review.</p>
      </header>
      <form className="import-form" onSubmit={submit}>
        <label htmlFor="social-url">TikTok or Instagram URL</label>
        <div className="import-form-row">
          <input id="social-url" type="url" required value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://www.instagram.com/reel/..." />
          <button className="btn btn-primary" disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Adding...' : 'Import'}
          </button>
        </div>
      </form>
      {error && <p className="error-banner" role="alert">{error}</p>}
      <div className="import-list">
        {imports.length === 0 && <p className="answer-help">No imports yet. Imported content is private to your account.</p>}
        {imports.map((item) => (
          <article className="import-card" key={item.id}>
            <div>
              <strong>{item.platform === 'tiktok' ? 'TikTok' : 'Instagram'} import</strong>
              <p>{item.source_url}</p>
            </div>
            <span className={`import-status status-${item.processing_status}`}>
              {item.processing_status === 'succeeded'
                ? item.review_status === 'pending' ? 'Ready to review' : item.review_status.replaceAll('_', ' ')
                : item.current_step || item.processing_status}
            </span>
            {item.error_message && <p className="error-banner">{item.error_message}</p>}
            {item.processing_status === 'failed' && (
              <button className="btn btn-outline" onClick={() => retry(item.id)}>Retry import</button>
            )}
            {item.recipes && (
              <div className="import-recipe">
                {editingRecipeId === item.recipes.id ? (
                  <RecipeEditor recipe={item.recipes} onSave={saveRecipe} onCancel={() => setEditingRecipeId(null)} />
                ) : (
                  <>
                    <h3>{item.recipes.title}</h3>
                    <p>{item.recipes.description}</p>
                    <p>{item.recipes.ingredients?.length || 0} ingredients · {item.recipes.steps?.length || 0} steps</p>
                    {item.review_status !== 'approved' && item.review_status !== 'rejected' && (
                      <div className="import-review-actions">
                        <button className="btn btn-primary" onClick={() => review(item.id, 'approve')}>Approve</button>
                        <button className="btn btn-outline" onClick={() => setEditingRecipeId(item.recipes.id)}>Edit draft</button>
                        <button className="btn btn-ghost" onClick={() => review(item.id, 'reject')}>Reject</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
