import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import {
  AuthenticationRequiredError,
  claimGeneratedPlan,
  generatePlan,
  swapMeal,
  PremiumRequiredError,
  createSubscriptionCheckout,
  getSubscriptionStatus,
} from './lib/api'
import { useTheme } from './lib/useTheme'
import { useAuth } from './lib/useAuth'
import { loadMealPlan, loadUserPreferences, saveMealPlan, saveUserPreferences, supabase } from './lib/supabase'
import { activePlanKey, isPlanId, PROTECTED_SCREENS, screenFromLocation, screenUrl } from './lib/navigation'
import AppShell from './components/AppShell'
import HomeScreen from './components/HomeScreen'
import SelectScreen from './components/SelectScreen'
import LoadingScreen from './components/LoadingScreen'
import PlanScreen from './components/PlanScreen'
import ComingSoon from './components/ComingSoon'
import AuthScreen from './components/AuthScreen'
import PreferencesScreen from './components/PreferencesScreen'
import SavedPlansScreen from './components/SavedPlansScreen'
import AccountScreen from './components/AccountScreen'
import PaymentSuccessModal from './components/PaymentSuccessModal'
import { haptic } from './lib/haptics'
import { FOOD_BY_ID } from './data/foods'

const PremiumScreen = lazy(() => import('./components/PremiumScreen'))

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DEFAULT_PREFERENCES = {
  goal: 'balanced',
  conditions: [],
  foodsToAvoid: '',
  clinicianInstructions: '',
  householdSize: 1,
  maxCookingMinutes: 45,
  healthConsent: false,
}

