import { describe, expect, it } from 'vitest'
import { buildCandidates, candidateMap, excludeAvoidedCandidates, preferUnusedCandidates } from '../server/combinations.js'

describe('realistic meal candidates', () => {
  it('pairs soup with swallow at lunch but does not offer it for dinner', () => {
    const lunch = buildCandidates(['egusi', 'eba', 'pap'], 'lunch')
    const dinner = buildCandidates(['egusi', 'eba', 'pap'], 'dinner')
    expect(lunch).toContainEqual(
      expect.objectContaining({ food_ids: ['egusi', 'eba'], name: 'Eba and Egusi Soup' })
    )
    expect(dinner.some((candidate) => candidate.food_ids.includes('egusi') && candidate.food_ids.includes('eba'))).toBe(false)
    expect(lunch.some((candidate) => candidate.food_ids.length === 1 && candidate.food_ids[0] === 'eba')).toBe(false)
  })

  it('uses a curated breakfast pairing', () => {
    const candidates = buildCandidates(['pap', 'akara', 'banana'], 'breakfast')
    expect(candidates.some((candidate) => candidate.key === 'pap+akara')).toBe(true)
    expect(candidates.find((candidate) => candidate.key === 'pap+akara').preference_score).toBe(2)
  })

  it('treats fruit-only selections as preferences rather than a hard menu boundary', () => {
    const candidates = candidateMap(['banana', 'orange', 'mango'])
    expect(candidates.lunch.length).toBeGreaterThan(30)
    expect(candidates.dinner.length).toBeGreaterThanOrEqual(25)
  })

  it('deterministically excludes named foods before AI selection', () => {
    const candidates = buildCandidates(['jollof', 'friedrice', 'grilledchicken'], 'lunch')
    const filtered = excludeAvoidedCandidates(candidates, 'chicken')
    expect(filtered.every((candidate) => !candidate.food_ids.includes('grilledchicken'))).toBe(true)
  })

  it('never creates arbitrary yam and meat pairings', () => {
    const candidates = buildCandidates(['boiledyam', 'beef', 'eggs'], 'lunch')
    expect(candidates.some((candidate) => candidate.key === 'boiledyam+beef')).toBe(false)
    expect(candidates.some((candidate) => candidate.key === 'boiledyam+eggs')).toBe(true)
  })
})

describe('swap candidate variety', () => {
  const candidates = [
    { key: 'a', name: 'A' },
    { key: 'a', name: 'A duplicate' },
    { key: 'b', name: 'B' },
    { key: 'c', name: 'C' },
  ]

  it('prefers candidates not already used in the plan', () => {
    expect(preferUnusedCandidates(candidates, new Set(['a', 'b']))).toEqual([{ key: 'c', name: 'C' }])
  })

  it('falls back to deduplicated candidates when every option is used', () => {
    expect(preferUnusedCandidates(candidates, new Set(['a', 'b', 'c'])).map((item) => item.key)).toEqual(['a', 'b', 'c'])
  })
})
