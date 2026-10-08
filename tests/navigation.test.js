import { describe, expect, it } from 'vitest'
import { activePlanKey, isPlanId, screenFromLocation, screenUrl } from '../src/lib/navigation.js'

describe('navigation helpers', () => {
  it('reads valid screens from the hash and rejects unknown screens', () => {
    expect(screenFromLocation({ hash: '#/saved', search: '' })).toBe('saved')
    expect(screenFromLocation({ hash: '#/not-a-screen', search: '' })).toBe('home')
  })

  it('prioritizes interrupted auth and checkout returns', () => {
    const location = { hash: '#/select', search: '?subscription=success' }
    expect(screenFromLocation(location)).toBe('premium')
    expect(screenFromLocation(location, true)).toBe('auth')
  })

  it('builds same-document screen URLs', () => {
    expect(screenUrl('plan', { pathname: '/app', search: '?x=1' })).toBe('/app?x=1#/plan')
  })

  it('scopes valid plan UUIDs to a user storage key', () => {
    expect(activePlanKey('user-1')).toBe('np-active-plan:user-1')
    expect(isPlanId('123e4567-e89b-42d3-a456-426614174000')).toBe(true)
    expect(isPlanId('{"days":[]}')).toBe(false)
  })
})
