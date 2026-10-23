import { describe, expect, it } from 'vitest'
import { generateRequestSchema, modelMealSchema, swapRequestSchema } from '../server/contracts.js'

const preferences = {
  goal: 'balanced',
  conditions: [],
  foodsToAvoid: '',
  clinicianInstructions: '',
  householdSize: 1,
  maxCookingMinutes: 45,
  healthConsent: false,
}

describe('API contracts', () => {
  it('accepts canonical generation input', () => {
    expect(
      generateRequestSchema.parse({
        selectedIds: ['egusi', 'eba', 'pap'],
        selectedDays: 3,
        fastingDay: null,
        turnstileToken: null,
        preferences,
      })
    ).toBeTruthy()
  })

  it('accepts but strips the optional legacy budget level', () => {
    const parsed = generateRequestSchema.parse({
      selectedIds: ['egusi', 'eba', 'pap'],
      selectedDays: 3,
      fastingDay: null,
      turnstileToken: null,
      preferences: { ...preferences, budgetLevel: 'moderate' },
    })

    expect(parsed.preferences).not.toHaveProperty('budgetLevel')
  })

  it('enforces household sizes from 1 through 30', () => {
    const request = {
      selectedIds: ['egusi', 'eba', 'pap'],
      selectedDays: 3,
      fastingDay: null,
      turnstileToken: null,
      preferences,
    }

    expect(generateRequestSchema.parse(request).preferences.householdSize).toBe(1)
    expect(generateRequestSchema.parse({
      ...request,
      preferences: { ...preferences, householdSize: 30 },
    }).preferences.householdSize).toBe(30)
    expect(() => generateRequestSchema.parse({
      ...request,
      preferences: { ...preferences, householdSize: 0 },
    })).toThrow()
    expect(() => generateRequestSchema.parse({
      ...request,
      preferences: { ...preferences, householdSize: 31 },
    })).toThrow()
  })

  it('rejects unknown input fields and malformed swaps', () => {
    expect(() =>
      generateRequestSchema.parse({
        selectedIds: ['egusi', 'eba', 'pap'],
        selectedDays: 3,
        fastingDay: null,
        turnstileToken: null,
        preferences,
        injected: true,
      })
    ).toThrow()
    expect(() => swapRequestSchema.parse({ planId: 'bad', dayIndex: -1, mealType: 'snack', foodsToAvoid: '' })).toThrow()
  })

  it('does not accept nutrition from the model', () => {
    expect(() =>
      modelMealSchema.parse({
        candidate_key: 'eba+egusi',
        description: 'One serving',
        calories: 600,
      })
    ).toThrow()
  })
})
