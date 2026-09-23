import { fetchWithTimeout } from './http.js'

export async function verifyTurnstile(token, remoteIp) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!token) return false
  const body = new URLSearchParams({ secret, response: token })
  if (remoteIp && remoteIp !== 'unknown') body.set('remoteip', remoteIp)
  try {
    const response = await fetchWithTimeout(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body },
      8_000
    )
    if (!response.ok) return false
    const result = await response.json()
    return result.success === true
  } catch {
    return false
  }
}
