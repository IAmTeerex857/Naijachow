import { FOOD_BY_ID } from '../server/catalogue.js'
import { fetchWithTimeout, requireMethod, sendJson } from '../server/http.js'
import { supabaseAdmin } from '../server/supabaseAdmin.js'

const memory = new Map()
const HIT_TTL_MS = 60 * 60 * 1000
const MISS_TTL_MS = 5 * 60 * 1000

function safeImageUrl(value) {
  if (/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value) && value.length <= 500_000) {
    return value
  }
  try {
    const parsed = new URL(value)
    const isYouTubeThumbnail = parsed.hostname === 'i.ytimg.com' || parsed.hostname.endsWith('.ytimg.com')
    return parsed.protocol === 'https:' && !isYouTubeThumbnail ? parsed.toString() : null
  } catch {
    return null
  }
}

function safeWikimediaUrl(value) {
  const safe = safeImageUrl(value)
  if (!safe) return null
  const { hostname } = new URL(safe)
  return hostname === 'upload.wikimedia.org' || hostname === 'thumb.wikimedia.org' ? safe : null
}

function safeWikimediaSourceUrl(value) {
  const safe = safeImageUrl(value)
  if (!safe) return ''
  return new URL(safe).hostname === 'commons.wikimedia.org' ? safe : ''
}

function cached(key) {
  const entry = memory.get(key)
  if (!entry) return null
  if (entry.expiresAt > Date.now()) return entry.value
  memory.delete(key)
  return null
}

function remember(key, value, ttl) {
  if (memory.size >= 2000) memory.clear()
  memory.set(key, { value, expiresAt: Date.now() + ttl })
  return value
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
  const memoryValue = cached(key)
  if (memoryValue) return sendJson(res, 200, memoryValue, { 'Cache-Control': 'public, s-maxage=300' })

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
          const { data: signed, error: signedError } = await supabaseAdmin().storage
            .from(asset.bucket_id).createSignedUrl(asset.object_path, 3600)
          if (signedError || !signed?.signedUrl) throw signedError || new Error('Could not sign image URL')
          const hit = {
            url: signed.signedUrl,
            credit: asset.attribution || '',
          }
          return sendJson(res, 200, { ...hit, source: 'storage' }, { 'Cache-Control': 'public, s-maxage=1800' })
        }
      }
    }

    if (key.startsWith('dish:')) {
      const dishKey = key.slice(5)
      const mediaResponse = await fetchWithTimeout(
        `${url}/rest/v1/meal_media?dish_key=eq.${encodeURIComponent(dishKey)}&source_type=eq.wikimedia&review_status=eq.approved&composition=eq.exact_combo&select=thumbnail_url,credit,source_url&limit=1`,
        { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
        5_000
      )
      if (!mediaResponse.ok) throw new Error(`Meal media lookup failed (${mediaResponse.status})`)
      if (mediaResponse.ok) {
        const media = await mediaResponse.json()
        const imageUrl = safeWikimediaUrl(media?.[0]?.thumbnail_url)
        if (imageUrl) {
          const hit = {
            url: imageUrl,
            credit: media[0].credit || '',
            sourceUrl: safeWikimediaSourceUrl(media[0].source_url),
            source: 'wikimedia',
          }
          remember(key, hit, HIT_TTL_MS)
          return sendJson(res, 200, hit, { 'Cache-Control': 'public, s-maxage=3600' })
        }
      }
      remember(key, miss, MISS_TTL_MS)
      return sendJson(res, 200, miss, { 'Cache-Control': 'public, s-maxage=300' })
    }

    const response = await fetchWithTimeout(
      `${url}/rest/v1/image_cache?query_key=eq.${encodeURIComponent(key)}&select=image_url,credit`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
      5_000
    )
    if (!response.ok) throw new Error(`Supabase image lookup failed (${response.status})`)
    const rows = await response.json()
    if (!rows?.[0]?.image_url) {
      remember(key, miss, MISS_TTL_MS)
      return sendJson(res, 200, miss, { 'Cache-Control': 'public, s-maxage=300' })
    }
    const imageUrl = safeImageUrl(rows[0].image_url)
    if (!imageUrl) {
      remember(key, miss, MISS_TTL_MS)
      return sendJson(res, 200, miss, { 'Cache-Control': 'public, s-maxage=300' })
    }
    const hit = { url: imageUrl, credit: rows[0].credit || '', source: 'supabase' }
    remember(key, hit, HIT_TTL_MS)
    return sendJson(res, 200, hit, { 'Cache-Control': 'public, s-maxage=3600' })
  } catch (error) {
    console.error('[Naijachow] image lookup failed:', error.message)
    return sendJson(res, 502, { ...miss, error: 'Image lookup failed.' })
  }
}
