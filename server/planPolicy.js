import { FOOD_BY_ID } from './catalogue.js'

const SOUPS = new Set([
  'ewedugbegiri', 'egusi', 'banga', 'ofensala', 'bitterleaf', 'oha', 'afang',
  'edikangikong', 'eforiro', 'ogbono', 'okrasoup',
])
const SWALLOWS = new Set(['amala', 'poundedyam', 'eba', 'fufu', 'semovita', 'wheatswallow', 'tuwo'])
const ACCOMPANIMENTS = new Set([
  'grilledchicken', 'beef', 'friedfish', 'turkey', 'eggs', 'coleslaw', 'friedplantain', 'moimoi', 'stew',
])
const EXCLUDED_SNACK_FRUIT = new Set(['coleslaw', 'cucumber', 'lemon', 'lime'])

const FRUIT_NUTRITION = {
  banana: [105, 1, 27, 0, '1 medium banana'],
  orange: [62, 1, 15, 0, '1 medium orange'],
  mango: [99, 1, 25, 1, '1 cup sliced mango'],
  pineapple: [82, 1, 22, 0, '1 cup pineapple pieces'],
  pawpaw: [62, 1, 16, 0, '1 cup pawpaw pieces'],
  watermelon: [46, 1, 12, 0, '1 cup watermelon pieces'],
  avocado: [240, 3, 13, 22, '1 medium avocado'],
  guava: [68, 3, 14, 1, '1 medium guava'],
  apple: [95, 0, 25, 0, '1 medium apple'],
  grapes: [104, 1, 27, 0, '1 cup grapes'],
  tangerine: [47, 1, 12, 0, '1 medium tangerine'],
  strawberry: [49, 1, 12, 0, '1 cup strawberries'],
  soursop: [148, 2, 38, 1, '1 cup soursop pieces'],
}

export function mealFamily(meal) {
  const ids = meal?.food_ids || String(meal?.dish_key || meal?.key || '').split('+').filter(Boolean)
  return ids.find((id) => !ACCOMPANIMENTS.has(id)) || ids[0] || null
}

export function isSoupAndSwallow(meal) {
  const ids = new Set(meal?.food_ids || String(meal?.dish_key || meal?.key || '').split('+'))
  return [...SOUPS].some((id) => ids.has(id)) && [...SWALLOWS].some((id) => ids.has(id))
}

export function candidatesForSlot(candidates, mealType) {
  return candidates.filter((candidate) => mealType !== 'dinner' || !isSoupAndSwallow(candidate))
}

function increment(map, key) {
  map.set(key, (map.get(key) || 0) + 1)
}

export function assignMealCandidates(schedule, candidateMap) {
  const keyUses = new Map()
  const familyUses = new Map()

  return schedule.map((day) => {
    if (day.is_fasting) return { ...day, breakfast_key: null, lunch_key: null, dinner_key: null }
    const assigned = { ...day }
    let lunchFamily = null

    for (const type of ['breakfast', 'lunch', 'dinner']) {
      const eligible = candidatesForSlot(candidateMap[type] || [], type)
        .filter((candidate) => type !== 'dinner' || mealFamily(candidate) !== lunchFamily)
        .sort((a, b) =>
          (keyUses.get(a.key) || 0) - (keyUses.get(b.key) || 0)
          || (familyUses.get(mealFamily(a)) || 0) - (familyUses.get(mealFamily(b)) || 0)
          || (b.preference_score || 0) - (a.preference_score || 0)
          || a.key.localeCompare(b.key)
        )
      if (!eligible.length) throw new Error(`No policy-compliant ${type} candidate`)
      const chosen = eligible[0]
      assigned[`${type}_key`] = chosen.key
      increment(keyUses, chosen.key)
      increment(familyUses, mealFamily(chosen))
      if (type === 'lunch') lunchFamily = mealFamily(chosen)
    }
    return assigned
  })
}

export function swapCandidates(candidates, { currentMeal, sameDayMeals = [], history = [], usedKeys = new Set() }) {
  const blockedFamilies = new Set([mealFamily(currentMeal), ...sameDayMeals.map(mealFamily)].filter(Boolean))
  const blockedKeys = new Set([currentMeal?.dish_key, currentMeal?.food_ids?.join('+'), ...history].filter(Boolean))
  const eligible = candidates
    .filter((candidate) => !blockedKeys.has(candidate.key) && !blockedFamilies.has(mealFamily(candidate)))
    .sort((a, b) => Number(usedKeys.has(a.key)) - Number(usedKeys.has(b.key)) || a.key.localeCompare(b.key))
  return eligible
}

export function fruitServings(selectedIds, foodsToAvoid = '') {
  const avoided = String(foodsToAvoid).toLowerCase().split(/[,;\n]/).map((term) => term.trim()).filter(Boolean)
  return [...new Set(selectedIds)].filter((id) => {
    const food = FOOD_BY_ID[id]
    return food?.cat === 'fruit'
      && !EXCLUDED_SNACK_FRUIT.has(id)
      && !avoided.some((term) => `${id} ${food.name}`.toLowerCase().includes(term))
  })
}

export function fruitServing(id) {
  const food = FOOD_BY_ID[id]
  const nutrition = FRUIT_NUTRITION[id]
  if (!food || !nutrition) return null
  const [calories, protein, carbs, fat, serving] = nutrition
  return {
    name: food.name,
    dish_key: `fruit:${id}`,
    food_ids: [id],
    description: serving,
    calories,
    protein,
    carbs,
    fat,
  }
}

export function addFruitToPlan(days, selectedIds, foodsToAvoid = '') {
  const fruits = fruitServings(selectedIds, foodsToAvoid)
  let servingIndex = 0
  return days.map((day) => {
    if (day.is_fasting || !fruits.length) return day
    const snack = fruitServing(fruits[servingIndex++ % fruits.length])
    return { ...day, snack, total_calories: (day.total_calories || 0) + snack.calories }
  })
}
