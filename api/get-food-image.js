import { FOOD_BY_ID } from '../server/catalogue.js'
import { fetchWithTimeout, requireMethod, sendJson } from '../server/http.js'

const memory = new Map()

function safeImageUrl(value) {
  if (/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value) && value.length <= 500_000) {
    return value
  }
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

function publicStorageUrl(base, bucket, path) {
  const encodedPath = String(path).split('/').map(encodeURIComponent).join('/')
  return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${encodedPath}`
}

function parseKey(value) {
  const key = String(value || '').trim().toLowerCase()
  if (key.startsWith('food:')) {
    const id = key.slice(5)
    return FOOD_BY_ID[id] ? `food:${id}` : null
  }
  if (key.startsWith('dish:')) {
    const combo = key.slice(5).replace(/[^a-z0-9 +'&-]/g, '').replace(/\s+/g, ' ').trim()
    return combo.length >= 3 && combo.length <= 120 ? `dish:${combo}` : null
  }
  return null
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET'])) return
  const key = parseKey(Array.isArray(req.query.q) ? req.query.q[0] : req.query.q)
  const miss = { url: null, credit: '', source: 'none' }
  if (!key) return sendJson(res, 400, { error: 'Invalid image key.' })
  if (memory.has(key)) return sendJson(res, 200, { ...memory.get(key), source: 'memory' })

  const url = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return sendJson(res, 200, miss)

  try {
    if (key.startsWith('food:')) {
      const dishId = key.slice(5)
      const assetResponse = await fetchWithTimeout(
        `${url}/rest/v1/assets?dish_id=eq.${encodeURIComponent(dishId)}&visibility=eq.public&review_status=eq.approved&select=bucket_id,object_path,attribution&limit=1`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
        5_000
      )
      if (assetResponse.ok) {
        const assets = await assetResponse.json()
        if (assets?.[0]?.object_path) {
          const asset = assets[0]
          const hit = {
            url: publicStorageUrl(url, asset.bucket_id, asset.object_path),
            credit: asset.attribution || '',
          }
          memory.set(key, hit)
          return sendJson(res, 200, { ...hit, source: 'storage' }, { 'Cache-Control': 'public, s-maxage=3600' })
        }
      }
    }

    const response = await fetchWithTimeout(
      `${url}/rest/v1/image_cache?query_key=eq.${encodeURIComponent(key)}&select=image_url,credit`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      5_000
    )
    if (!response.ok) throw new Error(`Supabase image lookup failed (${response.status})`)
    const rows = await response.json()
    if (!rows?.[0]?.image_url) return sendJson(res, 200, miss)
    const imageUrl = safeImageUrl(rows[0].image_url)
    if (!imageUrl) return sendJson(res, 200, miss)
    const hit = { url: imageUrl, credit: rows[0].credit || '' }
    if (memory.size >= 2000) memory.clear()
    memory.set(key, hit)
    return sendJson(res, 200, { ...hit, source: 'supabase' }, { 'Cache-Control': 'public, s-maxage=3600' })
  } catch (error) {
    console.error('[Naijachow] image lookup failed:', error.message)
    return sendJson(res, 200, miss)
  }
}
