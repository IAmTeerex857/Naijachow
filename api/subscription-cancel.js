import { bachsRequest, subscriptionStatus } from '../server/bachs.js'
import { requireMethod, sendJson } from '../server/http.js'
import { authenticatedUser } from '../server/supabaseAdmin.js'

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return
  try {
    const user = await authenticatedUser(req)
    if (!user) return sendJson(res, 401, { error: 'Sign in to manage your subscription.' })
    const { subscription } = await subscriptionStatus(user.id)
    if (!subscription?.provider_subscription_id || !['trialing', 'active'].includes(subscription.provider_status)) {
      return sendJson(res, 409, { error: 'No active subscription can be cancelled.' })
    }
    await bachsRequest(`/v1/subscriptions/${encodeURIComponent(subscription.provider_subscription_id)}`, {
      method: 'DELETE',
      body: JSON.stringify({ cancel_at_period_end: true, reason: 'Customer requested' }),
    })
    return sendJson(res, 202, { message: 'Cancellation requested. Access continues through the current period.' })
  } catch (error) {
    console.error('[NaijaPlate] Bachs cancellation failed:', error.message)
    return sendJson(res, error.status >= 400 && error.status < 500 ? error.status : 502, {
      error: 'Could not cancel the subscription. Please try again.',
    })
  }
}
