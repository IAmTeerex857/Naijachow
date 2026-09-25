import { useEffect, useRef, useState } from 'react'
import {
  AuthenticationRequiredError,
  claimGeneratedPlan,
  generatePlan,
  swapMeal,
  PremiumRequiredError,
  cancelSubscription,
  createSubscriptionCheckout,
  getSubscriptionStatus,
} from './lib/api'
import { useTheme } from './lib/useTheme'
import { useAuth } from './lib/useAuth'
import { loadUserPreferences, saveMealPlan, saveUserPreferences, supabase } from './lib/supabase'
import AppShell from './components/AppShell'
import HomeScreen from './components/HomeScreen'
import SelectScreen from './components/SelectScreen'
import LoadingScreen from './components/LoadingScreen'
import PlanScreen from './components/PlanScreen'
import ComingSoon from './components/ComingSoon'
import AuthScreen from './components/AuthScreen'
import PreferencesScreen from './components/PreferencesScreen'
import ImportScreen from './components/ImportScreen'
import SavedPlansScreen from './components/SavedPlansScreen'
import AccountScreen from './components/AccountScreen'
import PremiumScreen from './components/PremiumScreen'
import { haptic } from './lib/haptics'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DEFAULT_PREFERENCES = {
  goal: 'balanced',
  conditions: [],
  foodsToAvoid: '',
  clinicianInstructions: '',
  householdSize: 1,
  budgetLevel: 'moderate',
  maxCookingMinutes: 45,
  healthConsent: false,
}

