export const SCREENS = new Set([
  'home',
  'preferences',
  'select',
  'loading',
  'auth',
  'plan',
  'saved',
  'account',
  'vendor',
  'premium',
])

export const PROTECTED_SCREENS = new Set(['account', 'plan', 'saved'])

export function screenFromLocation(location, planWaiting = false) {
  if (planWaiting) return 'auth'
  if (new URLSearchParams(location.search).has('subscription')) return 'premium'
  const candidate = location.hash.replace(/^#\/?/, '').split(/[?&]/, 1)[0]
  return SCREENS.has(candidate) ? candidate : 'home'
}

export function screenUrl(screen, location) {
  const safeScreen = SCREENS.has(screen) ? screen : 'home'
  return `${location.pathname}${location.search}#/${safeScreen}`
}

export function activePlanKey(userId) {
  return `np-active-plan:${userId}`
}

export function isPlanId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '')
}
