import { useState } from 'react'
import ImageTile from './ImageTile'
import { fetchMealImage } from '../lib/api'

const LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

export default function MealSlot({ meal, type, onSwap, swapping }) {
  const [showNutrition, setShowNutrition] = useState(false)

  const ytQuery = meal.youtube_query || `${meal.name} Nigerian recipe`
  const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery)}`

  return (
    <div className="mealslot">
      <div className="mealimg">
        {/* keyed by meal name so the photo reloads when a swap changes the meal */}
        <ImageTile
          key={meal.name}
          cat="carb"
          emoji="🍽️"
          alt={meal.name}
          emojiSize="46px"
          loader={() => fetchMealImage(meal)}
        />
        {swapping && <div className="meal-overlay">Finding a new meal…</div>}
      </div>
      <div className="mealbody">
        <div className="mealtype">{LABELS[type]}</div>
        <div className="mealname">{meal.name}</div>
        {meal.description && <div className="mealdesc">{meal.description}</div>}
        <div className="macros">
          <span className="macro kcal">{meal.calories ?? '—'} kcal</span>
          <span className="macro protein">{meal.protein ?? '—'}g protein</span>
        </div>
        <div className="mealactions">
          <button className="mealbtn nutrition" onClick={() => setShowNutrition((v) => !v)}>
            Nutrition
          </button>
          <a className="mealbtn recipe" href={ytUrl} target="_blank" rel="noopener noreferrer">
            ▶ Recipe
          </a>
          <button className="mealbtn swap" onClick={() => onSwap(type)} disabled={swapping}>
            🔄
          </button>
        </div>
        {showNutrition && (
          <div className="nutrition-panel">
            <div>
              <strong>Health note:</strong> {meal.health_note || 'A wholesome Nigerian meal.'}
            </div>
            <div>
              <strong>Carbs</strong> {meal.carbs ?? '—'}g &nbsp;·&nbsp;
              <strong>Fat</strong> {meal.fat ?? '—'}g &nbsp;·&nbsp;
              <strong>Protein</strong> {meal.protein ?? '—'}g
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
