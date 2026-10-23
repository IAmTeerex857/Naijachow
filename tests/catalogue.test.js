import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { FOODS, resolveSelectedFoods } from '../server/catalogue.js'
import { CURATED_MEALS } from '../server/curatedMeals.js'

describe('catalogue validation', () => {
  it('contains unique canonical IDs', () => {
    expect(new Set(FOODS.map((food) => food.id)).size).toBe(FOODS.length)
    expect(FOODS).toHaveLength(60)
  })

  it('rejects unknown and duplicate-only selections', () => {
    expect(resolveSelectedFoods(['egusi', 'eba', 'invented'])).toBeNull()
    expect(resolveSelectedFoods(['egusi', 'egusi', 'eba'])).toBeNull()
  })

  it('has a reviewed Commons photo for every food and only curated meal photos', () => {
    const images = JSON.parse(readFileSync(new URL('../scripts/catalog-images.json', import.meta.url), 'utf8'))
    const mealKeys = new Set(CURATED_MEALS.map((meal) => meal.ids.join('+')))
    expect(Object.keys(images.foods).sort()).toEqual(FOODS.map((food) => food.id).sort())
    expect(Object.keys(images.meals).filter((key) => !mealKeys.has(key))).toEqual([])
    expect([...Object.values(images.foods), ...Object.values(images.meals)].every((title) => title.startsWith('File:'))).toBe(true)
  })

  it('resolves valid unique selections', () => {
    expect(resolveSelectedFoods(['egusi', 'eba', 'pap']).map((food) => food.id)).toEqual([
      'egusi',
      'eba',
      'pap',
    ])
  })
})
