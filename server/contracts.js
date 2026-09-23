import { z } from 'zod'

const weekday = z.enum(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])

export const generateRequestSchema = z
  .object({
    selectedIds: z.array(z.string().min(1).max(40)).min(3).max(60),
    selectedDays: z.number().int().min(1).max(30),
    fastingDay: weekday.nullable(),
    turnstileToken: z.string().max(2048).nullable(),
    preferences: z
      .object({
        goal: z.enum(['balanced', 'weight_management', 'higher_protein', 'budget', 'convenience']),
        conditions: z
          .array(z.enum(['diabetes', 'hypertension', 'high_cholesterol', 'kidney_condition', 'pregnancy']))
          .max(5),
        foodsToAvoid: z.string().max(500),
        clinicianInstructions: z.string().max(1000),
        householdSize: z.number().int().min(1).max(30),
        budgetLevel: z.enum(['low', 'moderate', 'flexible']),
        maxCookingMinutes: z.number().int().min(15).max(120),
        healthConsent: z.boolean(),
      })
      .strict(),
  })
  .strict()

export const swapRequestSchema = z
  .object({
    planId: z.string().uuid(),
    dayIndex: z.number().int().min(0).max(29),
    mealType: z.enum(['breakfast', 'lunch', 'dinner']),
    currentCandidateKey: z.string().min(1).max(100),
    otherCandidateKeys: z.array(z.string().min(1).max(100)).max(2),
    foodsToAvoid: z.string().max(500),
  })
  .strict()

export const modelMealSchema = z
  .object({
    candidate_key: z.string().min(1).max(100),
    description: z.string().min(1).max(300),
    calories: z.number().int().min(0).max(2500),
    protein: z.number().int().min(0).max(250),
    carbs: z.number().int().min(0).max(400),
    fat: z.number().int().min(0).max(200),
    health_note: z.string().min(1).max(240),
  })
  .strict()

export const modelDaySchema = z
  .object({
    day: z.string().min(1).max(40),
    is_fasting: z.boolean(),
    breakfast: modelMealSchema.nullable(),
    lunch: modelMealSchema.nullable(),
    dinner: modelMealSchema.nullable(),
  })
  .strict()

export const modelPlanSchema = z.object({ days: z.array(modelDaySchema).min(1).max(7) }).strict()

export const MODEL_PLAN_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['days'],
  properties: {
    days: {
      type: 'array',
      minItems: 1,
      maxItems: 7,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['day', 'is_fasting', 'breakfast', 'lunch', 'dinner'],
        properties: {
          day: { type: 'string' },
          is_fasting: { type: 'boolean' },
          breakfast: { anyOf: [{ $ref: '#/$defs/meal' }, { type: 'null' }] },
          lunch: { anyOf: [{ $ref: '#/$defs/meal' }, { type: 'null' }] },
          dinner: { anyOf: [{ $ref: '#/$defs/meal' }, { type: 'null' }] },
        },
      },
    },
  },
  $defs: {
    meal: {
      type: 'object',
      additionalProperties: false,
      required: ['candidate_key', 'description', 'calories', 'protein', 'carbs', 'fat', 'health_note'],
      properties: {
        candidate_key: { type: 'string' },
        description: { type: 'string' },
        calories: { type: 'integer', minimum: 0, maximum: 2500 },
        protein: { type: 'integer', minimum: 0, maximum: 250 },
        carbs: { type: 'integer', minimum: 0, maximum: 400 },
        fat: { type: 'integer', minimum: 0, maximum: 200 },
        health_note: { type: 'string' },
      },
    },
  },
}

export const MODEL_MEAL_JSON_SCHEMA = MODEL_PLAN_JSON_SCHEMA.$defs.meal
