import { FOOD_BY_ID, FOODS } from '../src/data/foods.js'

export { FOOD_BY_ID, FOODS }

export function resolveSelectedFoods(ids) {
  if (!Array.isArray(ids)) return null
  const unique = [...new Set(ids)]
  if (unique.length < 3 || unique.length > FOODS.length) return null
  if (unique.some((id) => typeof id !== 'string' || !FOOD_BY_ID[id])) return null
  return unique.map((id) => FOOD_BY_ID[id])
}
