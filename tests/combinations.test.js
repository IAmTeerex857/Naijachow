import { describe, expect, it } from 'vitest'
import { buildCandidates, candidateMap, excludeAvoidedCandidates } from '../server/combinations.js'

describe('realistic meal candidates', () => {
  it('pairs soup with swallow and never serves swallow alone', () => {
    const candidates = buildCandidates(['egusi', 'eba', 'pap'], 'dinner')
    expect(candidates).toContainEqual(
      expect.objectContaining({ food_ids: ['eba', 'egusi'], name: 'Egusi Soup with Eba' })
    )
    expect(candidates.some((candidate) => candidate.food_ids.length === 1 && candidate.food_ids[0] === 'eba')).toBe(false)
    expect(candidates.some((candidate) => candidate.food_ids.length === 1 && candidate.food_ids[0] === 'egusi')).toBe(false)
  })

  it('uses a curated breakfast pairing', () => {
    const candidates = buildCandidates(['pap', 'akara', 'banana'], 'breakfast')
    expect(candidates.some((candidate) => candidate.key === 'pap+akara')).toBe(true)
    expect(candidates.some((candidate) => candidate.food_ids.includes('banana'))).toBe(true)
  })

  it('reports no realistic main-meal candidates for fruit-only selections', () => {
    const candidates = candidateMap(['banana', 'orange', 'mango'])
    expect(candidates.lunch).toHaveLength(0)
    expect(candidates.dinner).toHaveLength(0)
  })

  it('deterministically excludes named foods before AI selection', () => {
    const candidates = buildCandidates(['jollof', 'friedrice', 'grilledchicken'], 'lunch')
    const filtered = excludeAvoidedCandidates(candidates, 'chicken')
    expect(filtered.every((candidate) => !candidate.food_ids.includes('grilledchicken'))).toBe(true)
  })
})
