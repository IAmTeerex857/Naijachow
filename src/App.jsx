import { useState } from 'react'
import { FOOD_BY_ID } from './data/foods'
import { generatePlan, swapMeal } from './lib/api'
import { useTheme } from './lib/useTheme'
import ThemeToggle from './components/ThemeToggle'
import HeaderBand from './components/HeaderBand'
import SelectScreen from './components/SelectScreen'
import PlanScreen from './components/PlanScreen'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner']

export default function App() {
  const { dark, toggle } = useTheme()

  // phase: 'select' | 'loading' | 'plan'
  const [phase, setPhase] = useState('select')

  // Select-screen state
  const [selected, setSelected] = useState(() => new Set())
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('all')
  const [fasting, setFasting] = useState(false)
  const [fday, setFday] = useState(null)
  const [duration, setDuration] = useState(3)
  const [error, setError] = useState('')

  // Plan state
  const [plan, setPlan] = useState(null)
  const [planDuration, setPlanDuration] = useState(3)
  const [selectedNames, setSelectedNames] = useState([])
  const [swapping, setSwapping] = useState({ dayIndex: null, type: null })

  const step = phase === 'plan' ? 3 : phase === 'loading' ? 2 : 1

  function toggleFood(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
    setError('')
  }

  function clearAll() {
    setSelected(new Set())
  }

  async function handleGenerate() {
    if (selected.size < 3) {
      setError(`Select at least 3 dishes to continue (${selected.size} so far).`)
      return
    }
    const names = [...selected].map((id) => FOOD_BY_ID[id]?.name || id)
    setSelectedNames(names)
    setError('')
    setPhase('loading')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    try {
      const data = await generatePlan({
        selectedFoods: names,
        selectedDays: duration,
        fastingDay: fasting ? fday : null,
      })
      setPlan(data)
      setPlanDuration(duration)
      setPhase('plan')
    } catch (e) {
      setError(e.message || 'Could not generate plan. Please try again.')
      setPhase('select')
    }
  }

  function handleStartOver() {
    setPhase('select')
    setPlan(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSwap(dayIndex, type) {
    if (swapping.dayIndex !== null) return // one swap at a time
    const day = plan.days[dayIndex]
    if (!day || !day[type]) return
    const otherMealsToday = MEAL_TYPES.filter((t) => t !== type && day[t]).map((t) => day[t].name)
    setSwapping({ dayIndex, type })
    try {
      const newMeal = await swapMeal({
        selectedFoods: selectedNames,
        mealType: type,
        currentMealName: day[type].name,
        otherMealsToday,
      })
      setPlan((prev) => {
        const days = prev.days.map((d, i) => (i === dayIndex ? { ...d, [type]: newMeal } : d))
        return { ...prev, days }
      })
    } catch {
      /* keep the existing meal on failure */
    } finally {
      setSwapping({ dayIndex: null, type: null })
    }
  }

  return (
    <>
      <ThemeToggle dark={dark} onToggle={toggle} />
      <div className="page">
        <div className="container">
          <HeaderBand step={step} />

          {phase === 'select' && (
            <SelectScreen
              selected={selected}
              onToggle={toggleFood}
              onClear={clearAll}
              search={search}
              setSearch={setSearch}
              cat={cat}
              setCat={setCat}
              fasting={fasting}
              setFasting={setFasting}
              fday={fday}
              setFday={setFday}
              duration={duration}
              setDuration={setDuration}
              onGenerate={handleGenerate}
              error={error}
            />
          )}

          {phase === 'loading' && (
            <div className="loading">
              <div className="spinner" />
              <div className="ltxt">Building your meal plan…</div>
              <div className="lsub">Pairing your dishes into balanced days 🍲</div>
            </div>
          )}

          {phase === 'plan' && plan && (
            <PlanScreen
              plan={plan}
              duration={planDuration}
              onStartOver={handleStartOver}
              onSwap={handleSwap}
              swapping={swapping}
            />
          )}
        </div>

        <footer className="footer">
          <b>NaijaPlate</b> · Smart meal planning for Nigerian homes
          <br />
          <span style={{ opacity: 0.7 }}>Always consult a registered dietitian for medical nutrition advice.</span>
        </footer>
      </div>
    </>
  )
}
