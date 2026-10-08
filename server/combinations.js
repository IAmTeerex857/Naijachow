import { FOOD_BY_ID } from './catalogue.js'
import { CURATED_MEALS } from './curatedMeals.js'

export function makeCombo(ids, canonicalName = null) {
  const foods = ids.map((id) => FOOD_BY_ID[id])
  if (!foods.length || foods.some((food) => !food)) return null

  return {
    key: foods.map((food) => food.id).join('+'),
    food_ids: foods.map((food) => food.id),
    name: canonicalName || foods.map((food) => food.name).join(' and '),
    dish_key: foods.map((food) => food.id).join('+'),
  }
}

export function mergeCandidateMaps(base, additions) {
  return Object.fromEntries(
    Object.keys(base).map((type) => [
      type,
      dedupe([...(additions[type] || []), ...base[type]])
        .sort((a, b) => (b.preference_score || 0) - (a.preference_score || 0) || a.name.localeCompare(b.name)),
    ])
  )
}

function dedupe(combos) {
  return [...new Map(combos.map((combo) => [combo.key, combo])).values()]
}

export function preferUnusedCandidates(candidates, usedKeys) {
  const unique = dedupe(candidates)
  const unused = unique.filter((candidate) => !usedKeys.has(candidate.key))
  return unused.length ? unused : unique
}

export function buildCandidates(selectedIds, mealType) {
  const selected = new Set(selectedIds)
  return CURATED_MEALS
    .filter((meal) => meal.mealTypes.includes(mealType))
    .map((meal) => {
      const combo = makeCombo(meal.ids, meal.name)
      return combo ? {
        ...combo,
        preference_score: meal.ids.filter((id) => selected.has(id)).length,
        evidence: meal.evidence,
      } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.preference_score - a.preference_score || a.name.localeCompare(b.name))
}

export function candidateMap(selectedIds) {
  return {
    breakfast: buildCandidates(selectedIds, 'breakfast'),
    lunch: buildCandidates(selectedIds, 'lunch'),
    dinner: buildCandidates(selectedIds, 'dinner'),
  }
}

export function excludeAvoidedCandidates(candidates, foodsToAvoid) {
  const terms = String(foodsToAvoid || '')
    .toLowerCase()
    .split(/[,;\n]/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
  if (!terms.length) return candidates
  return candidates.filter((candidate) => {
    const searchable = `${candidate.name} ${candidate.dish_key} ${candidate.food_ids.join(' ')}`.toLowerCase()
    return !terms.some((term) => searchable.includes(term))
  })
}

export function materializeMeal(candidate, modelMeal) {
  return {
    name: candidate.name,
    dish_key: candidate.dish_key,
    food_ids: candidate.food_ids,
    description: modelMeal.description.replace(/[—–]/g, ','),
    calories: modelMeal.calories,
    protein: modelMeal.protein,
    carbs: modelMeal.carbs,
    fat: modelMeal.fat,
    youtube_query: `how to make ${candidate.name} Nigerian recipe`,
  }
}
