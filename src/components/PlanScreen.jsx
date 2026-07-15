import NutritionStrip from './NutritionStrip'
import DayCard from './DayCard'
import PremiumBanner from './PremiumBanner'

export default function PlanScreen({ plan, duration, onStartOver, onSwap, swapping }) {
  const days = plan.days || []
  return (
    <>
      <div className="results-header">
        <h2>Your {duration}-Day Plan</h2>
        <div className="results-actions">
          <button className="btn btn-outline" onClick={onStartOver}>
            Start Over
          </button>
          <button className="btn btn-jade" onClick={() => window.print()}>
            🖨 Print
          </button>
        </div>
      </div>

      <div className="plan-body">
        <NutritionStrip plan={plan} />

        {plan.missing_ingredients && plan.missing_ingredients.length > 0 && (
          <div className="missing">
            <strong>Add these to boost your nutrition:</strong>
            {plan.missing_ingredients.join(' · ')}
          </div>
        )}

        {days.map((day, i) => (
          <DayCard
            key={i}
            day={day}
            index={i}
            onSwap={onSwap}
            swappingType={swapping.dayIndex === i ? swapping.type : null}
          />
        ))}

        {duration <= 7 && <PremiumBanner />}
      </div>
    </>
  )
}
