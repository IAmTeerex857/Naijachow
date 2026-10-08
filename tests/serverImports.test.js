import { describe, expect, it } from 'vitest'

const handlers = [
  '../api/account-delete.js',
  '../api/account-export.js',
  '../api/auth-code.js',
  '../api/bachs-webhook.js',
  '../api/claim-plan.js',
  '../api/generate-plan.js',
  '../api/get-food-image.js',
  '../api/subscription.js',
  '../api/swap-meal.js',
]

describe('serverless entry points', () => {
  it.each(handlers)('imports %s', async (path) => {
    const module = await import(path)
    expect(module.default).toBeTypeOf('function')
  })
})
