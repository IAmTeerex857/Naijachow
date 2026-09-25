import { subscriptionStatus } from '../server/bachs.js'
import { requireMethod, sendJson } from '../server/http.js'
import { authenticatedUser } from '../server/supabaseAdmin.js'

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET'])) return
  try {
    const user = await authenticatedUser(req)
    if (!user) return sendJson(res, 401, { error: 'Sign in to view your subscription.' })
    return sendJson(res, 200, await subscriptionStatus(user.id))
  } catch (error) {
    console.error('[NaijaPlate] subscription status failed:', error.message)
    return sendJson(res, 503, { error: 'Could not load subscription status.' })
  }
}
