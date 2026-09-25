import { resolveSelectedFoods } from '../server/catalogue.js'
import { buildCandidates, excludeAvoidedCandidates, materializeMeal } from '../server/combinations.js'
import { MODEL_MEAL_JSON_SCHEMA, modelMealSchema, swapRequestSchema } from '../server/contracts.js'
import { generateStructuredJson } from '../server/azureOpenAI.js'
import { parseJsonBody, requireMethod, sendJson } from '../server/http.js'
import { authenticatedUser, supabaseAdmin } from '../server/supabaseAdmin.js'
import { consumeRateLimit } from '../server/rateLimit.js'
import { loadApprovedComboCandidates } from '../server/approvedCombos.js'

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return
  const user = await authenticatedUser(req)
  if (!user) return sendJson(res, 401, { error: 'Sign in to swap meals.' })
  try {
    if (!(await consumeRateLimit('swap', user.id, 120))) {
      return sendJson(res, 429, { error: 'Too many swaps. Please wait and try again.' })
    }
  } catch {
    return sendJson(res, 503, { error: 'Could not verify the request limit.' })
  }

  let input
  try {
    input = swapRequestSchema.parse(parseJsonBody(req))
  } catch {
    return sendJson(res, 400, { error: 'Invalid meal-swap request.' })
  }
  const db = supabaseAdmin()
  const { data: storedPlan, error: planError } = await db
    .from('meal_plans')
    .select('id,selected_dish_ids,plan_data')
    .eq('id', input.planId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (planError || !storedPlan) return sendJson(res, 404, { error: 'Meal plan not found.' })
  if (!resolveSelectedFoods(storedPlan.selected_dish_ids)) {
    return sendJson(res, 409, { error: 'This meal plan has invalid dish data.' })
  }
  const storedDay = storedPlan.plan_data?.days?.[input.dayIndex]
  const storedMeal = storedDay?.[input.mealType]
  const storedKey = storedMeal?.food_ids?.join('+') || storedMeal?.dish_key
  if (!storedMeal || storedKey !== input.currentCandidateKey) {
    return sendJson(res, 409, { error: 'This meal changed before the swap completed. Refresh and try again.' })
  }

  let approved = []
  try {
    approved = (await loadApprovedComboCandidates(storedPlan.selected_dish_ids))[input.mealType]
  } catch (error) {
    console.error('[Naijachow] approved combo lookup failed:', error.message)
  }
  const candidates = excludeAvoidedCandidates(
    [...approved, ...buildCandidates(storedPlan.selected_dish_ids, input.mealType)],
    input.foodsToAvoid
  ).filter(
    (candidate) => candidate.key !== input.currentCandidateKey && !input.otherCandidateKeys.includes(candidate.key)
  )
  if (!candidates.length) return sendJson(res, 409, { error: 'No different realistic meal is available.' })

  try {
    const raw = await generateStructuredJson({
      prompt: `Choose exactly one candidate_key for ${input.mealType} from this approved list: ${JSON.stringify(candidates)}. Add concise Nigerian serving context and approximate nutrition for one normal serving.`,
      schemaName: 'naijaplate_meal_swap',
      schema: MODEL_MEAL_JSON_SCHEMA,
      maxTokens: 700,
      timeoutMs: 25_000,
    })
    const modelMeal = modelMealSchema.parse(raw)
    const candidate = candidates.find((item) => item.key === modelMeal.candidate_key)
    if (!candidate) throw new Error('Unapproved swap candidate')
    const meal = materializeMeal(candidate, modelMeal)
    const planData = structuredClone(storedPlan.plan_data)
    planData.days[input.dayIndex][input.mealType] = meal
    planData.days[input.dayIndex].total_calories = ['breakfast', 'lunch', 'dinner'].reduce(
      (sum, type) => sum + (Number(planData.days[input.dayIndex][type]?.calories) || 0),
      0
    )
    const { data: updated, error: updateError } = await db
      .from('meal_plans')
      .update({ plan_data: planData })
      .eq('id', storedPlan.id)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle()
    if (updateError || !updated) throw new Error('Could not persist meal swap')
    return sendJson(res, 200, meal)
  } catch (error) {
    console.error('[Naijachow] meal swap failed:', error.message)
    return sendJson(res, 502, { error: 'Could not produce a valid meal swap. Please try again.' })
  }
}
