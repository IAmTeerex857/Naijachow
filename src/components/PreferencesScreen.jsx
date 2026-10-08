import { useEffect, useState } from 'react'

const CONDITIONS = [
  ['diabetes', 'Diabetes / blood sugar'],
  ['hypertension', 'High blood pressure'],
  ['high_cholesterol', 'High cholesterol'],
  ['kidney_condition', 'Kidney condition'],
  ['pregnancy', 'Pregnancy'],
]

const GOALS = [
  ['balanced', 'Eat more balanced meals'],
  ['weight_management', 'Manage my weight'],
  ['higher_protein', 'Eat more protein'],
  ['convenience', 'Cook with less effort'],
]

export default function PreferencesScreen({ value, onChange, onContinue, signedIn }) {
  const [step, setStep] = useState(0)
  const [goalChosen, setGoalChosen] = useState(false)
  const [healthChoiceMade, setHealthChoiceMade] = useState(false)
  const [noneSelected, setNoneSelected] = useState(false)
  const [validationError, setValidationError] = useState('')
  const total = 3
  const hasSensitivePreferences = Boolean(
    value.conditions.length || value.foodsToAvoid.trim() || value.clinicianInstructions.trim()
  )

  useEffect(() => {
    if (!hasSensitivePreferences && value.healthConsent) patch({ healthConsent: false })
  }, [hasSensitivePreferences, value.healthConsent])

  function patch(next) {
    onChange({ ...value, ...next })
  }

  function toggleCondition(condition) {
    const current = new Set(value.conditions)
    current.has(condition) ? current.delete(condition) : current.add(condition)
    const conditions = [...current]
    setHealthChoiceMade(true)
    setNoneSelected(conditions.length === 0)
    setValidationError('')
    patch({
      conditions,
      ...(!conditions.length && !value.foodsToAvoid.trim() && !value.clinicianInstructions.trim()
        ? { healthConsent: false }
        : {}),
    })
  }

  function updateSensitive(field, nextValue) {
    const next = { ...value, [field]: nextValue }
    patch({
      [field]: nextValue,
      ...(!next.conditions.length && !next.foodsToAvoid.trim() && !next.clinicianInstructions.trim()
        ? { healthConsent: false }
        : {}),
    })
  }

  function scrollToTop() {
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }))
  }

  function continueStep() {
    if (step === 0 && (!goalChosen || !GOALS.some(([key]) => key === value.goal))) {
      setValidationError('Choose the one goal that matters most right now.')
      return
    }
    if (step === 1 && !healthChoiceMade) {
      setValidationError('Select any relevant conditions, or choose None of these.')
      return
    }
    if (step === 2 && (!Number.isInteger(value.householdSize) || value.householdSize < 1 || value.householdSize > 30)) {
      setValidationError('Enter a household size from 1 to 30.')
      return
    }

    setValidationError('')
    if (step < total - 1) setStep((current) => current + 1)
    else onContinue()
    scrollToTop()
  }

  return (
    <section className="screen preferences-screen" aria-labelledby="preferences-title">
      <header className="preferences-header">
        <p className="eyebrow">YOUR NEEDS {step + 1} OF {total}</p>
        <h1 id="preferences-title">Help us plan around you</h1>
        <p>These answers guide meal ranking and serving context. You can change them later.</p>
      </header>

      {step === 0 && (
        <fieldset className="answer-card answer-fieldset" aria-describedby={validationError ? 'preferences-error' : undefined}>
          <legend className="answer-title" id="goal-question">What matters most right now?</legend>
          <p className="answer-help">Choose one primary goal.</p>
          <div className="answer-options">
            {GOALS.map(([key, label]) => (
              <label
                className={goalChosen && value.goal === key ? 'answer-option active' : 'answer-option'}
                key={key}
              >
                <input
                  type="radio"
                  name="primary-goal"
                  value={key}
                  checked={goalChosen && value.goal === key}
                  onChange={() => {
                    setGoalChosen(true)
                    setValidationError('')
                    patch({ goal: key })
                  }}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {step === 1 && (
        <section className="answer-card" role="group" aria-labelledby="health-question" aria-describedby={validationError ? 'preferences-error' : undefined}>
          <h2 className="answer-title" id="health-question">Do any health considerations apply?</h2>
          <p className="answer-help">Select only conditions relevant to meal planning. This is not medical advice.</p>
          <div className="answer-options">
            {CONDITIONS.map(([key, label]) => (
              <button
                type="button"
                className={value.conditions.includes(key) ? 'answer-option active' : 'answer-option'}
                aria-pressed={value.conditions.includes(key)}
                onClick={() => toggleCondition(key)}
                key={key}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className={noneSelected ? 'answer-option active' : 'answer-option'}
              aria-pressed={noneSelected}
              onClick={() => {
                setHealthChoiceMade(true)
                setNoneSelected(true)
                setValidationError('')
                patch({
                  conditions: [],
                  ...(!value.foodsToAvoid.trim() && !value.clinicianInstructions.trim()
                    ? { healthConsent: false }
                    : {}),
                })
              }}
            >
              None of these
            </button>
          </div>
          <label className="answer-field">
            Allergies, intolerances, or foods to avoid
            <textarea
              value={value.foodsToAvoid}
              onChange={(event) => updateSensitive('foodsToAvoid', event.target.value)}
              maxLength={500}
              placeholder="For example: peanuts, dairy, very spicy food"
            />
          </label>
          <label className="answer-field">
            Instructions from your clinician
            <textarea
              value={value.clinicianInstructions}
              onChange={(event) => updateSensitive('clinicianInstructions', event.target.value)}
              maxLength={1000}
              placeholder="Only enter dietary instructions you have already been given"
            />
          </label>
        </section>
      )}

      {step === 2 && (
        <section className="answer-card" role="group" aria-labelledby="household-question">
          <h2 className="answer-title" id="household-question">What fits your household?</h2>
          <label className="answer-field">
            People eating
            <input
              type="number"
              min="1"
              max="30"
              value={value.householdSize}
              required
              aria-describedby={validationError ? 'preferences-error' : undefined}
              onChange={(event) => {
                const householdSize = Math.min(30, Math.max(1, Number(event.target.value) || 1))
                setValidationError('')
                patch({ householdSize })
              }}
            />
          </label>
          <label className="answer-field">
            Maximum cooking time: {value.maxCookingMinutes} minutes
            <input
              type="range"
              min="15"
              max="120"
              step="15"
              value={value.maxCookingMinutes}
              onChange={(event) => patch({ maxCookingMinutes: Number(event.target.value) })}
            />
          </label>
          {hasSensitivePreferences && (
            <label className="consent-row">
              <input
                type="checkbox"
                checked={value.healthConsent}
                onChange={(event) => patch({ healthConsent: event.target.checked })}
              />
              Save these sensitive health preferences for future plans when I sign in.
            </label>
          )}
          {!signedIn && (
            <p className="answer-help">
              These answers are sent securely to build this plan. They are retained for future plans only if you consent and then sign in.
            </p>
          )}
        </section>
      )}

      {validationError && <p className="answer-error" id="preferences-error" role="alert">{validationError}</p>}

      <footer className="answer-actions">
        {step > 0 && <button className="btn btn-ghost" onClick={() => {
          setValidationError('')
          setStep((current) => current - 1)
          scrollToTop()
        }}>Back</button>}
        {step < total - 1 ? (
          <button className="btn btn-primary" onClick={continueStep}>Continue</button>
        ) : (
          <button className="btn btn-primary" onClick={continueStep}>Choose my foods</button>
        )}
      </footer>
      <p className="health-disclaimer">
        Naijachow does not diagnose or guarantee meals are free from allergens. Confirm ingredients and follow advice from a qualified clinician.
      </p>
    </section>
  )
}
