import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function SavedPlansScreen({ onOpen, onNew }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    supabase
      .from('meal_plans')
      .select('id,title,duration_days,selected_dish_ids,plan_data,created_at,saved_at')
      .eq('status', 'saved')
      .order('saved_at', { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!active) return
        if (loadError) setError(loadError.message)
        setPlans(data || [])
        setLoading(false)
      })
    return () => { active = false }
  }, [])

  return (
    <section className="screen saved-screen" aria-labelledby="saved-title">
      <header className="screenhead saved-head">
        <div>
          <p className="eyebrow">YOUR LIBRARY</p>
          <h1 id="saved-title">Saved plans</h1>
        </div>
        <button className="btn btn-primary" onClick={onNew}>New plan</button>
      </header>
      {loading && <p>Loading your plans...</p>}
      {error && <p className="error-banner" role="alert">{error}</p>}
      {!loading && !error && plans.length === 0 && (
        <div className="answer-card">
          <h2>No saved plans yet</h2>
          <p>Generate a plan and choose Save plan to keep it here.</p>
        </div>
      )}
      <div className="saved-grid">
        {plans.map((plan) => (
          <article className="saved-card" key={plan.id}>
            <span className="eyebrow">{plan.duration_days} DAYS</span>
            <h2>{plan.title}</h2>
            <p>{new Date(plan.saved_at || plan.created_at).toLocaleDateString()}</p>
            <button className="btn btn-outline" onClick={() => onOpen({ ...plan.plan_data, planId: plan.id, selectedIds: plan.selected_dish_ids })}>
              Open plan
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}
