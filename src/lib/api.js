/* ===========================================================================
   API client — thin wrappers over the Netlify Functions.
   Contracts mirror NaijaPlate-PRD.md §4. All secrets live server-side.
   =========================================================================== */
import { pickMealImageFoodId } from '../data/foods'

/** Generate a full meal plan. */
export async function generatePlan({ selectedFoods, selectedDays, fastingDay }) {
  const res = await fetch('/api/generate-plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedFoods, selectedDays, fastingDay }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

/** Regenerate a single meal of the same type. Returns one meal object. */
export async function swapMeal({ selectedFoods, mealType, currentMealName, otherMealsToday }) {
  const res = await fetch('/api/swap-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ selectedFoods, mealType, currentMealName, otherMealsToday }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

/* --- Image fetching -------------------------------------------------------
   Always resolves (never throws) → { url, credit, source }. On any failure
   url is null and the caller shows the emoji tile fallback. A per-session
   in-memory cache avoids re-hitting the endpoint for the same key. */
const imgCache = new Map()

async function fetchImage(key, fallback) {
  if (imgCache.has(key)) return imgCache.get(key)
  let result = { url: null, credit: '', source: 'none' }
  try {
    const params = new URLSearchParams({ q: key })
    if (fallback) params.set('fallback', fallback)
    const res = await fetch(`/api/get-food-image?${params.toString()}`)
    const d = await res.json()
    result = { url: d.url || null, credit: d.credit || '', source: d.source || 'none' }
  } catch {
    /* keep the null fallback */
  }
  imgCache.set(key, result)
  return result
}

/** Image for a food card. Cache key: `food:<id>`. */
export function fetchFoodImage(food) {
  return fetchImage(`food:${food.id}`, food.q)
}

/** Image for a plated meal combo. Tries the curated/auto-fetched `dish:<dish_key>`
    image first; if that's missing (e.g. Google fetch disabled, no cached combo yet),
    falls back to the curated `food:<id>` photo of the meal's main component so a real
    image always shows. Cache key from the API's normalized dish_key. */
export async function fetchMealImage(meal) {
  const key = meal.dish_key ? `dish:${meal.dish_key}` : `dish:${(meal.name || '').toLowerCase()}`
  const primary = await fetchImage(key, `${meal.name} nigerian food`)
  if (primary.url) return primary

  const heroId = pickMealImageFoodId(meal)
  if (heroId) {
    const fallback = await fetchImage(`food:${heroId}`, heroId)
    if (fallback.url) return fallback
  }
  return primary // null → emoji tile
}
