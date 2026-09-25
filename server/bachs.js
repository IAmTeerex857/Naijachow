import crypto from 'node:crypto'
import { fetchWithTimeout } from './http.js'
import { supabaseAdmin } from './supabaseAdmin.js'

export const BACHS_PRODUCT = Object.freeze({
  id: 'prod_05c306254dd749038f98',
  name: 'Naija Chow Sub',
  amount: '2500.00',
  currency: 'NGN',
  interval: 'month',
  frequency: 1,
})

export const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
])
const SUBSCRIPTION_STATUSES = new Set(['trialing', 'active', 'past_due', 'unpaid', 'canceled', 'paused'])

export function bachsProductId() {
  return process.env.BACHS_PRODUCT_ID || BACHS_PRODUCT.id
}

export function bachsBaseUrl(secretKey = process.env.BACHS_SECRET_KEY || '') {
  if (process.env.BACHS_API_BASE_URL) return process.env.BACHS_API_BASE_URL.replace(/\/+$/, '')
  return secretKey.startsWith('sk_live_') ? 'https://api.bachs.io' : 'https://sandbox-api.bachs.io'
}

export async function bachsRequest(path, options = {}) {
  const secretKey = process.env.BACHS_SECRET_KEY
  if (!secretKey) throw new Error('Bachs is not configured')
  const response = await fetchWithTimeout(`${bachsBaseUrl(secretKey)}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(payload.error?.message || payload.message || `Bachs request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return payload
}

function safeEqualHex(expected, supplied) {
  if (!/^[a-f\d]{64}$/i.test(supplied || '')) return false
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(supplied, 'hex'))
}

export function verifyBachsSignature({ rawBody, secret, signatureV2, timestamp, signature, now = Date.now() }) {
  if (!secret) return false
  let signedAt
  let signatures
  if (signatureV2) {
    const parts = signatureV2.split(',').map((part) => part.trim().split(/=(.*)/s, 2))
    signedAt = parts.find(([key]) => key === 't')?.[1]
    signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value)
  } else {
    signedAt = timestamp
    signatures = signature ? [signature] : []
  }
  const seconds = Number(signedAt)
  if (!Number.isInteger(seconds) || Math.abs(now / 1000 - seconds) > 300 || !signatures.length) return false
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody))
  const expected = crypto.createHmac('sha256', secret)
    .update(Buffer.concat([Buffer.from(`${seconds}.`), body]))
    .digest('hex')
  return signatures.some((candidate) => safeEqualHex(expected, candidate))
}

export function validateSubscriptionData(data) {
  const periodStart = Date.parse(data?.current_period_start)
  const periodEnd = Date.parse(data?.current_period_end)
  const validGrantPeriod = !['trialing', 'active'].includes(data?.status) || (
    Number.isFinite(periodStart) && Number.isFinite(periodEnd) && periodEnd > periodStart
  )
  return Boolean(
    data &&
    typeof data.subscription_id === 'string' && data.subscription_id.startsWith('sub_') &&
    SUBSCRIPTION_STATUSES.has(data.status) &&
    data.product_id === bachsProductId() &&
    data.amount === BACHS_PRODUCT.amount &&
    data.currency === BACHS_PRODUCT.currency &&
    data.billing_cycle?.interval === BACHS_PRODUCT.interval &&
    data.billing_cycle?.frequency === BACHS_PRODUCT.frequency &&
    validGrantPeriod
  )
}

export function hasActiveEntitlement(subscription, now = Date.now()) {
  if (!subscription || !['trialing', 'active'].includes(subscription.provider_status || subscription.status)) return false
  const periodEnd = Date.parse(subscription.current_period_end)
  return Number.isFinite(periodEnd) && periodEnd > now
}

export function subscriptionEventRank(status) {
  return { trialing: 10, active: 20, past_due: 30, paused: 40, unpaid: 50, canceled: 60 }[status] || 0
}

export function isReusableCheckout(reservation, now = Date.now()) {
  if (!reservation || !['reserved', 'open'].includes(reservation.checkout_state)) return false
  if (!reservation.checkout_expires_at) return reservation.checkout_state === 'reserved'
  const expiresAt = Date.parse(reservation.checkout_expires_at)
  return Number.isFinite(expiresAt) && expiresAt > now
}

export function isValidCheckoutResponse(checkout, now = Date.now()) {
  const expiresAt = Date.parse(checkout?.expires_at)
  let checkoutUrl
  try {
    checkoutUrl = new URL(checkout?.checkout_url)
  } catch {
    return false
  }
  return Boolean(
    typeof checkout?.checkout_id === 'string' && checkout.checkout_id.startsWith('chk_') &&
    checkout.status === 'open' && checkoutUrl.protocol === 'https:' &&
    Number.isFinite(expiresAt) && expiresAt > now
  )
}

export async function cancelBachsSubscriptionImmediately(subscriptionId, reason) {
  try {
    return await bachsRequest(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: 'DELETE',
      body: JSON.stringify({ cancel_at_period_end: false, reason }),
    })
  } catch (error) {
    if (error.status !== 400) throw error
    const current = await bachsRequest(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}`)
    if (current.status !== 'canceled') throw error
    return current
  }
}

export async function subscriptionStatus(userId) {
  const { data, error } = await supabaseAdmin()
    .from('subscriptions')
    .select('provider_subscription_id,status,provider_status,current_period_start,current_period_end,cancel_at_period_end,product_id')
    .eq('user_id', userId)
    .eq('provider', 'bachs')
    .order('updated_at', { ascending: false })
  if (error) throw error
  const subscription = data?.find((item) => hasActiveEntitlement(item)) || data?.[0] || null
  return { active: hasActiveEntitlement(subscription), subscription }
}

export function subscriptionRpcPayload(event, deletedCancelled = false) {
  const data = event.data || {}
  const customerId = data.customer?.customer_id || data.customer?.id || null
  return {
    p_event_id: event.id,
    p_event_type: event.type,
    p_event_created_at: event.created_at,
    p_payload: event,
    p_user_id: data.metadata?.user_id || null,
    p_checkout_id: data.metadata?.checkout_id || null,
    p_subscription_id: data.subscription_id,
    p_customer_id: customerId,
    p_product_id: data.product_id,
    p_amount: data.amount,
    p_currency: data.currency,
    p_provider_status: data.status,
    p_period_start: data.current_period_start || null,
    p_period_end: data.current_period_end || null,
    p_cancel_at_period_end: Boolean(data.cancel_at_period_end),
    p_event_rank: subscriptionEventRank(data.status),
    p_deleted_cancelled: deletedCancelled,
    p_valid_product: validateSubscriptionData(data),
  }
}
