import {
  BACHS_PRODUCT,
  bachsProductId,
  bachsRequest,
  isReusableCheckout,
  isValidCheckoutResponse,
  subscriptionStatus,
} from '../server/bachs.js'
import { parseJsonBody, requireMethod, sendJson } from '../server/http.js'
import { authenticatedUser, supabaseAdmin } from '../server/supabaseAdmin.js'

async function startCheckout(user) {
  if (!user.email) return { status: 401, body: { error: 'Sign in to subscribe.' } }
  if ((await subscriptionStatus(user.id)).active) {
    return { status: 409, body: { error: 'Your Premium subscription is already active.' } }
  }

  const db = supabaseAdmin()
  const { data: reservation, error: reservationError } = await db.rpc('reserve_bachs_checkout', {
    p_user_id: user.id,
    p_product_id: bachsProductId(),
    p_amount: BACHS_PRODUCT.amount,
    p_currency: BACHS_PRODUCT.currency,
  })
  if (reservationError || !reservation?.checkout_reference) {
    throw reservationError || new Error('Could not reserve checkout')
  }
  if (isReusableCheckout(reservation) && reservation.checkout_url) {
    return { status: 200, body: { checkout_url: reservation.checkout_url } }
  }

  const reference = reservation.checkout_reference
  try {
    const appUrl = (process.env.APP_URL || 'https://naijachow.vercel.app').replace(/\/+$/, '')
    const checkout = await bachsRequest('/v1/checkout-sessions', {
      method: 'POST',
      headers: { 'Idempotency-Key': reference },
      body: JSON.stringify({
        product_cart: [{ product_id: bachsProductId(), quantity: 1 }],
        customer: { email: user.email },
        success_url: `${appUrl}/?subscription=success`,
        cancel_url: `${appUrl}/?subscription=cancelled`,
        reference,
        metadata: { user_id: user.id, product: BACHS_PRODUCT.name },
        expires_in_minutes: 60,
      }),
    })
    if (!isValidCheckoutResponse(checkout)) throw new Error('Bachs returned an invalid checkout session')
    const { data: finalized, error: finalizeError } = await db.rpc('finalize_bachs_checkout', {
      p_user_id: user.id,
      p_reference: reference,
      p_checkout_id: checkout.checkout_id,
      p_checkout_url: checkout.checkout_url,
      p_expires_at: checkout.expires_at,
    })
    if (finalizeError || !finalized) throw finalizeError || new Error('Checkout reservation is no longer valid')
    return { status: 200, body: { checkout_url: checkout.checkout_url } }
  } catch (error) {
    if (error.status >= 400 && error.status < 500 && error.status !== 429) {
      await db.rpc('fail_bachs_checkout', { p_user_id: user.id, p_reference: reference }).catch(() => {})
    }
    throw error
  }
}

async function cancelSubscription(user) {
  const { subscription } = await subscriptionStatus(user.id)
  if (!subscription?.provider_subscription_id || !['trialing', 'active'].includes(subscription.provider_status)) {
    return { status: 409, body: { error: 'No active subscription can be cancelled.' } }
  }
  await bachsRequest(`/v1/subscriptions/${encodeURIComponent(subscription.provider_subscription_id)}`, {
    method: 'DELETE',
    body: JSON.stringify({ cancel_at_period_end: true, reason: 'Customer requested' }),
  })
  return {
    status: 202,
    body: { message: 'Cancellation requested. Access continues through the current period.' },
  }
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return
  try {
    const user = await authenticatedUser(req)
    if (!user) return sendJson(res, 401, { error: 'Sign in to manage your subscription.' })
    if (req.method === 'GET') return sendJson(res, 200, await subscriptionStatus(user.id))

    const action = parseJsonBody(req).action
    const result = action === 'checkout'
      ? await startCheckout(user)
      : action === 'cancel'
        ? await cancelSubscription(user)
        : { status: 400, body: { error: 'Invalid subscription action.' } }
    return sendJson(res, result.status, result.body)
  } catch (error) {
    console.error('[NaijaPlate] subscription request failed:', error.message)
    return sendJson(res, error.status >= 400 && error.status < 500 ? error.status : 502, {
      error: 'Could not manage your subscription. Please try again.',
    })
  }
}
