import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    let active = true
    async function initialize() {
      const { data } = await supabase.auth.getSession()
      if (active) {
        setSession(data.session)
        setLoading(false)
      }
    }
    initialize().catch(() => {
      if (active) {
        setLoading(false)
      }
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  return { session, user: session?.user || null, loading }
}