export default function App() {
  const { dark, toggle } = useTheme()
  const { user, loading: authLoading } = useAuth()

  // 'home' | 'preferences' | 'select' | 'loading' | 'auth' | 'plan' | 'saved' | 'vendor' | 'premium'
  const [screen, setScreen] = useState(
    () => screenFromLocation(window.location, localStorage.getItem('np-plan-waiting') === 'true')
  )
  const [subscription, setSubscription] = useState(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const [subscriptionActionLoading, setSubscriptionActionLoading] = useState(false)
  const [paymentResult] = useState(() => new URLSearchParams(window.location.search).get('subscription'))
  const [returnedCheckoutId] = useState(() =>
    new URLSearchParams(window.location.search).get('checkout_id') || sessionStorage.getItem('np-checkout-id')
  )
  const [showPaymentSuccess, setShowPaymentSuccess] = useState(false)
  const [subscriptionMessage, setSubscriptionMessage] = useState(() => {
    const result = new URLSearchParams(window.location.search).get('subscription')
    if (result === 'cancelled') return 'Checkout was cancelled. You have not been charged.'
    return ''
  })

  // Select-screen state
  const [selected, setSelected] = useState(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem('np-plan-draft') || '{}')
      return new Set((draft.selectedIds || []).filter((id) => FOOD_BY_ID[id]))
    } catch {
      return new Set()
    }
  })
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('all')
  const [fasting, setFasting] = useState(() => {
    try { return Boolean(JSON.parse(sessionStorage.getItem('np-plan-draft') || '{}').fasting) } catch { return false }
  })
  const [fday, setFday] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('np-plan-draft') || '{}').fastingDay || null } catch { return null }
  })
  const [fastingType, setFastingType] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('np-plan-draft') || '{}').fastingType === 'spiritual' ? 'spiritual' : 'food' } catch { return 'food' }
  })
  const [duration, setDuration] = useState(() => {
    try {
      const days = Number(JSON.parse(sessionStorage.getItem('np-plan-draft') || '{}').duration)
      return [3, 5, 7, 14, 30].includes(days) ? days : 3
    } catch { return 3 }
  })
  const [error, setError] = useState(null)
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)

  // Plan state
  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planDuration, setPlanDuration] = useState(3)
  const [swapping, setSwapping] = useState({ dayIndex: null, type: null })
  const [planWaitingForAuth, setPlanWaitingForAuth] = useState(
    () => localStorage.getItem('np-plan-waiting') === 'true'
  )
  const [justSaved, setJustSaved] = useState(false)
  const claimStarted = useRef(false)
  const subscriptionRequestRef = useRef(0)
  const subscriptionUserIdRef = useRef(user?.id || null)
  const previousSubscriptionUserRef = useRef(null)
  subscriptionUserIdRef.current = user?.id || null
  const generationRef = useRef({ id: 0, controller: null })
  const swapLockRef = useRef(false)
  const planVersionRef = useRef(0)
  const activePlanRequestRef = useRef(0)
  const premiumReturnRef = useRef('preferences')
  const preferencesDirtyRef = useRef(false)
  const previousUserIdRef = useRef(null)
  const [authReturn, setAuthReturn] = useState(
    () => localStorage.getItem('np-auth-return') || 'home'
  )

  useEffect(() => {
    if (!user || !planWaitingForAuth) return
    handleClaimPlan()
  }, [user, planWaitingForAuth])

  useEffect(() => {
    const previousUserId = previousSubscriptionUserRef.current
    const nextUserId = user?.id || null
    previousSubscriptionUserRef.current = nextUserId
    if (previousUserId && previousUserId !== nextUserId) {
      setSubscription(null)
      setSubscriptionMessage('')
    }
    if (!user) {
      subscriptionRequestRef.current += 1
      setSubscription(null)
      setSubscriptionLoading(false)
      return
    }
    refreshSubscription(user.id)
    return () => { subscriptionRequestRef.current += 1 }
  }, [user])

  useEffect(() => {
    if (!user || paymentResult !== 'success' || !returnedCheckoutId) return
    let active = true
    let attempts = 0
    let timer
    const check = async () => {
      attempts += 1
      try {
        const next = await getSubscriptionStatus()
        if (!active) return
        setSubscription(next)
        if (next.active && next.subscription?.checkout_id === returnedCheckoutId) {
          sessionStorage.removeItem('np-checkout-id')
          setShowPaymentSuccess(true)
          return
        }
      } catch {
        // The normal status request already surfaces persistent failures.
      }
      if (active && attempts < 60) timer = window.setTimeout(check, 2000)
    }
    check()
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [user, paymentResult, returnedCheckoutId])

  useEffect(() => {
    if (preferences.conditions.some((condition) => ['diabetes', 'kidney_condition', 'pregnancy'].includes(condition))) {
      setFasting(false)
      setFday(null)
    }
  }, [preferences.conditions])

  useEffect(() => {
    sessionStorage.setItem('np-plan-draft', JSON.stringify({
      selectedIds: [...selected],
      duration,
      fasting,
      fastingDay: fday,
      fastingType,
    }))
  }, [duration, fasting, fastingType, fday, selected])

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('subscription')) return
    if (paymentResult === 'cancelled') sessionStorage.removeItem('np-checkout-id')
    window.history.replaceState({ screen }, '', `${window.location.pathname}${window.location.hash}`)
  }, [])

  useEffect(() => {
    window.history.replaceState({ screen }, '', screenUrl(screen, window.location))
    const handlePopState = () => {
      generationRef.current.controller?.abort()
      generationRef.current.id += 1
      const next = screenFromLocation(window.location, localStorage.getItem('np-plan-waiting') === 'true')
      if (next === 'loading') {
        window.history.replaceState({ screen: 'select' }, '', screenUrl('select', window.location))
        setScreen('select')
        return
      }
      setScreen(next)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const previousUserId = previousUserIdRef.current
    const nextUserId = user?.id || null
    if (previousUserId && previousUserId !== nextUserId) {
      generationRef.current.controller?.abort()
      generationRef.current.id += 1
      planVersionRef.current += 1
      activePlanRequestRef.current += 1
      setPlan(null)
      setPlanLoading(false)
      setJustSaved(false)
      setPreferences(DEFAULT_PREFERENCES)
      preferencesDirtyRef.current = false
    }
    previousUserIdRef.current = nextUserId
  }, [user])

  useEffect(() => {
    if (!user) return
    const key = activePlanKey(user.id)

    const restore = async (planId) => {
      const requestId = activePlanRequestRef.current + 1
      activePlanRequestRef.current = requestId
      if (!isPlanId(planId)) {
        if (planId) localStorage.removeItem(key)
        setPlan(null)
        setPlanLoading(false)
        return
      }
      setPlanLoading(true)
      try {
        const restored = await loadMealPlan(user.id, planId)
        if (activePlanRequestRef.current !== requestId) return
        if (!restored) {
          localStorage.removeItem(key)
          setPlan(null)
          return
        }
        setPlan(restored)
        setPlanDuration(restored.duration || restored.days?.length || 3)
        setJustSaved(false)
        planVersionRef.current += 1
      } catch (loadError) {
        if (activePlanRequestRef.current === requestId) {
          setError({ message: loadError.message || 'Could not restore your active plan.' })
        }
      } finally {
        if (activePlanRequestRef.current === requestId) setPlanLoading(false)
      }
    }

    restore(localStorage.getItem(key))
    const handleStorage = (event) => {
      if (event.key === key) restore(event.newValue)
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      activePlanRequestRef.current += 1
      window.removeEventListener('storage', handleStorage)
    }
  }, [user])

  useEffect(() => {
    const heading = document.querySelector('.main h1')
    window.scrollTo({ top: 0 })
    if (!heading) return
    heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
  }, [screen])

  useEffect(() => {
    if (authLoading || user || !PROTECTED_SCREENS.has(screen)) return
    setAuthReturn(screen)
    localStorage.setItem('np-auth-return', screen)
    go('auth', { replace: true })
  }, [authLoading, screen, user])

  useEffect(() => {
    if (authLoading || !user || screen !== 'plan' || plan || planLoading) return
    go('preferences', { replace: true })
  }, [authLoading, plan, planLoading, screen, user])

  useEffect(() => {
    if (!user || planWaitingForAuth) return
    let active = true
    loadUserPreferences(user.id)
      .then((saved) => {
        if (active && saved && !preferencesDirtyRef.current) setPreferences(saved)
      })
      .catch(() => {
        if (active) setError({ message: 'We could not load your saved preferences. Please review them before continuing.' })
      })
    return () => { active = false }
  }, [user, planWaitingForAuth])

  useEffect(() => {
    if (!user || planWaitingForAuth) return
    const destination = localStorage.getItem('np-auth-return')
    if (destination && ['select', 'plan', 'saved', 'account', 'premium'].includes(destination)) {
      localStorage.removeItem('np-auth-return')
      setAuthReturn('home')
      go(destination)
    }
  }, [user, planWaitingForAuth])

  function go(next, { replace = false } = {}) {
    if (next === screen) return
    const method = replace ? 'replaceState' : 'pushState'
    window.history[method]({ screen: next }, '', screenUrl(next, window.location))
    setScreen(next)
  }

  function rememberPlan(nextPlan) {
    activePlanRequestRef.current += 1
    setPlanLoading(false)
    // The selection screen is the user's draft for the next plan. Loading,
    // claiming, or opening a plan must not tick foods on their behalf.
    setPlan(nextPlan)
    if (user && isPlanId(nextPlan?.planId)) {
      localStorage.setItem(activePlanKey(user.id), nextPlan.planId)
    }
  }

  function navigate(next) {
    if (screen === 'loading' && next !== 'loading') {
      generationRef.current.controller?.abort()
      generationRef.current.id += 1
    }
    if (next === 'saved' && !user) {
      setAuthReturn(next)
      localStorage.setItem('np-auth-return', next)
      go('auth')
      return
    }
    if (next === 'premium' && ['preferences', 'select'].includes(screen)) {
      premiumReturnRef.current = screen
    }
    if (next === 'select') {
      go(plan ? 'plan' : 'preferences')
      return
    }
    go(next)
  }

  async function refreshSubscription(expectedUserId = subscriptionUserIdRef.current) {
    if (!expectedUserId) return
    const requestId = subscriptionRequestRef.current + 1
    subscriptionRequestRef.current = requestId
    setSubscriptionLoading(true)
    try {
      const nextSubscription = await getSubscriptionStatus()
      if (subscriptionRequestRef.current === requestId && subscriptionUserIdRef.current === expectedUserId) {
        setSubscription(nextSubscription)
      }
    } catch (statusError) {
      if (subscriptionRequestRef.current === requestId && subscriptionUserIdRef.current === expectedUserId) {
        setSubscriptionMessage(statusError.message)
      }
    } finally {
      if (subscriptionRequestRef.current === requestId && subscriptionUserIdRef.current === expectedUserId) {
        setSubscriptionLoading(false)
      }
    }
  }

  async function handleSubscribe() {
    if (!user) {
      setAuthReturn('premium')
      localStorage.setItem('np-auth-return', 'premium')
      go('auth')
      return
    }
    setSubscriptionActionLoading(true)
    setSubscriptionMessage('')
    try {
      const { checkoutUrl, checkoutId } = await createSubscriptionCheckout()
      if (checkoutId) sessionStorage.setItem('np-checkout-id', checkoutId)
      window.location.assign(checkoutUrl)
    } catch (checkoutError) {
      setSubscriptionMessage(checkoutError.message)
      setSubscriptionActionLoading(false)
    }
  }

  async function handleSignOut() {
    generationRef.current.controller?.abort()
    generationRef.current.id += 1
    planVersionRef.current += 1
    await supabase?.auth.signOut()
    setPlan(null)
    setJustSaved(false)
    setPreferences(DEFAULT_PREFERENCES)
    preferencesDirtyRef.current = false
    localStorage.removeItem('np-auth-return')
    go('home')
  }

  async function handlePreferencesContinue() {
    if (user) {
      try {
        await saveUserPreferences(user.id, preferences)
      } catch (saveError) {
        setError({ message: saveError.message || 'Could not save your preferences.' })
        return
      }
    }
    go('select')
  }

  function toggleFood(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setError(null)
    haptic('selection')
  }

  /* Turning the switch on with no weekday chosen used to send fastingDay:null
     and silently produce a plan with no rest day. Default it here instead. */
  function toggleFasting() {
    if (preferences.conditions.some((condition) => ['diabetes', 'kidney_condition', 'pregnancy'].includes(condition))) {
      setFasting(false)
      return
    }
    setFasting((on) => {
      const next = !on
      if (next && !fday) setFday(duration >= 2 ? WEEKDAYS[1] : WEEKDAYS[0])
      return next
    })
  }

  /* Shortening the plan can strand the fasting day past its last day. */
  function chooseDuration(n) {
    setDuration(n)
    if (fday && WEEKDAYS.indexOf(fday) >= n) setFday(WEEKDAYS[Math.min(1, n - 1)])
  }

  async function handleGenerate() {
    if (selected.size < 3) return
    const ids = [...selected]
    setError(null)
    setJustSaved(false)
    generationRef.current.controller?.abort()
    const controller = new AbortController()
    const requestId = generationRef.current.id + 1
    generationRef.current = { id: requestId, controller }
    go('loading')
    try {
      const data = await generatePlan({
        selectedIds: ids,
        selectedDays: duration,
        fastingDay: fasting ? fday : null,
        fastingType: fasting ? fastingType : 'food',
        preferences,
        turnstileToken,
        signal: controller.signal,
      })
      if (generationRef.current.id !== requestId) return
      rememberPlan({ ...data, selectedIds: ids })
      planVersionRef.current += 1
      setPlanDuration(duration)
      go('plan', { replace: true })
    } catch (e) {
      if (generationRef.current.id !== requestId || e.name === 'AbortError') return
      setTurnstileToken('')
      setTurnstileResetKey((value) => value + 1)
      if (e instanceof AuthenticationRequiredError) {
        if (e.generated) {
          localStorage.setItem('np-plan-waiting', 'true')
          setPlanWaitingForAuth(true)
        }
        go('auth', { replace: true })
        return
      }
      setError({
        message: e.message || 'Could not generate plan. Please try again.',
        premium: e instanceof PremiumRequiredError,
      })
      go('select', { replace: true })
    }
  }

  async function handleClaimPlan() {
    if (claimStarted.current) return
    claimStarted.current = true
    try {
      const claimed = await claimGeneratedPlan()
      rememberPlan(claimed)
      planVersionRef.current += 1
      setPlanDuration(claimed.days?.length || duration)
      localStorage.removeItem('np-plan-waiting')
      localStorage.removeItem('np-auth-return')
      setPlanWaitingForAuth(false)
      haptic('success')
      go('plan')
    } catch (e) {
      if ([404, 409].includes(e.status)) {
        localStorage.removeItem('np-plan-waiting')
        setPlanWaitingForAuth(false)
      }
      setError({ message: e.message || 'Could not open your plan.' })
      go('select')
    } finally {
      claimStarted.current = false
    }
  }

  async function handleSwap(dayIndex, type) {
    if (swapLockRef.current) return
    const day = plan?.days?.[dayIndex]
    if (!day || !day[type]) return

    const otherMealsToday = MEAL_TYPES.filter((t) => t !== type && day[t]).map(
      (t) => day[t].food_ids?.join('+') || day[t].dish_key
    )
    swapLockRef.current = true
    const planVersion = planVersionRef.current
    setSwapping({ dayIndex, type })
    try {
      const newMeal = await swapMeal({
        planId: plan.planId,
        dayIndex,
        mealType: type,
        currentMealName: day[type].food_ids?.join('+') || day[type].dish_key,
        otherMealsToday,
        foodsToAvoid: preferences.foodsToAvoid,
      })
      if (newMeal && planVersionRef.current === planVersion) {
        setPlan((prev) => {
          const days = prev.days.map((currentDay, index) => {
            if (index !== dayIndex) return currentDay
            const nextDay = { ...currentDay, [type]: newMeal }
            nextDay.total_calories = MEAL_TYPES.reduce(
              (sum, mealType) => sum + (Number(nextDay[mealType]?.calories) || 0),
              Number(nextDay.snack?.calories) || 0
            )
            return nextDay
          })
          return { ...prev, days }
        })
      }
    } catch (swapError) {
      setError({ message: swapError.message || 'Could not swap this meal.' })
      haptic('warning')
    } finally {
      swapLockRef.current = false
      setSwapping({ dayIndex: null, type: null })
    }
  }

  async function handleSavePlan() {
    if (!user) {
      setAuthReturn('plan')
      go('auth')
      return
    }
    const savingPlanId = plan?.planId
    const savingVersion = planVersionRef.current
    try {
      await saveMealPlan(savingPlanId, plan)
      if (planVersionRef.current === savingVersion && plan?.planId === savingPlanId) {
        setJustSaved(true)
      }
      haptic('success')
    } catch (saveError) {
      setError({ message: saveError.message || 'Could not save this plan.' })
    }
  }

  function openSavedPlan(savedPlan) {
    rememberPlan(savedPlan)
    planVersionRef.current += 1
    setPlanDuration(savedPlan.days?.length || 3)
    setJustSaved(true)
    go('plan')
  }

  return (
    <AppShell
      screen={screen}
      onNavigate={navigate}
      dark={dark}
      onToggleTheme={toggle}
      user={user}
      premiumActive={user ? subscription?.active : false}
      onAccount={() => go('account')}
    >
      {showPaymentSuccess && <PaymentSuccessModal onClose={() => setShowPaymentSuccess(false)} />}
      {screen === 'home' && (
        <HomeScreen onStart={() => go('preferences')} onSeeSaved={() => navigate('saved')} />
      )}

      {screen === 'preferences' && (
        <PreferencesScreen
          value={preferences}
          onChange={(next) => {
            preferencesDirtyRef.current = true
            setPreferences(next)
          }}
          signedIn={Boolean(user)}
          onContinue={handlePreferencesContinue}
        />
      )}

      {screen === 'select' && (
        <SelectScreen
          selected={selected}
          onToggle={toggleFood}
          onClear={() => setSelected(new Set())}
          search={search}
          setSearch={setSearch}
          cat={cat}
          setCat={setCat}
          fasting={fasting}
          onToggleFasting={toggleFasting}
          fastingType={fastingType}
          setFastingType={setFastingType}
          fday={fday}
          setFday={setFday}
          duration={duration}
          setDuration={chooseDuration}
          onGenerate={handleGenerate}
          onPremium={() => navigate('premium')}
          premiumActive={Boolean(subscription?.active)}
          fastingAllowed={!preferences.conditions.some((condition) => ['diabetes', 'kidney_condition', 'pregnancy'].includes(condition))}
          error={error}
          signedIn={Boolean(user)}
          onTurnstileToken={setTurnstileToken}
          turnstileToken={turnstileToken}
          turnstileResetKey={turnstileResetKey}
        />
      )}

      {(screen === 'loading' || (PROTECTED_SCREENS.has(screen) && authLoading) || (screen === 'plan' && user && (!plan || planLoading))) && <LoadingScreen />}

      {(screen === 'auth' || (PROTECTED_SCREENS.has(screen) && !authLoading && !user)) && (
        <AuthScreen
          planWaiting={planWaitingForAuth}
          user={user}
          onContinue={planWaitingForAuth ? handleClaimPlan : () => go(authReturn)}
        />
      )}

      {screen === 'account' && user && !authLoading && (
        <AccountScreen
          user={user}
          onDeleted={() => {
            generationRef.current.controller?.abort()
            generationRef.current.id += 1
            planVersionRef.current += 1
            setPlan(null)
            localStorage.removeItem(activePlanKey(user.id))
            setPreferences(DEFAULT_PREFERENCES)
            preferencesDirtyRef.current = false
            go('home')
          }}
          onEditPreferences={() => go('preferences')}
          onSignOut={handleSignOut}
        />
      )}

      {screen === 'plan' && plan && !planLoading && (
        <PlanScreen
          plan={plan}
          duration={planDuration}
          onStartOver={() => {
            setSelected(new Set())
            go('select')
          }}
          onSwap={handleSwap}
          swapping={swapping}
          onSave={handleSavePlan}
          justSaved={justSaved}
          error={error}
          foodsToAvoid={preferences.foodsToAvoid}
        />
      )}

      {screen === 'saved' && user && (
        <SavedPlansScreen onOpen={openSavedPlan} onNew={() => navigate('select')} />
      )}

      {screen === 'vendor' && (
        <ComingSoon
          eyebrow="ORDER IN"
          title="Vendors"
          body="Ordering your plan's dishes from kitchens near you is on the way. No vendors have signed up yet, so there's nothing real to show."
          onStart={() => go('select')}
        />
      )}

      {screen === 'premium' && (
        <Suspense fallback={<div className="screen" aria-busy="true" />}>
          <PremiumScreen
            user={user}
            status={subscription}
            loading={subscriptionLoading}
            actionLoading={subscriptionActionLoading}
            message={subscriptionMessage}
            onCheckout={handleSubscribe}
            onSignIn={handleSubscribe}
            onPlan={() => go(premiumReturnRef.current)}
            dark={dark}
          />
        </Suspense>
      )}
    </AppShell>
  )
}
