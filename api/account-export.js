import { authenticatedUser, supabaseAdmin } from '../server/supabaseAdmin.js'
import { requireMethod, sendJson } from '../server/http.js'

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['GET'])) return
  const user = await authenticatedUser(req)
  if (!user) return sendJson(res, 401, { error: 'Sign in to export your data.' })
  const db = supabaseAdmin()
  const queries = await Promise.all([
    db.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
    db.from('user_preferences').select('*').eq('user_id', user.id).maybeSingle(),
    db.from('health_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    db.from('meal_plans').select('*').eq('user_id', user.id),
    db.from('recipes').select('*').eq('owner_id', user.id),
    db.from('social_imports').select('*').eq('user_id', user.id),
    db.from('subscriptions').select('*').eq('user_id', user.id),
    db.from('generation_jobs').select('*').eq('user_id', user.id),
    db.from('social_import_review_events').select('*').eq('user_id', user.id),
    db.from('assets').select('*').eq('owner_id', user.id),
  ])
  if (queries.some((result) => result.error)) {
    return sendJson(res, 500, { error: 'Could not prepare your export.' })
  }
  res.setHeader('Content-Disposition', 'attachment; filename="naijaplate-data.json"')
  return sendJson(res, 200, {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, createdAt: user.created_at },
    profile: queries[0].data,
    preferences: queries[1].data,
    healthProfile: queries[2].data,
    mealPlans: queries[3].data,
    recipes: queries[4].data,
    socialImports: queries[5].data,
    subscriptions: queries[6].data,
    generationJobs: queries[7].data,
    socialImportReviewEvents: queries[8].data,
    assets: queries[9].data,
  })
}
