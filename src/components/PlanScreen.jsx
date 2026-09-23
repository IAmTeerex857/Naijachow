import NutritionStrip from './NutritionStrip'
import DayCard from './DayCard'

export default function PlanScreen({ plan, duration, onStartOver, onSwap, swapping, onSave, justSaved, error }) {
  const days = plan.days || []

  return (
    <div className="screen">
      <div className="plan-head">
        <div>
          <div className="eyebrow">STEP 03 · YOUR PLAN</div>
          <h1>Your {duration}-day plan</h1>
        </div>
        <div className="plan-actions">
          {justSaved && <span className="saved-flag">✓ Saved</span>}
          <button className="btn btn-outline btn-sm" onClick={onStartOver}>
            Start over
          </button>
          <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
            Print
          </button>
          <button className="btn btn-orange btn-sm" onClick={onSave}>
            Save plan
          </button>
        </div>
      </div>

      {error && <div className="notice warn" role="alert">{error.message}</div>}

      {plan.missing_ingredients?.length > 0 && (
        <div className="notice warn">
          <span className="mark" aria-hidden="true" />
          <span>
            <strong>Add these to boost your nutrition:</strong>{' '}
            {plan.missing_ingredients.join(' · ')}
          </span>
        </div>
      )}

      <NutritionStrip days={days} />

      <div className="days">
        {days.map((day, i) => (
          <DayCard
            key={i}
            day={day}
            index={i}
            onSwap={onSwap}
            swappingType={swapping.dayIndex === i ? swapping.type : null}
          />
        ))}
      </div>
    </div>
  )
}
