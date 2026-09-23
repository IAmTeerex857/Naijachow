import { resolveSelectedFoods } from '../server/catalogue.js'
import { candidateMap, excludeAvoidedCandidates, materializeMeal, mergeCandidateMaps } from '../server/combinations.js'
import { generateRequestSchema, MODEL_PLAN_JSON_SCHEMA, modelPlanSchema } from '../server/contracts.js'
import { generateStructuredJson } from '../server/azureOpenAI.js'
import { clientIp, parseJsonBody, requireMethod, sendJson } from '../server/http.js'
import { authenticatedUser } from '../server/supabaseAdmin.js'
import {
  releaseGuestReservation,
  reserveGuestGeneration,
  saveGeneratedPlan,
} from '../server/guestSession.js'
import { verifyTurnstile } from '../server/turnstile.js'
import { consumeRateLimit, releaseRateLimit } from '../server/rateLimit.js'
import { loadApprovedComboCandidates } from '../server/approvedCombos.js'

const MAX_FREE_DAYS = 7
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner']

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return

  let input
  try {
    input = generateRequestSchema.parse(parseJsonBody(req))
  } catch {
    return sendJson(res, 400, { error: 'Invalid meal-plan request.' })
  }

  const selectedFoods = resolveSelectedFoods(input.selectedIds)
  if (!selectedFoods) return sendJson(res, 400, { error: 'Select at least three valid dishes.' })
  if (input.selectedDays > MAX_FREE_DAYS) {
    return sendJson(res, 402, {
      error: `${input.selectedDays}-day plans are a premium feature.`,
      premium_required: true,
      max_free_days: MAX_FREE_DAYS,
    })
  }

  let rawCandidates = candidateMap(input.selectedIds)
  try {
    rawCandidates = mergeCandidateMaps(
      rawCandidates,
      await loadApprovedComboCandidates(input.selectedIds)
    )
  } catch (error) {
    console.error('[NaijaPlate] approved combo lookup failed:', error.message)
  }
  const candidates = Object.fromEntries(
    Object.entries(rawCandidates).map(([type, values]) => [
      type,
      excludeAvoidedCandidates(values, input.preferences.foodsToAvoid),
    ])
  )
  const unavailable = MEAL_TYPES.filter((type) => candidates[type].length === 0)
  if (unavailable.length) {
    return sendJson(res, 422, {
      error: `Your selection cannot make a realistic ${unavailable.join(', ')}. Add a breakfast food, or pair a carb with protein or soup with swallow.`,
    })
  }

  let user
  let guest
  let guestRateIdentity
  try {
    user = await authenticatedUser(req)
    if (!user && !(await verifyTurnstile(input.turnstileToken, clientIp(req)))) {
      return sendJson(res, 403, { error: 'Please complete the security check and try again.' })
    }
    const allowed = user
      ? await consumeRateLimit('generation-user', user.id, 60)
      : await consumeRateLimit('generation-guest', (guestRateIdentity = clientIp(req)), 1, 30 * 24 * 60 * 60)
    if (!allowed) {
      return sendJson(res, 429, { error: 'Too many requests. Please wait and try again.' })
    }
    if (!user) {
      guest = await reserveGuestGeneration(req, res)
      if (!guest) {
        await releaseRateLimit('generation-guest', guestRateIdentity).catch(() => {})
        return sendJson(res, 403, {
          error: 'Your free generation has been used. Sign in to continue.',
          authentication_required: true,
        })
      }
    }
  } catch (error) {
    if (!user && guestRateIdentity) await releaseRateLimit('generation-guest', guestRateIdentity).catch(() => {})
    console.error('[NaijaPlate] generation reservation failed:', error.message)
    return sendJson(res, 503, { error: 'Could not reserve this generation. Please try again.' })
  }

  const schedule = Array.from({ length: input.selectedDays }, (_, index) => ({
    day: `Day ${index + 1} — ${WEEKDAYS[index]}`,
    is_fasting: input.fastingDay === WEEKDAYS[index],
  }))
  const prompt = `Build this exact schedule: ${JSON.stringify(schedule)}.
For each non-fasting meal, select one candidate_key from the corresponding approved list below. Never create a new key. Prefer variety and do not repeat a candidate more than twice unless the list leaves no alternative.

Approved breakfast candidates: ${JSON.stringify(candidates.breakfast)}
Approved lunch candidates: ${JSON.stringify(candidates.lunch)}
Approved dinner candidates: ${JSON.stringify(candidates.dinner)}

User planning context: ${JSON.stringify({
    goal: input.preferences.goal,
    conditions: input.preferences.conditions,
    foodsToAvoid: input.preferences.foodsToAvoid,
    clinicianInstructions: input.preferences.clinicianInstructions,
    householdSize: input.preferences.householdSize,
    budgetLevel: input.preferences.budgetLevel,
    maxCookingMinutes: input.preferences.maxCookingMinutes,
  })}

Treat stated allergies, avoidances, and clinician instructions as hard constraints. Do not diagnose, promise treatment, or add medical claims. If an approved candidate conflicts with a hard constraint, do not select it.

For fasting days, return null for breakfast, lunch, and dinner. Nutrition values are approximate values for one normal serving.`

  try {
    const raw = await generateStructuredJson({
      prompt,
      schemaName: 'naijaplate_meal_plan',
      schema: MODEL_PLAN_JSON_SCHEMA,
      maxTokens: 4000,
    })
    const parsed = modelPlanSchema.parse(raw)
    if (parsed.days.length !== schedule.length) throw new Error('Wrong day count')

    const days = parsed.days.map((day, index) => {
      const expected = schedule[index]
      if (day.is_fasting !== expected.is_fasting) throw new Error('Invalid fasting schedule')
      const result = { day: expected.day, is_fasting: expected.is_fasting }
      for (const type of MEAL_TYPES) {
        if (expected.is_fasting) {
          if (day[type] !== null) throw new Error('Fasting day contains meals')
          continue
        }
        const candidate = candidates[type].find((item) => item.key === day[type]?.candidate_key)
        if (!candidate) throw new Error(`Unapproved ${type} candidate`)
        result[type] = materializeMeal(candidate, day[type])
      }
      result.total_calories = MEAL_TYPES.reduce((sum, type) => sum + (result[type]?.calories || 0), 0)
      return result
    })
    const plan = { days, source: 'azure-openai' }
    const planId = await saveGeneratedPlan({ user, guestId: guest?.id, input, plan })
    if (!user) {
      return sendJson(res, 202, {
        authentication_required: true,
        generated: true,
        message: 'Your plan is ready. Sign in by email to view it.',
      })
    }
    return sendJson(res, 200, { ...plan, planId })
  } catch (error) {
    console.error('[NaijaPlate] plan generation failed:', error.message)
    await releaseGuestReservation(guest?.id)
    if (!user && guestRateIdentity) await releaseRateLimit('generation-guest', guestRateIdentity).catch(() => {})
    return sendJson(res, 502, { error: 'Could not generate a valid meal plan. Please try again.' })
  }
}
