import { createHash } from 'node:crypto'
import { tasks } from '@trigger.dev/sdk'
import { authenticatedUser, supabaseAdmin } from '../../server/supabaseAdmin.js'
import { parseJsonBody, requireMethod, sendJson } from '../../server/http.js'
import { consumeRateLimit } from '../../server/rateLimit.js'

function normalizeSocialUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return null
  let url
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'https:') return null
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  let platform
  if (['tiktok.com', 'm.tiktok.com', 'vm.tiktok.com'].includes(host)) platform = 'tiktok'
  if (host === 'instagram.com') platform = 'instagram'
  if (!platform) return null
  url.hash = ''
  url.search = ''
  url.hostname = host
  url.pathname = url.pathname.replace(/\/+$/, '')
  return { canonicalUrl: url.toString(), platform }
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return
  const user = await authenticatedUser(req)
  if (!user) return sendJson(res, 401, { error: 'Sign in to import a social post.' })
  const db = supabaseAdmin()

  if (req.method === 'GET') {
    const { data, error } = await db.from('social_imports').select('id,source_url,platform,processing_status,review_status,current_step,error_message,recipe_id,created_at,recipes(id,title,description,ingredients,steps,source_creator,extraction_confidence,status)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
    if (error) return sendJson(res, 500, { error: 'Could not load imports.' })
    return sendJson(res, 200, { imports: data })
  }

  const body = parseJsonBody(req)
  try {
    if (!(await consumeRateLimit('social-import', user.id, 10))) {
      return sendJson(res, 429, { error: 'Too many imports. Please wait before adding another.' })
    }
  } catch {
    return sendJson(res, 503, { error: 'Could not verify the import limit.' })
  }
  const normalized = normalizeSocialUrl(body.url)
  if (!normalized) return sendJson(res, 400, { error: 'Enter a public TikTok or Instagram URL.' })
  const hash = createHash('sha256').update(normalized.canonicalUrl).digest('hex')
  const { data: existing } = await db.from('social_imports').select('id,processing_status,review_status').eq('user_id', user.id).eq('canonical_url_hash', hash).maybeSingle()
  if (existing) return sendJson(res, 200, { import: existing, duplicate: true })

  const { data: created, error } = await db.from('social_imports').insert({
    user_id: user.id,
    source_url: body.url,
    canonical_url: normalized.canonicalUrl,
    canonical_url_hash: hash,
    platform: normalized.platform,
  }).select('id,processing_status,review_status').single()
  if (error) return sendJson(res, 500, { error: 'Could not create this import.' })

  try {
    const run = await tasks.trigger(
      'import-social-post',
      { importId: created.id, generation: 1 },
      { idempotencyKey: `social-import:${created.id}:1` }
    )
    await db.from('social_imports').update({ trigger_run_id: run.id }).eq('id', created.id)
    return sendJson(res, 202, { import: created })
  } catch (triggerError) {
    await db.from('social_imports').update({ processing_status: 'failed', error_code: 'TRIGGER_FAILED', error_message: 'Could not start import processing.' }).eq('id', created.id)
    console.error('[Naijachow] Trigger.dev start failed:', triggerError.message)
    return sendJson(res, 503, { error: 'Could not start import processing.' })
  }
}
