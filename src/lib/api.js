/* ===========================================================================
   API client — thin wrappers over the Netlify Functions.
   Contracts mirror NaijaPlate-PRD.md §4. All secrets live server-side.
   =========================================================================== */

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

/** Image for a plated meal combo. Cache key: `dish:<dish_key>` (from the API).
    Falls back to the meal name if the backend didn't return a dish_key. */
export function fetchMealImage(meal) {
  const key = meal.dish_key ? `dish:${meal.dish_key}` : `dish:${(meal.name || '').toLowerCase()}`
  return fetchImage(key, `${meal.name} nigerian food`)
}
