import { authenticatedUser, supabaseAdmin } from '../server/supabaseAdmin.js'
import { parseJsonBody, requireMethod, sendJson } from '../server/http.js'

const ACTIONS = { approve: 'approved', reject: 'rejected', changes: 'changes_requested' }

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return
  const user = await authenticatedUser(req)
  if (!user) return sendJson(res, 401, { error: 'Sign in to review this import.' })
  const body = parseJsonBody(req)
  const nextStatus = ACTIONS[body.action]
  if (typeof body.importId !== 'string' || !nextStatus) {
    return sendJson(res, 400, { error: 'Invalid review request.' })
  }

  const db = supabaseAdmin()
  const { data: record, error } = await db
    .from('social_imports')
    .select('id,user_id,recipe_id,review_status,processing_status')
    .eq('id', body.importId)
    .eq('user_id', user.id)
    .single()
  if (error || !record) return sendJson(res, 404, { error: 'Import not found.' })
  if (record.processing_status !== 'succeeded') {
    return sendJson(res, 409, { error: 'This import is not ready for review.' })
  }

  const recipeStatus = body.action === 'approve' ? 'approved' : body.action === 'reject' ? 'rejected' : 'needs_review'
  const { error: reviewError } = await db.rpc('review_social_import', {
    p_import_id: record.id,
    p_user_id: user.id,
    p_review_status: nextStatus,
    p_recipe_status: recipeStatus,
    p_reason: typeof body.reason === 'string' ? body.reason : null,
  })
  if (reviewError) return sendJson(res, 409, { error: 'Could not apply this review decision.' })
  return sendJson(res, 200, { review_status: nextStatus })
}
