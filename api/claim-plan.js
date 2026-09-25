import { authenticatedUser, supabaseAdmin } from '../server/supabaseAdmin.js'
import { getGuestToken, guestTokenHash } from '../server/guestSession.js'
import { requireMethod, sendJson } from '../server/http.js'

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return
  const user = await authenticatedUser(req)
  if (!user) return sendJson(res, 401, { error: 'Sign in to view this plan.' })
  const token = getGuestToken(req)
  if (!token) return sendJson(res, 404, { error: 'No generated plan is waiting to be claimed.' })

  const { data, error } = await supabaseAdmin().rpc('claim_guest_plan_for_user', {
    p_token_hash: guestTokenHash(token),
    p_user_id: user.id,
  })
  if (error) {
    console.error('[Naijachow] plan claim failed:', error.message)
    return sendJson(res, 409, { error: 'This plan is no longer available to claim.' })
  }
  return sendJson(res, 200, data)
}
