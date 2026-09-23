/* ===========================================================================
   API client — thin wrappers over the Vercel Functions.
   Contracts mirror NaijaPlate-PRD.md §4. All secrets live server-side.

   Plans come from Azure OpenAI. When that call cannot be made — offline, rate
   limited, a 502 — we fall back to the local builder rather than showing a
   dead end, and mark the result so the UI can say where it came from. A 402
   (premium length) is NOT a failure and is never silently absorbed: the user
   asked for something the free tier does not include and needs to be told.
   =========================================================================== */
import { FOOD_BY_ID, pickMealImageFoodId } from '../data/foods'
import { accessToken } from './supabase'

/** Raised for answers the user must see, rather than quietly work around. */
export class PremiumRequiredError extends Error {
  constructor(message, maxFreeDays) {
    super(message)
    this.name = 'PremiumRequiredError'
    this.maxFreeDays = maxFreeDays
  }
}

export class AuthenticationRequiredError extends Error {
  constructor(message, generated = false) {
    super(message)
    this.name = 'AuthenticationRequiredError'
    this.generated = generated
  }
}

async function authenticatedHeaders() {
  const token = await accessToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function names(ids) {
  return [...ids].map((id) => FOOD_BY_ID[id]?.name || id)
}

/** Generate a full meal plan. Server validation and guest limits must not be bypassed locally. */
export async function generatePlan({ selectedIds, selectedDays, fastingDay, preferences, turnstileToken, signal }) {
  try {
    const res = await fetch('/api/generate-plan', {
      method: 'POST',
      headers: await authenticatedHeaders(),
      body: JSON.stringify({
        selectedIds,
        selectedDays,
        fastingDay,
        preferences,
        turnstileToken: turnstileToken || null,
      }),
      signal,
    })
    const data = await res.json().catch(() => ({}))

    if (res.status === 402) {
      throw new PremiumRequiredError(
        data.error || 'That plan length is a premium feature.',
        data.max_free_days
      )
    }
    if (data.authentication_required) {
      throw new AuthenticationRequiredError(
        data.message || data.error || 'Sign in to view your generated plan.',
        Boolean(data.generated)
      )
    }
    if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
    if (!Array.isArray(data.days) || !data.days.length) throw new Error('Malformed plan')

    return { ...data, source: data.source || 'azure-openai' }
  } catch (err) {
    if (err instanceof PremiumRequiredError || err instanceof AuthenticationRequiredError) throw err
    throw err
  }
}

/** Regenerate a single meal of the same type. Returns one meal object. */
export async function swapMeal({ planId, dayIndex, mealType, currentMealName, otherMealsToday, foodsToAvoid }) {
  try {
    const res = await fetch('/api/swap-meal', {
      method: 'POST',
      headers: await authenticatedHeaders(),
      body: JSON.stringify({
        planId,
        dayIndex,
        mealType,
        currentCandidateKey: currentMealName,
        otherCandidateKeys: otherMealsToday,
        foodsToAvoid,
      }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.name) throw new Error(data.error || `Error ${res.status}`)
    return data
  } catch (err) {
    throw err
  }
}

export async function claimGeneratedPlan() {
  const token = await accessToken()
  if (!token) throw new AuthenticationRequiredError('Sign in to claim your plan.')
  const res = await fetch('/api/claim-plan', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.plan) {
    const error = new Error(data.error || 'Could not claim your plan.')
    error.status = res.status
    throw error
  }
  return { ...data.plan, planId: data.planId, selectedIds: data.selectedIds || [] }
}

/* --- Image fetching -------------------------------------------------------
   Always resolves (never throws) → { url, credit, source }. On any failure
   url is null and the caller shows the stripe placeholder.

   The cache stores the in-flight PROMISE, not the settled result: sixty dish
   cards mount at once and several meals resolve to the same hero photo, so
   caching results alone let duplicate requests race past each other. */
const imgCache = new Map()

function fetchImage(key) {
  if (imgCache.has(key)) return imgCache.get(key)

  const pending = (async () => {
    try {
      const res = await fetch(`/api/get-food-image?q=${encodeURIComponent(key)}`)
      const d = await res.json()
      return { url: d.url || null, credit: d.credit || '', source: d.source || 'none' }
    } catch {
      return { url: null, credit: '', source: 'none' }
    }
  })()

  imgCache.set(key, pending)
  return pending
}

/** Image for a dish card. Cache key: `food:<id>`. */
export function fetchFoodImage(food) {
  return fetchImage(`food:${food.id}`)
}

/** Image for a plated meal combo. Tries the curated/auto-fetched `dish:<key>`
    image first; if that's missing, falls back to the curated photo of the
    meal's main component so a real image still shows. */
export async function fetchMealImage(meal) {
  const key = meal.dish_key || (meal.name || '').toLowerCase()
  if (key) {
    const primary = await fetchImage(`dish:${key}`)
    if (primary.url) return primary
  }

  const heroId = pickMealImageFoodId(meal)
  if (heroId) {
    const hero = await fetchImage(`food:${heroId}`)
    if (hero.url) return hero
  }
  return { url: null, credit: '', source: 'none' }
}

export { names as dishNames }
