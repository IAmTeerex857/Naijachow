import {
  SUBSCRIPTION_EVENTS,
  cancelBachsSubscriptionImmediately,
  subscriptionRpcPayload,
  verifyBachsSignature,
} from '../server/bachs.js'
import { requireMethod, sendJson } from '../server/http.js'
import { supabaseAdmin } from '../server/supabaseAdmin.js'

async function rawRequestBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return Buffer.from(req.body)
  const chunks = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

export const config = { api: { bodyParser: false } }

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return
  try {
    const rawBody = await rawRequestBody(req)
    const valid = verifyBachsSignature({
      rawBody,
      secret: process.env.BACHS_WEBHOOK_SECRET,
      signatureV2: req.headers['x-bachs-signature-v2'],
      timestamp: req.headers['x-bachs-timestamp'],
      signature: req.headers['x-bachs-signature'],
    })
    if (!valid) return sendJson(res, 401, { error: 'Invalid webhook signature.' })
    const event = JSON.parse(rawBody.toString('utf8'))
    if (!event.id || !event.type || !event.created_at || !event.data) {
      return sendJson(res, 400, { error: 'Invalid webhook event.' })
    }
    if (!SUBSCRIPTION_EVENTS.has(event.type)) return sendJson(res, 200, { received: true, ignored: true })
    const db = supabaseAdmin()
    let { data, error } = await db.rpc('reconcile_bachs_subscription', subscriptionRpcPayload(event))
    if (error) throw error
    if (data === 'cancel_orphan') {
      if (event.data.status !== 'canceled') {
        await cancelBachsSubscriptionImmediately(event.data.subscription_id, 'Associated account was deleted')
      }
      const finalized = await db.rpc(
        'reconcile_bachs_subscription',
        subscriptionRpcPayload(event, true)
      )
      if (finalized.error) throw finalized.error
      data = finalized.data
    }
    if (['ignored_missing_user', 'ignored_user_mismatch'].includes(data)) {
      return sendJson(res, 503, { error: 'Webhook identity could not be correlated.' })
    }
    return sendJson(res, 200, { received: true, result: data })
  } catch (error) {
    if (error instanceof SyntaxError) return sendJson(res, 400, { error: 'Invalid JSON.' })
    console.error('[Naijachow] Bachs webhook failed:', error.message)
    return sendJson(res, 500, { error: 'Webhook processing failed.' })
  }
}
