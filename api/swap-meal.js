import { resolveSelectedFoods } from '../server/catalogue.js'
import { buildCandidates, excludeAvoidedCandidates, materializeMeal } from '../server/combinations.js'
import { MODEL_MEAL_JSON_SCHEMA, modelMealSchema, swapRequestSchema } from '../server/contracts.js'
import { generateStructuredJson } from '../server/azureOpenAI.js'
import { parseJsonBody, requireMethod, sendJson } from '../server/http.js'
import { authenticatedUser, supabaseAdmin } from '../server/supabaseAdmin.js'
import { consumeRateLimit, releaseRateLimit } from '../server/rateLimit.js'
import { loadApprovedComboCandidates } from '../server/approvedCombos.js'
import { candidatesForSlot, swapCandidates } from '../server/planPolicy.js'

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return
  const user = await authenticatedUser(req)
  if (!user) return sendJson(res, 401, { error: 'Sign in to swap meals.' })
  let input
  try {
    input = swapRequestSchema.parse(parseJsonBody(req))
  } catch {
    return sendJson(res, 400, { error: 'Invalid meal-swap request.' })
  }
  const db = supabaseAdmin()
  const { data: storedPlan, error: planError } = await db
    .from('meal_plans')
    .select('id,selected_dish_ids,plan_data,updated_at')
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

  const [{ data: healthProfile, error: healthError }, { data: preferences, error: preferencesError }] = await Promise.all([
    db.from('health_profiles').select('allergies,intolerances,excluded_foods').eq('user_id', user.id).maybeSingle(),
    db.from('user_preferences').select('disliked_foods').eq('user_id', user.id).maybeSingle(),
  ])
  if (healthError || preferencesError) {
    return sendJson(res, 503, { error: 'Could not verify your saved food exclusions.' })
  }
  const storedExclusions = [
    ...(healthProfile?.allergies || []),
    ...(healthProfile?.intolerances || []),
    ...(healthProfile?.excluded_foods || []),
    ...(preferences?.disliked_foods || []),
  ].join(',')

  let approved = []
  try {
    approved = (await loadApprovedComboCandidates(storedPlan.selected_dish_ids))[input.mealType] || []
  } catch (error) {
    console.error('[Naijachow] approved combo lookup failed:', error.message)
  }
  const eligibleCandidates = candidatesForSlot(excludeAvoidedCandidates(
    [...approved, ...buildCandidates(storedPlan.selected_dish_ids, input.mealType)],
    storedExclusions
  ), input.mealType)
  const usedKeys = new Set((storedPlan.plan_data?.days || []).flatMap((day) =>
    ['breakfast', 'lunch', 'dinner'].map((type) => {
      const meal = day[type]
      return meal?.food_ids?.join('+') || meal?.dish_key
    }).filter(Boolean)
  ))
  const sameDayMeals = ['breakfast', 'lunch', 'dinner']
    .filter((type) => type !== input.mealType)
    .map((type) => storedDay[type])
    .filter(Boolean)
  const history = Array.isArray(storedMeal.swap_history) ? storedMeal.swap_history : []
  const candidates = swapCandidates(eligibleCandidates, { currentMeal: storedMeal, sameDayMeals, history, usedKeys })
  if (!candidates.length) return sendJson(res, 409, { error: 'No different realistic meal is available.' })

  try {
    if (!(await consumeRateLimit('swap', user.id, 120))) {
      return sendJson(res, 429, { error: 'Too many swaps. Please wait and try again.' })
    }
  } catch {
    return sendJson(res, 503, { error: 'Could not verify the request limit.' })
  }

  try {
    const raw = await generateStructuredJson({
      prompt: `Use exactly this candidate_key for ${input.mealType}: ${JSON.stringify(candidates[0])}. Add concise Nigerian serving context and approximate nutrition for one normal serving.`,
      schemaName: 'naijaplate_meal_swap',
      schema: MODEL_MEAL_JSON_SCHEMA,
      maxTokens: 700,
      timeoutMs: 25_000,
    })
    const modelMeal = modelMealSchema.parse(raw)
    const candidate = candidates[0]
    if (modelMeal.candidate_key !== candidate.key) throw new Error('Changed assigned swap candidate')
    const meal = {
      ...materializeMeal(candidate, modelMeal),
      swap_history: [...history, input.currentCandidateKey],
    }
    const planData = structuredClone(storedPlan.plan_data)
    planData.days[input.dayIndex][input.mealType] = meal
    planData.days[input.dayIndex].total_calories = ['breakfast', 'lunch', 'dinner', 'snack'].reduce(
      (sum, type) => sum + (Number(planData.days[input.dayIndex][type]?.calories) || 0),
      0
    )
    const { data: updated, error: updateError } = await db
      .from('meal_plans')
      .update({ plan_data: planData })
      .eq('id', storedPlan.id)
      .eq('user_id', user.id)
      .eq('updated_at', storedPlan.updated_at)
      .select('id')
      .maybeSingle()
    if (updateError) throw updateError
    if (!updated) return sendJson(res, 409, { error: 'This meal changed during the swap. Reopen the plan and try again.' })
    return sendJson(res, 200, meal)
  } catch (error) {
    console.error('[Naijachow] meal swap failed:', error.message)
    await releaseRateLimit('swap', user.id).catch(() => {})
    return sendJson(res, 502, { error: 'Could not produce a valid meal swap. Please try again.' })
  }
}
