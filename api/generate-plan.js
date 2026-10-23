import { randomUUID } from 'node:crypto'
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
import { subscriptionStatus } from '../server/bachs.js'
import { buildSchedule, chunkSchedule } from '../server/planSchedule.js'
import { addFruitToPlan, assignMealCandidates, candidatesForSlot } from '../server/planPolicy.js'
import { mealNutrition } from '../server/mealNutrition.js'

const MAX_FREE_DAYS = 7
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner']

function assignedMeals(schedule, candidates) {
  const meals = new Map()
  for (const day of schedule) {
    for (const type of MEAL_TYPES) {
      const candidate = candidates[type].find((item) => item.key === day[`${type}_key`])
      if (candidate) meals.set(candidate.key, { key: candidate.key, name: candidate.name, serving: mealNutrition(candidate.food_ids).serving })
    }
  }
  return [...meals.values()]
}

function generationPrompt(schedule, candidates, preferences) {
  return `Build this exact schedule: ${JSON.stringify(schedule)}.
For each non fasting meal, use the breakfast_key, lunch_key, and dinner_key assigned in the schedule as its candidate_key. Never substitute or create a key. The server has already assigned meals for variety and meal-family compatibility.

Assigned meals and their portions: ${JSON.stringify(assignedMeals(schedule, candidates))}
For each meal write a one or two sentence description of how it is served, consistent with the stated portion. The server supplies nutrition.

User planning context: ${JSON.stringify({
    goal: preferences.goal,
    conditions: preferences.conditions,
    foodsToAvoid: preferences.foodsToAvoid,
    clinicianInstructions: preferences.clinicianInstructions,
    householdSize: preferences.householdSize,
    maxCookingMinutes: preferences.maxCookingMinutes,
  })}

Use the planning context only for neutral serving descriptions. Avoided foods have already been filtered by the server. Do not diagnose, promise treatment, claim suitability for a condition, or add medical advice.
Do not use em dash or en dash characters in any text.

For fasting days, return null for breakfast, lunch, and dinner.`
}

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return

  let input
  try {
    input = generateRequestSchema.parse(parseJsonBody(req))
  } catch {
    return sendJson(res, 400, { error: 'Invalid meal-plan request.' })
  }

  if (input.fastingDay && input.preferences.conditions.some((condition) =>
    ['diabetes', 'kidney_condition', 'pregnancy'].includes(condition)
  )) {
    return sendJson(res, 422, {
      error: 'Fasting plans are not available with the selected health considerations. Follow advice from your clinician.',
    })
  }

  const selectedFoods = resolveSelectedFoods(input.selectedIds)
  if (!selectedFoods) return sendJson(res, 400, { error: 'Select at least three valid dishes.' })
  let user
  let guest
  let guestRateIdentity
  try {
    user = await authenticatedUser(req)
    if (input.selectedDays > MAX_FREE_DAYS) {
      const premium = user && (await subscriptionStatus(user.id)).active
      if (!premium) {
        return sendJson(res, 402, {
          error: `Plans for ${input.selectedDays} days require active Premium access.`,
          premium_required: true,
          max_free_days: MAX_FREE_DAYS,
        })
      }
    }
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
    if (user) await releaseRateLimit('generation-user', user.id).catch(() => {})
    if (!user && guestRateIdentity) await releaseRateLimit('generation-guest', guestRateIdentity).catch(() => {})
    console.error('[Naijachow] generation reservation failed:', error.message)
    return sendJson(res, 503, { error: 'Could not reserve this generation. Please try again.' })
  }

  let rawCandidates = candidateMap(input.selectedIds)
  try {
    rawCandidates = mergeCandidateMaps(rawCandidates, await loadApprovedComboCandidates(input.selectedIds))
  } catch (error) {
    console.error('[Naijachow] approved combo lookup failed:', error.message)
  }
  const candidates = Object.fromEntries(
    Object.entries(rawCandidates).map(([type, values]) => [
      type,
      candidatesForSlot(excludeAvoidedCandidates(values, input.preferences.foodsToAvoid), type),
    ])
  )
  const unavailable = MEAL_TYPES.filter((type) => candidates[type].length === 0)
  if (unavailable.length) {
    await releaseGuestReservation(guest?.id)
    if (user) await releaseRateLimit('generation-user', user.id).catch(() => {})
    if (!user && guestRateIdentity) await releaseRateLimit('generation-guest', guestRateIdentity).catch(() => {})
    return sendJson(res, 422, {
      error: `Your selection cannot make a realistic ${unavailable.join(', ')}. Add a breakfast food, or pair a carb with protein or soup with swallow.`,
    })
  }

  const schedule = buildSchedule(input.selectedDays, input.fastingDay, input.fasting_type)
  let assignedSchedule
  try {
    assignedSchedule = assignMealCandidates(schedule, candidates, randomUUID())
  } catch (error) {
    await releaseGuestReservation(guest?.id)
    if (user) await releaseRateLimit('generation-user', user.id).catch(() => {})
    if (!user && guestRateIdentity) await releaseRateLimit('generation-guest', guestRateIdentity).catch(() => {})
    return sendJson(res, 422, { error: 'The available meals cannot satisfy the variety rules. Add more dish choices.' })
  }

  try {
    const parsedChunks = await Promise.all(chunkSchedule(assignedSchedule).map(async (scheduledDays, index) => {
      const raw = await generateStructuredJson({
        prompt: generationPrompt(scheduledDays, candidates, input.preferences),
        schemaName: `naijaplate_meal_plan_${index + 1}`,
        schema: MODEL_PLAN_JSON_SCHEMA,
        maxTokens: 4000,
      })
      const parsed = modelPlanSchema.parse(raw)
      if (parsed.days.length !== scheduledDays.length) throw new Error('Wrong chunk day count')
      return parsed.days
    }))
    const generatedDays = parsedChunks.flat()
    if (generatedDays.length !== schedule.length) throw new Error('Wrong day count')

    const days = generatedDays.map((day, index) => {
      const expected = assignedSchedule[index]
      if (day.is_fasting !== expected.is_fasting) throw new Error('Invalid fasting schedule')
      const result = {
        day: expected.day,
        is_fasting: expected.is_fasting,
        ...(expected.fasting_message ? { fasting_message: expected.fasting_message } : {}),
        ...(expected.scripture ? { scripture: expected.scripture } : {}),
      }
      for (const type of MEAL_TYPES) {
        if (expected.is_fasting) {
          if (day[type] !== null) throw new Error('Fasting day contains meals')
          continue
        }
        if (day[type]?.candidate_key !== expected[`${type}_key`]) throw new Error(`Changed assigned ${type} candidate`)
        const candidate = candidates[type].find((item) => item.key === expected[`${type}_key`])
        if (!candidate) throw new Error(`Unapproved ${type} candidate`)
        result[type] = materializeMeal(candidate, day[type])
      }
      result.total_calories = MEAL_TYPES.reduce((sum, type) => sum + (result[type]?.calories || 0), 0)
      return result
    })
    const plan = {
      days: addFruitToPlan(days, input.selectedIds, input.preferences.foodsToAvoid),
      source: 'azure-openai',
      fasting_type: input.fasting_type,
    }
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
    console.error('[Naijachow] plan generation failed:', error.message)
    await releaseGuestReservation(guest?.id)
    if (user) await releaseRateLimit('generation-user', user.id).catch(() => {})
    if (!user && guestRateIdentity) await releaseRateLimit('generation-guest', guestRateIdentity).catch(() => {})
    return sendJson(res, 502, { error: 'Could not generate a valid meal plan. Please try again.' })
  }
}
