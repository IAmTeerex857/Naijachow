import MealSlot from './MealSlot'
import FastingCard from './FastingCard'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner']

export default function DayCard({ day, index, onSwap, swappingType }) {
  return (
    <div className="daycard" style={{ animationDelay: `${index * 0.07}s` }}>
      <div className="dayhead">
        <div className="dtitle">{day.day}</div>
        {!day.is_fasting && <div className="dcal">~{day.total_calories ?? '—'} kcal</div>}
      </div>
      {day.is_fasting ? (
        <FastingCard />
      ) : (
        <div className="mealgrid">
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
