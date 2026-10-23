import MealSlot from './MealSlot'
import ImageTile from './ImageTile'
import { dayCalories } from '../lib/nutrition'
import { fetchFoodImage } from '../lib/api'
import { FOOD_BY_ID } from '../data/foods'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner']

function FastingPanel({ day }) {
  return (
    <div className="fasting">
      <h3>Fasting day</h3>
      <p>{day.fasting_message || 'No meals are scheduled today based on your selection.'}</p>
      {day.scripture && <p><strong>Scripture:</strong> {day.scripture}</p>}
      <div className="fasting-tags">
        <span className="ftag water">Drink water</span>
        <span className="ftag walk">Light walk</span>
        <span className="ftag tea">Warm tea</span>
      </div>
    </div>
  )
}

function FruitServing({ fruit }) {
  const fruitId = fruit.food_ids?.[0]
  return (
    <div className="meal fruit-serving">
      {FOOD_BY_ID[fruitId] && (
        <ImageTile name={fruit.name} loader={() => fetchFoodImage(FOOD_BY_ID[fruitId])} placeholder="meal" />
      )}
      <div className="mealtype">FRUIT / SNACK</div>
      <div className="mealname">{fruit.name}</div>
      <p>{fruit.description}</p>
      <div className="mealtags">
        <span className="tag">{fruit.calories} kcal</span>
        <span className="tag protein">{fruit.carbs}g carbs</span>
      </div>
    </div>
  )
}

export default function DayCard({ day, index, onSwap, swappingType, planId, foodsToAvoid }) {
  // Summed from the meals on screen, so a swap keeps the header honest.
  const kcal = dayCalories(day)

  return (
    <div className="daycard">
      <div className="dayhead">
        <div className="dtitle">{day.day}</div>
        {!day.is_fasting && <div className="dkcal">{kcal ? `~${kcal} kcal` : 'Not available'}</div>}
      </div>

      {day.is_fasting ? (
        <FastingPanel day={day} />
      ) : (
        <div className="meals">
          {MEAL_TYPES.map((type) =>
            day[type] ? (
              <MealSlot
                key={`${type}:${day[type].dish_key}`}
                type={type}
                meal={day[type]}
                onSwap={(t) => onSwap(index, t)}
                swapping={swappingType === type}
                planId={planId}
                foodsToAvoid={foodsToAvoid}
              />
            ) : null
          )}
          {day.snack && <FruitServing fruit={day.snack} />}
        </div>
      )}
    </div>
  )
}
