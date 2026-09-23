import { FOOD_BY_ID } from './catalogue.js'

const BREAKFAST_PAIRS = [
  ['pap', 'akara'],
  ['pap', 'moimoi'],
  ['custard', 'akara'],
  ['bread', 'eggs'],
  ['toastbread', 'eggs'],
  ['boiledyam', 'eggs'],
  ['sweetpotato', 'eggs'],
  ['friedplantain', 'eggs'],
  ['beans', 'friedplantain'],
]

const STANDALONE = new Set([
  'jollof',
  'friedrice',
  'whiterice',
  'ofada',
  'spaghetti',
  'moimoi',
  'akara',
  'pap',
  'custard',
  'oats',
  'asaro',
  'beans',
  'peppersoup',
])

const BREAKFAST_STANDALONE = new Set([
  'pap',
  'custard',
  'oats',
  'moimoi',
  'akara',
  'beans',
  'asaro',
  'boiledyam',
  'sweetpotato',
])

export function makeCombo(ids) {
  const foods = ids.map((id) => FOOD_BY_ID[id])
  const soup = foods.find((food) => food.cat === 'soup')
  const swallow = foods.find((food) => food.cat === 'swallow')
  const carb = foods.find((food) => food.cat === 'carb')
  const protein = foods.find((food) => food.cat === 'protein')
  const fruit = foods.find((food) => food.cat === 'fruit')

  let ordered = foods
  let name = foods.map((food) => food.name).join(' & ')
  if (soup && swallow) {
    ordered = [swallow, soup]
    name = `${soup.name} with ${swallow.name}`
  } else if (carb && protein) {
    ordered = [carb, protein]
    name = `${carb.name} with ${protein.name}`
  } else if (fruit && foods.length === 2) {
    const main = foods.find((food) => food !== fruit)
    ordered = [main, fruit]
    name = `${main.name} with ${fruit.name}`
  }

  return {
    key: ordered.map((food) => food.id).join('+'),
    food_ids: ordered.map((food) => food.id),
    name,
    dish_key: ordered.map((food) => food.name.toLowerCase()).join(' and '),
  }
}

export function mergeCandidateMaps(base, additions) {
  return Object.fromEntries(
    Object.keys(base).map((type) => [type, dedupe([...(additions[type] || []), ...base[type]])])
  )
}

function dedupe(combos) {
  return [...new Map(combos.map((combo) => [combo.key, combo])).values()]
}

export function buildCandidates(selectedIds, mealType) {
  const selected = new Set(selectedIds)
  const foods = selectedIds.map((id) => FOOD_BY_ID[id])
  const soups = foods.filter((food) => food.cat === 'soup' && food.id !== 'stew')
  const swallows = foods.filter((food) => food.cat === 'swallow')
  const carbs = foods.filter((food) => food.cat === 'carb')
  const proteins = foods.filter((food) => food.cat === 'protein')
  const fruits = foods.filter((food) => food.cat === 'fruit')
  const combos = []

  if (mealType === 'breakfast') {
    for (const pair of BREAKFAST_PAIRS) {
      if (pair.every((id) => selected.has(id))) combos.push(makeCombo(pair))
    }
    for (const food of foods) {
      if (BREAKFAST_STANDALONE.has(food.id)) combos.push(makeCombo([food.id]))
    }
    const breakfastBases = [...combos]
    for (const base of breakfastBases.slice(0, 8)) {
      for (const fruit of fruits.slice(0, 2)) combos.push(makeCombo([...base.food_ids, fruit.id]))
    }
    return dedupe(combos)
  }

  for (const soup of soups) {
    for (const swallow of swallows) combos.push(makeCombo([soup.id, swallow.id]))
  }
  for (const carb of carbs) {
    for (const protein of proteins) combos.push(makeCombo([carb.id, protein.id]))
  }
  if (selected.has('stew')) {
    for (const carb of carbs.filter((food) => !['pap', 'custard', 'oats'].includes(food.id))) {
      combos.push(makeCombo([carb.id, 'stew']))
    }
  }
  for (const food of foods) {
    if (STANDALONE.has(food.id)) combos.push(makeCombo([food.id]))
  }
  return dedupe(combos)
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
    description: modelMeal.description,
    calories: modelMeal.calories,
    protein: modelMeal.protein,
    carbs: modelMeal.carbs,
    fat: modelMeal.fat,
    health_note: modelMeal.health_note,
    youtube_query: `how to make ${candidate.name} Nigerian recipe`,
  }
}
