import { useState } from 'react'
import ImageTile from './ImageTile'
import { fetchMealImage } from '../lib/api'

const LABELS = { breakfast: 'BREAKFAST', lunch: 'LUNCH', dinner: 'DINNER' }

export default function MealSlot({ meal, type, onSwap, swapping }) {
  const [showMacros, setShowMacros] = useState(false)

  const ytQuery = meal.youtube_query || `${meal.name} Nigerian recipe`
  const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(ytQuery)}`

  return (
    <div className="meal">
      <ImageTile name={meal.name} loader={() => fetchMealImage(meal)}>
        {swapping && <div className="meal-overlay">Swapping…</div>}
      </ImageTile>

      <div className="mealtype">{LABELS[type]}</div>
      <div className="mealname">{meal.name}</div>

      <div className="mealtags">
        <span className="tag">{meal.calories ?? '—'} kcal</span>
        <span className="tag protein">{meal.protein ?? '—'}g protein</span>
      </div>

      <div className="mealactions">
        <button
          className="mbtn"
          onClick={() => setShowMacros((v) => !v)}
          aria-expanded={showMacros}
        >
          Nutrition
        </button>
        <a className="mbtn recipe" href={ytUrl} target="_blank" rel="noopener noreferrer">
          ▶ Recipe
        </a>
        <button className="mbtn swap" onClick={() => onSwap(type)} disabled={swapping}>
          Swap
        </button>
      </div>

      {showMacros && (
        <div className="macros">
          <div className="row">
            <strong>Carbs</strong> {meal.carbs ?? '—'}g · <strong>Fat</strong> {meal.fat ?? '—'}g ·{' '}
            <strong>Protein</strong> {meal.protein ?? '—'}g
          </div>
          <div>{meal.health_note || 'A wholesome Nigerian meal.'}</div>
        </div>
      )}
    </div>
  )
}
