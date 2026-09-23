import { createHash } from 'node:crypto'
import { supabaseAdmin } from './supabaseAdmin.js'

export async function consumeRateLimit(scope, identity, limit, windowSeconds = 3600) {
  const key = rateLimitKey(scope, identity)
  const { data, error } = await supabaseAdmin().rpc('consume_api_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) throw error
  return data === true
}

function rateLimitKey(scope, identity) {
  const digest = createHash('sha256').update(`${scope}:${identity}`).digest('hex')
  return `${scope}:${digest}`
}

export async function releaseRateLimit(scope, identity) {
  const { error } = await supabaseAdmin().rpc('release_api_rate_limit', {
    p_key: rateLimitKey(scope, identity),
  })
  if (error) throw error
}
