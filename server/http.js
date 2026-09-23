export function sendJson(res, status, body, extraHeaders = {}) {
  res.setHeader('Cache-Control', 'no-store')
  for (const [name, value] of Object.entries(extraHeaders)) res.setHeader(name, value)
  return res.status(status).json(body)
}

export function requireMethod(req, res, methods) {
  if (methods.includes(req.method)) return true
  res.setHeader('Allow', methods.join(', '))
  sendJson(res, 405, { error: 'Method not allowed' })
  return false
}

export function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body || '{}')
    } catch {
      return {}
    }
  }
  return {}
}

export function clientIp(req) {
  const value = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
  return String(value).split(',')[0].trim()
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = 20_000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}
