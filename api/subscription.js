import {
  BACHS_PASS,
  bachsRequest,
  isReusableCheckout,
  isValidCheckoutResponse,
  subscriptionStatus,
} from '../server/bachs.js'
import { parseJsonBody, requireMethod, sendJson } from '../server/http.js'
import { authenticatedUser, supabaseAdmin } from '../server/supabaseAdmin.js'

async function startCheckout(user) {
  if (!user.email) return { status: 401, body: { error: 'Sign in to get Premium.' } }
  if ((await subscriptionStatus(user.id)).active) {
    return { status: 409, body: { error: 'Your Premium access is already active.' } }
  }

  const db = supabaseAdmin()
  const { data: reservation, error: reservationError } = await db.rpc('reserve_bachs_checkout', {
    p_user_id: user.id,
    p_product_id: BACHS_PASS.id,
    p_amount: BACHS_PASS.amount,
    p_currency: BACHS_PASS.currency,
  })
  if (reservationError || !reservation?.checkout_reference) {
    throw reservationError || new Error('Could not reserve checkout')
  }
  if (isReusableCheckout(reservation) && reservation.checkout_url) {
    return { status: 200, body: { checkout_url: reservation.checkout_url, checkout_id: reservation.checkout_id } }
  }

  const reference = reservation.checkout_reference
  try {
    const appUrl = (process.env.APP_URL || 'https://naijachow.vercel.app').replace(/\/+$/, '')
    const checkout = await bachsRequest('/v1/checkout-sessions', {
      method: 'POST',
      headers: { 'Idempotency-Key': reference },
      body: JSON.stringify({
        pricing: { amount: BACHS_PASS.amount, currency: BACHS_PASS.currency },
        customer: { email: user.email },
        success_url: `${appUrl}/?subscription=success`,
        cancel_url: `${appUrl}/?subscription=cancelled`,
        reference,
        metadata: { user_id: user.id, purchase: BACHS_PASS.id },
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
    return { status: 200, body: { checkout_url: checkout.checkout_url, checkout_id: checkout.checkout_id } }
  } catch (error) {
    if (error.status >= 400 && error.status < 500 && error.status !== 429) {
      const cleanup = await db.rpc('fail_bachs_checkout', { p_user_id: user.id, p_reference: reference })
      if (cleanup.error) console.error('[Naijachow] checkout cleanup failed:', cleanup.error.message)
    }
    throw error
  }
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET', 'POST'])) return
  try {
    const user = await authenticatedUser(req)
    if (!user) return sendJson(res, 401, { error: 'Sign in to manage Premium access.' })
    if (req.method === 'GET') return sendJson(res, 200, await subscriptionStatus(user.id))

    const action = parseJsonBody(req).action
    const result = action === 'checkout'
      ? await startCheckout(user)
      : { status: 400, body: { error: 'Invalid Premium action.' } }
    return sendJson(res, result.status, result.body)
  } catch (error) {
    console.error('[Naijachow] Premium request failed:', error.message)
    return sendJson(res, error.status >= 400 && error.status < 500 ? error.status : 502, {
      error: 'Could not start the Premium payment. Please try again.',
    })
  }
}
