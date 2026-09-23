import { z } from 'zod'
import { authenticatedUser, supabaseAdmin } from '../server/supabaseAdmin.js'
import { parseJsonBody, requireMethod, sendJson } from '../server/http.js'

const ingredient = z.object({ item: z.string().trim().min(1).max(200), quantity: z.string().trim().max(100).nullable() }).strict()
const requestSchema = z.object({
  recipeId: z.string().uuid(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(500),
  ingredients: z.array(ingredient).max(100),
  steps: z.array(z.string().trim().min(1).max(1000)).max(50),
}).strict()

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['PATCH'])) return
  const user = await authenticatedUser(req)
  if (!user) return sendJson(res, 401, { error: 'Sign in to edit this recipe.' })
  let input
  try {
    input = requestSchema.parse(parseJsonBody(req))
  } catch {
    return sendJson(res, 400, { error: 'Check the recipe fields and try again.' })
  }

  const { recipeId, ...updates } = input
  const { data, error } = await supabaseAdmin()
    .from('recipes')
    .update({ ...updates, status: 'needs_review' })
    .eq('id', recipeId)
    .eq('owner_id', user.id)
    .select('id,title,description,ingredients,steps,status')
    .maybeSingle()
  if (error) return sendJson(res, 500, { error: 'Could not save the recipe.' })
  if (!data) return sendJson(res, 404, { error: 'Recipe not found.' })
  return sendJson(res, 200, { recipe: data })
}
