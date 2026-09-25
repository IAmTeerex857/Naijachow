import { useState } from 'react'

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
  ['budget', 'Spend less on food'],
  ['convenience', 'Cook with less effort'],
]

export default function PreferencesScreen({ value, onChange, onContinue, signedIn }) {
  const [step, setStep] = useState(0)
  const total = 3

  function patch(next) {
    onChange({ ...value, ...next })
  }

  function toggleCondition(condition) {
    const current = new Set(value.conditions)
    current.has(condition) ? current.delete(condition) : current.add(condition)
    patch({ conditions: [...current] })
  }

  return (
    <section className="screen preferences-screen" aria-labelledby="preferences-title">
      <header className="preferences-header">
        <p className="eyebrow">YOUR NEEDS · {step + 1} OF {total}</p>
        <h1 id="preferences-title">Help us plan around you</h1>
        <p>We use these answers to filter and rank meals. You can change them later.</p>
      </header>

      {step === 0 && (
        <section className="answer-card" role="group" aria-labelledby="goal-question">
          <h2 className="answer-title" id="goal-question">What matters most right now?</h2>
          <div className="answer-options">
            {GOALS.map(([key, label]) => (
              <button
                type="button"
                className={value.goal === key ? 'answer-option active' : 'answer-option'}
                aria-pressed={value.goal === key}
                onClick={() => patch({ goal: key })}
                key={key}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="answer-card" role="group" aria-labelledby="health-question">
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
          </div>
          <label className="answer-field">
            Allergies, intolerances, or foods to avoid
            <textarea
              value={value.foodsToAvoid}
              onChange={(event) => patch({ foodsToAvoid: event.target.value })}
              maxLength={500}
              placeholder="For example: peanuts, dairy, very spicy food"
            />
          </label>
          <label className="answer-field">
            Instructions from your clinician
            <textarea
              value={value.clinicianInstructions}
              onChange={(event) => patch({ clinicianInstructions: event.target.value })}
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
              onChange={(event) => patch({ householdSize: Number(event.target.value) })}
            />
          </label>
          <label className="answer-field">
            Budget
            <select value={value.budgetLevel} onChange={(event) => patch({ budgetLevel: event.target.value })}>
              <option value="low">Keep costs low</option>
              <option value="moderate">Moderate</option>
              <option value="flexible">Flexible</option>
            </select>
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
          {(value.conditions.length > 0 || value.foodsToAvoid.trim()) && (
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

      <footer className="answer-actions">
        {step > 0 && <button className="btn btn-ghost" onClick={() => setStep(step - 1)}>Back</button>}
        {step < total - 1 ? (
          <button className="btn btn-primary" onClick={() => setStep(step + 1)}>Continue</button>
        ) : (
          <button className="btn btn-primary" onClick={onContinue}>Choose my foods</button>
        )}
      </footer>
      <p className="health-disclaimer">
        NaijaPlate does not diagnose or guarantee meals are allergen-free. Confirm ingredients and follow advice from a qualified clinician.
      </p>
    </section>
  )
}
