import { createClient } from '@supabase/supabase-js'

let client

export function supabaseAdmin() {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Supabase server credentials are not configured')
  client = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return client
}

export async function authenticatedUser(req) {
  const authorization = req.headers.authorization || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null
  if (!token) return null
  const { data, error } = await supabaseAdmin().auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
