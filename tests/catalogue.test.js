import { describe, expect, it } from 'vitest'
import { FOODS, resolveSelectedFoods } from '../server/catalogue.js'

describe('catalogue validation', () => {
  it('contains unique canonical IDs', () => {
    expect(new Set(FOODS.map((food) => food.id)).size).toBe(FOODS.length)
    expect(FOODS).toHaveLength(60)
  })

  it('rejects unknown and duplicate-only selections', () => {
    expect(resolveSelectedFoods(['egusi', 'eba', 'invented'])).toBeNull()
    expect(resolveSelectedFoods(['egusi', 'egusi', 'eba'])).toBeNull()
  })

  it('resolves valid unique selections', () => {
    expect(resolveSelectedFoods(['egusi', 'eba', 'pap']).map((food) => food.id)).toEqual([
      'egusi',
      'eba',
      'pap',
    ])
  })
})
