import MealSlot from './MealSlot'
import { dayCalories } from '../lib/nutrition'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner']

function FastingPanel() {
  return (
    <div className="fasting">
      <h3>Rest &amp; Renew</h3>
      <p>Your fasting day — give your body and spirit a reset.</p>
      <div className="fasting-tags">
        <span className="ftag water">Drink water</span>
        <span className="ftag walk">Light walk</span>
        <span className="ftag tea">Warm tea</span>
      </div>
    </div>
  )
}

export default function DayCard({ day, index, onSwap, swappingType }) {
  // Summed from the meals on screen, so a swap keeps the header honest.
  const kcal = dayCalories(day)

  return (
    <div className="daycard">
      <div className="dayhead">
        <div className="dtitle">{day.day}</div>
        {!day.is_fasting && <div className="dkcal">{kcal ? `~${kcal} kcal` : '—'}</div>}
      </div>

      {day.is_fasting ? (
        <FastingPanel />
      ) : (
        <div className="meals">
          {MEAL_TYPES.map((type) =>
            day[type] ? (
              <MealSlot
                key={type}
                type={type}
                meal={day[type]}
                onSwap={(t) => onSwap(index, t)}
                swapping={swappingType === type}
              />
            ) : null
          )}
        </div>
      )}
    </div>
  )
}
