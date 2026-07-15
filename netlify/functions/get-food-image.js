/* Image lookup with a 3-layer cache (PRD §4.3):
     1. in-memory Map (per warm function instance)
     2. Supabase image_cache (permanent, curatable)
     3. Google Custom Search (last resort — 100 free queries/day)
   Always returns HTTP 200. On total miss: { url: null }. The frontend then
   shows the emoji tile fallback and never crashes.

   Keys are namespaced by the caller: `food:<id>` (curated) or `dish:<combo>`
   (auto-fetched). `fallback` is the search phrase used only if we reach Google. */

const memCache = new Map()

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }

  const q = event.queryStringParameters?.q || ''
  const fallback = event.queryStringParameters?.fallback || ''
  const key = q.replace(/[^a-zA-Z0-9:_ \-'&]/g, '').slice(0, 120).trim()
  if (!key) return { statusCode: 200, headers, body: JSON.stringify({ url: null, source: 'none' }) }

  // ── Layer 1: in-memory ────────────────────────────────────────────────
  if (memCache.has(key)) {
    return { statusCode: 200, headers, body: JSON.stringify({ ...memCache.get(key), source: 'memory' }) }
  }

  const SUPABASE_URL = process.env.SUPABASE_URL
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY

  // ── Layer 2: Supabase image_cache ─────────────────────────────────────
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/image_cache?query_key=eq.${encodeURIComponent(key)}&select=image_url,credit`
      const res = await fetch(url, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      })
      if (res.ok) {
        const rows = await res.json()
        if (rows && rows.length && rows[0].image_url) {
          const hit = { url: rows[0].image_url, credit: rows[0].credit || '' }
          memCache.set(key, hit)
          return { statusCode: 200, headers, body: JSON.stringify({ ...hit, source: 'supabase' }) }
        }
      }
    } catch (err) {
      console.error('[NaijaPlate] supabase read error:', err.message)
    }
  }

  // ── Layer 3: Google Custom Search (last resort) ───────────────────────
  const GKEY = process.env.GOOGLE_SEARCH_API_KEY
  const GCX = process.env.GOOGLE_SEARCH_ENGINE_ID
  if (GKEY && GCX) {
    try {
      const phrase = (fallback || key.replace(/^([a-z]+):/, '')).slice(0, 100)
      const gurl =
        `https://www.googleapis.com/customsearch/v1?key=${GKEY}&cx=${GCX}` +
        `&q=${encodeURIComponent(phrase)}&searchType=image&imgType=photo&imgSize=LARGE&safe=active&num=5`
      const res = await fetch(gurl)
      const data = await res.json()
      if (data.error) throw new Error(data.error.message || 'google error')
      const items = data.items || []
      // Deterministic: first result >= 300x200 (never random).
      const pick = items.find((it) => {
        const w = Number(it.image?.width || 0)
        const h = Number(it.image?.height || 0)
        return w >= 300 && h >= 200
      })
      if (pick) {
        const credit = pick.displayLink || ''
        const hit = { url: pick.link, credit }
        memCache.set(key, hit)
        // Persist under the ORIGINAL key so it's permanent + curatable.
        if (SUPABASE_URL && SUPABASE_KEY) {
          fetch(`${SUPABASE_URL}/rest/v1/image_cache`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_KEY,
              Authorization: `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify({ query_key: key, image_url: pick.link, credit }),
          }).catch((e) => console.error('[NaijaPlate] supabase write error:', e.message))
        }
        return { statusCode: 200, headers, body: JSON.stringify({ ...hit, source: 'google' }) }
      }
    } catch (err) {
      console.error('[NaijaPlate] google image error:', err.message)
    }
  }

  // Total miss → emoji fallback on the client.
  const miss = { url: null, credit: '' }
  memCache.set(key, miss)
  return { statusCode: 200, headers, body: JSON.stringify({ ...miss, source: 'none' }) }
}