export default function App() {
  const { dark, toggle } = useTheme()
  const { user } = useAuth()

  // 'home' | 'preferences' | 'select' | 'loading' | 'auth' | 'plan' | 'saved' | 'vendor' | 'premium'
  const [screen, setScreen] = useState(
    () => new URLSearchParams(window.location.search).has('subscription') ? 'premium' : 'home'
  )
  const [subscription, setSubscription] = useState(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const [subscriptionActionLoading, setSubscriptionActionLoading] = useState(false)
  const [subscriptionMessage, setSubscriptionMessage] = useState(() => {
    const result = new URLSearchParams(window.location.search).get('subscription')
    if (result === 'success') return 'Checkout completed. Premium unlocks after webhook confirmation.'
    if (result === 'cancelled') return 'Checkout was cancelled. You have not been charged.'
    return ''
  })

  // Select-screen state
  const [selected, setSelected] = useState(() => new Set())
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('all')
  const [fasting, setFasting] = useState(false)
  const [fday, setFday] = useState(null)
  const [duration, setDuration] = useState(3)
  const [error, setError] = useState(null)
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileResetKey, setTurnstileResetKey] = useState(0)

  // Plan state
  const [plan, setPlan] = useState(null)
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
    if (!new URLSearchParams(window.location.search).has('subscription')) return
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
  }, [])

  useEffect(() => {
    const previousUserId = previousUserIdRef.current
    const nextUserId = user?.id || null
    if (previousUserId && previousUserId !== nextUserId) {
      generationRef.current.controller?.abort()
      generationRef.current.id += 1
      planVersionRef.current += 1
      setPlan(null)
      setJustSaved(false)
      setPreferences(DEFAULT_PREFERENCES)
      preferencesDirtyRef.current = false
    }
    previousUserIdRef.current = nextUserId
  }, [user])

  useEffect(() => {
    const heading = document.querySelector('.main h1')
    if (!heading) return
    heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
  }, [screen])

  useEffect(() => {
    if (!user || planWaitingForAuth) return
    let active = true
    loadUserPreferences(user.id)
      .then((saved) => {
        if (active && saved && !preferencesDirtyRef.current) setPreferences(saved)
      })
      .catch(() => {})
    return () => { active = false }
  }, [user, planWaitingForAuth])

  useEffect(() => {
    if (!user || planWaitingForAuth) return
    const destination = localStorage.getItem('np-auth-return')
    if (destination && ['imports', 'saved', 'account', 'premium'].includes(destination)) {
      localStorage.removeItem('np-auth-return')
      setAuthReturn('home')
      go(destination)
    }
  }, [user, planWaitingForAuth])

  function go(next) {
    setScreen(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function navigate(next) {
    if (screen === 'loading' && next !== 'loading') {
      generationRef.current.controller?.abort()
      generationRef.current.id += 1
    }
    if (['imports', 'saved'].includes(next) && !user) {
      setAuthReturn(next)
      localStorage.setItem('np-auth-return', next)
      go('auth')
      return
    }
    if (next === 'select') {
      go('preferences')
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
      window.location.assign(await createSubscriptionCheckout())
    } catch (checkoutError) {
      setSubscriptionMessage(checkoutError.message)
      setSubscriptionActionLoading(false)
    }
  }

  async function handleCancelSubscription() {
    setSubscriptionActionLoading(true)
    try {
      const result = await cancelSubscription()
      setSubscriptionMessage(result.message)
      await refreshSubscription()
    } catch (cancelError) {
      setSubscriptionMessage(cancelError.message)
    } finally {
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
        preferences,
        turnstileToken,
        signal: controller.signal,
      })
      if (generationRef.current.id !== requestId) return
      setPlan(data)
      planVersionRef.current += 1
      setPlanDuration(duration)
      go('plan')
    } catch (e) {
      if (generationRef.current.id !== requestId || e.name === 'AbortError') return
      setTurnstileToken('')
      setTurnstileResetKey((value) => value + 1)
      if (e instanceof AuthenticationRequiredError) {
        if (e.generated) {
          localStorage.setItem('np-plan-waiting', 'true')
          setPlanWaitingForAuth(true)
        }
        go('auth')
        return
      }
      setError({
        message: e.message || 'Could not generate plan. Please try again.',
        premium: e instanceof PremiumRequiredError,
      })
      go('select')
    }
  }

  async function handleClaimPlan() {
    if (claimStarted.current) return
    claimStarted.current = true
    try {
      const claimed = await claimGeneratedPlan()
      setPlan(claimed)
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
              0
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
    setPlan(savedPlan)
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
      onSignOut={handleSignOut}
      onAccount={() => go('account')}
    >
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
          fday={fday}
          setFday={setFday}
          duration={duration}
          setDuration={chooseDuration}
          onGenerate={handleGenerate}
          onPremium={() => go('premium')}
          premiumActive={Boolean(subscription?.active)}
          error={error}
          signedIn={Boolean(user)}
          onTurnstileToken={setTurnstileToken}
          turnstileToken={turnstileToken}
          turnstileResetKey={turnstileResetKey}
        />
      )}

      {screen === 'loading' && <LoadingScreen />}

      {screen === 'auth' && (
        <AuthScreen
          planWaiting={planWaitingForAuth}
          user={user}
          onContinue={planWaitingForAuth ? handleClaimPlan : () => go(authReturn)}
        />
      )}

      {screen === 'imports' && user && <ImportScreen />}

      {screen === 'account' && user && (
        <AccountScreen
          user={user}
          onDeleted={() => {
            generationRef.current.controller?.abort()
            generationRef.current.id += 1
            planVersionRef.current += 1
            setPlan(null)
            setPreferences(DEFAULT_PREFERENCES)
            preferencesDirtyRef.current = false
            go('home')
          }}
          onEditPreferences={() => go('preferences')}
          onSignOut={handleSignOut}
        />
      )}

      {screen === 'plan' && plan && (
        <PlanScreen
          plan={plan}
          duration={planDuration}
          onStartOver={() => go('select')}
          onSwap={handleSwap}
          swapping={swapping}
          onSave={handleSavePlan}
          justSaved={justSaved}
          error={error}
        />
      )}

      {screen === 'saved' && user && (
        <SavedPlansScreen onOpen={openSavedPlan} onNew={() => go('preferences')} />
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
        <PremiumScreen
          user={user}
          status={subscription}
          loading={subscriptionLoading}
          actionLoading={subscriptionActionLoading}
          message={subscriptionMessage}
          onCheckout={handleSubscribe}
          onSignIn={handleSubscribe}
          onCancel={handleCancelSubscription}
          onRefresh={refreshSubscription}
          onPlan={() => go('preferences')}
        />
      )}
    </AppShell>
  )
}
