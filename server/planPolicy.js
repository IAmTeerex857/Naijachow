import { FOOD_BY_ID } from './catalogue.js'
import { avoidedTerms } from './combinations.js'

const SOUPS = new Set([
  'ewedugbegiri', 'egusi', 'banga', 'ofensala', 'bitterleaf', 'oha', 'afang',
  'edikangikong', 'eforiro', 'ogbono', 'okrasoup',
])
const SWALLOWS = new Set(['amala', 'poundedyam', 'eba', 'fufu', 'semovita', 'wheatswallow', 'tuwo'])
const ACCOMPANIMENTS = new Set([
  'grilledchicken', 'beef', 'friedfish', 'turkey', 'eggs', 'coleslaw', 'friedplantain', 'moimoi', 'stew',
])
const EXCLUDED_SNACK_FRUIT = new Set(['coleslaw', 'cucumber', 'lemon', 'lime'])
// Common, affordable Nigerian fruit, offered when the user picked none of their own.
const DEFAULT_SNACK_FRUIT = ['banana', 'orange', 'pawpaw', 'watermelon', 'pineapple', 'mango', 'guava']

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

// Families that eat as the same base starch. Rice at lunch and rice again at dinner
// is technically two families but reads as the same meal twice.
const STAPLE_GROUPS = {
  jollof: 'rice', friedrice: 'rice', whiterice: 'rice', ofada: 'rice',
  boiledyam: 'yam', asaro: 'yam',
  beans: 'beans', moimoi: 'beans', akara: 'beans',
  bread: 'bread', toastbread: 'bread',
  irishpotato: 'potato', sweetpotato: 'potato',
}

// Selected foods should anchor the plan, while repeats are spread out. A family reused
// three times costs about as much as an unselected meal, which then fills the gap.
const COST = {
  keyUse: 3, familyUse: 1.5, componentUse: 1, preference: 2,
  sameDayFamily: 6, sameDayStaple: 4, sameDayComponent: 3,
}

// FNV-1a. Equal-cost meals are ordered by a seeded hash rather than alphabetically,
// so plans vary between generations instead of always favouring "b" breakfasts.
function tieBreak(seed, key) {
  let hash = 0x811c9dc5
  for (const char of `${seed}:${key}`) hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193)
  return hash >>> 0
}

export function mealFamily(meal) {
  const ids = meal?.food_ids || String(meal?.dish_key || meal?.key || '').split('+').filter(Boolean)
  return ids.find((id) => !ACCOMPANIMENTS.has(id)) || ids[0] || null
}

// The swallow under a soup or the akara beside pap: starches that the family does not
// already account for. Proteins and sides are excluded so selected ones can recur.
function secondaryStaples(meal) {
  const family = mealFamily(meal)
  return (meal.food_ids || []).filter((id) => id !== family && !ACCOMPANIMENTS.has(id))
}

export function mealStaple(meal) {
  const family = mealFamily(meal)
  return STAPLE_GROUPS[family] || family
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

export function assignMealCandidates(schedule, candidateMap, seed = '') {
  const keyUses = new Map()
  const familyUses = new Map()
  const componentUses = new Map()

  return schedule.map((day) => {
    if (day.is_fasting) return { ...day, breakfast_key: null, lunch_key: null, dinner_key: null }
    const assigned = { ...day }
    let lunchFamily = null
    const dayFamilies = new Set()
    const dayStaples = new Set()
    const dayComponents = new Set()

    for (const type of ['breakfast', 'lunch', 'dinner']) {
      const cost = (candidate) =>
        (keyUses.get(candidate.key) || 0) * COST.keyUse
        + (familyUses.get(mealFamily(candidate)) || 0) * COST.familyUse
        + secondaryStaples(candidate).reduce((sum, id) => sum + (componentUses.get(id) || 0), 0) * COST.componentUse
        - (candidate.preference_score || 0) * COST.preference
        + (dayFamilies.has(mealFamily(candidate)) ? COST.sameDayFamily : 0)
        + (dayStaples.has(mealStaple(candidate)) ? COST.sameDayStaple : 0)
        + candidate.food_ids.filter((id) => dayComponents.has(id)).length * COST.sameDayComponent
      const eligible = candidatesForSlot(candidateMap[type] || [], type)
        .filter((candidate) => type !== 'dinner' || mealFamily(candidate) !== lunchFamily)
        .map((candidate) => ({ candidate, cost: cost(candidate) }))
        .sort((a, b) =>
          a.cost - b.cost
          || tieBreak(seed, a.candidate.key) - tieBreak(seed, b.candidate.key)
          || a.candidate.key.localeCompare(b.candidate.key)
        )
      if (!eligible.length) throw new Error(`No policy-compliant ${type} candidate`)
      const chosen = eligible[0].candidate
      assigned[`${type}_key`] = chosen.key
      increment(keyUses, chosen.key)
      increment(familyUses, mealFamily(chosen))
      for (const id of secondaryStaples(chosen)) increment(componentUses, id)
      dayFamilies.add(mealFamily(chosen))
      dayStaples.add(mealStaple(chosen))
      for (const id of chosen.food_ids) dayComponents.add(id)
      if (type === 'lunch') lunchFamily = mealFamily(chosen)
    }
    return assigned
  })
}

export function swapCandidates(candidates, { currentMeal, sameDayMeals = [], history = [], usedKeys = new Set() }) {
  const blockedFamilies = new Set([mealFamily(currentMeal), ...sameDayMeals.map(mealFamily)].filter(Boolean))
  const blockedKeys = new Set([currentMeal?.dish_key, currentMeal?.food_ids?.join('+'), ...history].filter(Boolean))
  const sameDayStaples = new Set(sameDayMeals.map(mealStaple).filter(Boolean))
  const eligible = candidates
    .filter((candidate) => !blockedKeys.has(candidate.key) && !blockedFamilies.has(mealFamily(candidate)))
    .sort((a, b) =>
      Number(usedKeys.has(a.key)) - Number(usedKeys.has(b.key))
      || Number(sameDayStaples.has(mealStaple(a))) - Number(sameDayStaples.has(mealStaple(b)))
      || (b.preference_score || 0) - (a.preference_score || 0)
      || a.key.localeCompare(b.key)
    )
  return [...new Map(eligible.map((candidate) => [candidate.key, candidate])).values()]
}

export function fruitServings(selectedIds, foodsToAvoid = '') {
  const avoided = avoidedTerms(foodsToAvoid)
  const allowed = (id) => {
    const food = FOOD_BY_ID[id]
    return food?.cat === 'fruit'
      && !EXCLUDED_SNACK_FRUIT.has(id)
      && !avoided.some((term) => `${id} ${food.name} fruit`.toLowerCase().includes(term))
  }
  const selected = [...new Set(selectedIds)].filter(allowed)
  return selected.length ? selected : DEFAULT_SNACK_FRUIT.filter(allowed)
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
