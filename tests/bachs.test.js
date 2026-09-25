import crypto from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import {
  BACHS_PRODUCT,
  bachsBaseUrl,
  hasActiveEntitlement,
  isReusableCheckout,
  isValidCheckoutResponse,
  subscriptionEventRank,
  validateSubscriptionData,
  verifyBachsSignature,
} from '../server/bachs.js'

const secret = 'whsec_test'
const rawBody = Buffer.from('{"id":"evt_test"}')
const timestamp = 1_700_000_000
const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')

afterEach(() => {
  delete process.env.BACHS_API_BASE_URL
  delete process.env.BACHS_PRODUCT_ID
})

describe('Bachs configuration and webhook verification', () => {
  it('selects the API environment from the key unless explicitly configured', () => {
    expect(bachsBaseUrl('sk_live_example')).toBe('https://api.bachs.io')
    expect(bachsBaseUrl('sk_sandbox_example')).toBe('https://sandbox-api.bachs.io')
    process.env.BACHS_API_BASE_URL = 'https://example.test/'
    expect(bachsBaseUrl('sk_live_example')).toBe('https://example.test')
  })

  it('accepts any matching V2 signature', () => {
    expect(verifyBachsSignature({
      rawBody, secret, signatureV2: `t=${timestamp},v1=${'0'.repeat(64)},v1=${signature}`, now: timestamp * 1000,
    })).toBe(true)
  })

  it('accepts the legacy timestamp and signature headers', () => {
    expect(verifyBachsSignature({ rawBody, secret, timestamp: String(timestamp), signature, now: timestamp * 1000 })).toBe(true)
  })

  it('rejects stale and invalid signatures', () => {
    expect(verifyBachsSignature({ rawBody, secret, signatureV2: `t=${timestamp},v1=${signature}`, now: (timestamp + 301) * 1000 })).toBe(false)
    expect(verifyBachsSignature({ rawBody, secret, timestamp: String(timestamp), signature: 'bad', now: timestamp * 1000 })).toBe(false)
  })
})

describe('Bachs subscription validation', () => {
  const valid = {
    subscription_id: 'sub_test',
    product_id: BACHS_PRODUCT.id,
    status: 'active',
    amount: '2500.00',
    currency: 'NGN',
    billing_cycle: { interval: 'month', frequency: 1 },
    current_period_start: '2029-01-01T00:00:00Z',
    current_period_end: '2029-02-01T00:00:00Z',
  }

  it('requires the confirmed recurring product terms', () => {
    expect(validateSubscriptionData(valid)).toBe(true)
    expect(validateSubscriptionData({ ...valid, amount: '2500' })).toBe(false)
    expect(validateSubscriptionData({ ...valid, billing_cycle: { interval: 'year', frequency: 1 } })).toBe(false)
    expect(validateSubscriptionData({ ...valid, current_period_end: 'not-a-date' })).toBe(false)
    expect(validateSubscriptionData({ ...valid, current_period_end: valid.current_period_start })).toBe(false)
  })

  it('grants only active or trialing, unexpired subscriptions', () => {
    expect(hasActiveEntitlement({ provider_status: 'active', current_period_end: '2030-01-01T00:00:00Z' }, Date.UTC(2029, 0, 1))).toBe(true)
    expect(hasActiveEntitlement({ provider_status: 'trialing', current_period_end: '2030-01-01T00:00:00Z' }, Date.UTC(2029, 0, 1))).toBe(true)
    expect(hasActiveEntitlement({ provider_status: 'past_due', current_period_end: '2030-01-01T00:00:00Z' }, Date.UTC(2029, 0, 1))).toBe(false)
    expect(hasActiveEntitlement({ provider_status: 'active', current_period_end: '2028-01-01T00:00:00Z' }, Date.UTC(2029, 0, 1))).toBe(false)
  })

  it('fails closed for missing or invalid entitlement expiry', () => {
    expect(hasActiveEntitlement({ provider_status: 'active' })).toBe(false)
    expect(hasActiveEntitlement({ provider_status: 'active', current_period_end: 'invalid' })).toBe(false)
  })

  it('orders equal-timestamp statuses conservatively', () => {
    expect(subscriptionEventRank('canceled')).toBeGreaterThan(subscriptionEventRank('active'))
    expect(subscriptionEventRank('unpaid')).toBeGreaterThan(subscriptionEventRank('past_due'))
    expect(subscriptionEventRank('past_due')).toBeGreaterThan(subscriptionEventRank('active'))
  })

  it('only reuses reserved or unexpired open checkouts', () => {
    const now = Date.UTC(2029, 0, 1)
    expect(isReusableCheckout({ checkout_state: 'reserved' }, now)).toBe(true)
    expect(isReusableCheckout({ checkout_state: 'open', checkout_expires_at: '2030-01-01T00:00:00Z' }, now)).toBe(true)
    expect(isReusableCheckout({ checkout_state: 'open', checkout_expires_at: '2028-01-01T00:00:00Z' }, now)).toBe(false)
    expect(isReusableCheckout({ checkout_state: 'failed' }, now)).toBe(false)
  })

  it('accepts only open, unexpired HTTPS checkout responses', () => {
    const now = Date.UTC(2029, 0, 1)
    const checkout = {
      checkout_id: 'chk_test',
      checkout_url: 'https://checkout.bachs.io/c/test',
      expires_at: '2030-01-01T00:00:00Z',
      status: 'open',
    }
    expect(isValidCheckoutResponse(checkout, now)).toBe(true)
    expect(isValidCheckoutResponse({ ...checkout, status: 'expired' }, now)).toBe(false)
    expect(isValidCheckoutResponse({ ...checkout, checkout_url: 'http://example.test' }, now)).toBe(false)
  })
})
