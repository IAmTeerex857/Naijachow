import { describe, expect, it } from 'vitest'
import { generateRequestSchema, modelMealSchema, swapRequestSchema } from '../server/contracts.js'

const preferences = {
  goal: 'balanced',
  conditions: [],
  foodsToAvoid: '',
  clinicianInstructions: '',
  householdSize: 1,
  budgetLevel: 'moderate',
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

  it('rejects implausible nutrition', () => {
    expect(() =>
      modelMealSchema.parse({
        candidate_key: 'eba+egusi',
        description: 'One serving',
        calories: -1,
        protein: 20,
        carbs: 40,
        fat: 10,
        health_note: 'Estimate only',
      })
    ).toThrow()
  })
})
