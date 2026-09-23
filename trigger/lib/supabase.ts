import { createClient } from '@supabase/supabase-js'

export function triggerDatabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase is not configured for Trigger.dev')
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
