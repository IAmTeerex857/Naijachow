import {
  BACHS_PRODUCT,
  bachsProductId,
  bachsRequest,
  isReusableCheckout,
  isValidCheckoutResponse,
  subscriptionStatus,
} from '../server/bachs.js'
import { requireMethod, sendJson } from '../server/http.js'
import { authenticatedUser, supabaseAdmin } from '../server/supabaseAdmin.js'

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return
  let user
  let reservation
  try {
    user = await authenticatedUser(req)
    if (!user?.email) return sendJson(res, 401, { error: 'Sign in to subscribe.' })
    if ((await subscriptionStatus(user.id)).active) {
      return sendJson(res, 409, { error: 'Your Premium subscription is already active.' })
    }
    const db = supabaseAdmin()
    const { data, error: reservationError } = await db.rpc('reserve_bachs_checkout', {
      p_user_id: user.id,
      p_product_id: bachsProductId(),
      p_amount: BACHS_PRODUCT.amount,
      p_currency: BACHS_PRODUCT.currency,
    })
    reservation = data
    if (reservationError || !reservation?.checkout_reference) {
      throw reservationError || new Error('Could not reserve checkout')
    }
    if (isReusableCheckout(reservation) && reservation.checkout_url) {
      return sendJson(res, 200, { checkout_url: reservation.checkout_url })
    }
    const reference = reservation.checkout_reference
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
    return sendJson(res, 200, { checkout_url: checkout.checkout_url })
  } catch (error) {
    if (user && reservation?.checkout_reference && error.status >= 400 && error.status < 500 && error.status !== 429) {
      await supabaseAdmin().rpc('fail_bachs_checkout', {
        p_user_id: user.id,
        p_reference: reservation.checkout_reference,
      }).catch(() => {})
    }
    console.error('[NaijaPlate] Bachs checkout failed:', error.message)
    return sendJson(res, error.status >= 400 && error.status < 500 ? error.status : 502, {
      error: 'Could not start checkout. Please try again.',
    })
  }
}
