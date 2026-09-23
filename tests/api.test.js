import { describe, expect, it } from 'vitest'
import generatePlan from '../api/generate-plan.js'
import getFoodImage from '../api/get-food-image.js'

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, value) { this.headers[name] = value },
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
  }
}

describe('Vercel API handlers', () => {
  it('rejects unsupported generation methods', async () => {
    const res = response()
    await generatePlan({ method: 'GET', headers: {}, socket: {} }, res)
    expect(res.statusCode).toBe(405)
    expect(res.headers.Allow).toBe('POST')
  })

  it('rejects unknown dish IDs before using providers', async () => {
    const res = response()
    await generatePlan({
      method: 'POST', headers: {}, socket: {},
      body: {
        selectedIds: ['egusi', 'eba', 'not-real'], selectedDays: 3, fastingDay: null, turnstileToken: null,
        preferences: { goal: 'balanced', conditions: [], foodsToAvoid: '', clinicianInstructions: '', householdSize: 1, budgetLevel: 'moderate', maxCookingMinutes: 45, healthConsent: false },
      },
    }, res)
    expect(res.statusCode).toBe(400)
  })

  it('rejects malformed image keys and non-GET methods', async () => {
    const invalid = response()
    await getFoodImage({ method: 'GET', query: { q: 'food:not-real' } }, invalid)
    expect(invalid.statusCode).toBe(400)

    const wrongMethod = response()
    await getFoodImage({ method: 'POST', query: {} }, wrongMethod)
    expect(wrongMethod.statusCode).toBe(405)
  })
})
