import { FOOD_BY_ID } from './catalogue.js'
import { CURATED_MEALS } from './curatedMeals.js'
import { mealNutrition } from './mealNutrition.js'

// Ingredients, allergens, and local names that dish names do not reveal. Avoided-food
// matching is deliberately broad: over-excluding a meal is safer than serving an allergen.
const INGREDIENT_TERMS = {
  egusi: 'melon seed crayfish stockfish fish palm oil meat',
  banga: 'palm nut palm fruit catfish fish crayfish',
  ofensala: 'white soup catfish fish crayfish yam',
  ewedugbegiri: 'ewedu gbegiri jute beans bean legume cowpea crayfish iru locust bean palm oil',
  bitterleaf: 'onugbu crayfish stockfish fish palm oil cocoyam meat',
  oha: 'ora crayfish stockfish fish palm oil cocoyam meat',
  afang: 'okazi periwinkle shellfish seafood crayfish stockfish fish palm oil meat',
  edikangikong: 'ugu waterleaf periwinkle shellfish seafood crayfish stockfish fish palm oil meat',
  eforiro: 'spinach vegetable crayfish stockfish fish iru locust bean palm oil meat',
  ogbono: 'draw soup crayfish stockfish fish palm oil meat',
  okrasoup: 'okro crayfish stockfish fish seafood prawn palm oil meat',
  stew: 'tomato pepper vegetable oil',
  peppersoup: 'goat meat catfish fish',
  poundedyam: 'iyan',
  eba: 'garri gari cassava',
  amala: 'yam flour elubo lafun',
  fufu: 'akpu cassava',
  semovita: 'semolina wheat gluten',
  wheatswallow: 'wheat gluten',
  tuwo: 'rice',
  jollof: 'rice tomato pepper',
  friedrice: 'rice peas carrot sweet corn liver',
  whiterice: 'rice tomato stew pepper',
  ofada: 'rice ayamase designer stew palm oil pepper',
  spaghetti: 'pasta wheat gluten tomato',
  moimoi: 'beans bean legume cowpea egg crayfish',
  akara: 'beans bean legume cowpea',
  pap: 'ogi akamu corn maize milk dairy',
  custard: 'corn milk dairy',
  oats: 'oat milk dairy',
  bread: 'agege wheat gluten flour',
  toastbread: 'wheat gluten flour butter dairy',
  boiledyam: 'boiled yam',
  asaro: 'yam porridge palm oil crayfish',
  friedplantain: 'dodo plantain',
  irishpotato: 'potato',
  sweetpotato: 'potato',
  friedfish: 'fish',
  beans: 'bean legume cowpea ewa palm oil',
  grilledchicken: 'poultry meat',
  beef: 'meat red meat assorted offal tripe shaki',
  eggs: 'egg',
  turkey: 'poultry meat',
  coleslaw: 'cabbage carrot mayonnaise egg',
}

export function avoidedTerms(foodsToAvoid) {
  return String(foodsToAvoid || '')
    .toLowerCase()
    .split(/[,;\n/]|\band\b|\bor\b/)
    .map((term) => term.trim().replace(/^(no|avoid|without)\s+/, '').trim())
    .filter((term) => term.length >= 2)
    .flatMap((term) => {
      // "eggs" must also catch the "egg" in moi moi and coleslaw.
      if (term.length > 4 && term.endsWith('es')) return [term, term.slice(0, -2), term.slice(0, -1)]
      if (term.length > 3 && term.endsWith('s')) return [term, term.slice(0, -1)]
      return [term]
    })
}

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
  const terms = avoidedTerms(foodsToAvoid)
  if (!terms.length) return candidates
  return candidates.filter((candidate) => {
    const searchable = [
      candidate.name,
      candidate.dish_key,
      ...candidate.food_ids.flatMap((id) => [id, FOOD_BY_ID[id]?.name, INGREDIENT_TERMS[id]]),
    ].join(' ').toLowerCase()
    return !terms.some((term) => searchable.includes(term))
  })
}

// Nutrition comes from the server's per-portion table, not the model, so the same meal
// always carries the same estimate and every figure is tied to a stated serving.
export function materializeMeal(candidate, modelMeal) {
  return {
    name: candidate.name,
    dish_key: candidate.dish_key,
    food_ids: candidate.food_ids,
    description: modelMeal.description.replace(/[—–]/g, ','),
    ...mealNutrition(candidate.food_ids),
    youtube_query: `how to make ${candidate.name} Nigerian recipe`,
  }
}
