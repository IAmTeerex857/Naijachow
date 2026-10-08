import { useState } from 'react'
import ImageTile from './ImageTile'
import { fetchMealImage } from '../lib/api'

const LABELS = { breakfast: 'BREAKFAST', lunch: 'LUNCH', dinner: 'DINNER' }

const CHOWDECK_PACKAGE = 'com.chowdeck.com'

export function buildChowdeckHandoff(mealName, userAgent = '') {
  const query = encodeURIComponent(String(mealName || '').trim())
  const webUrl = `https://chowdeck.com/store/search?q=${query}&type=restaurant`
  const isAndroid = /android/i.test(userAgent)
  if (!isAndroid) return { url: webUrl, isAndroid: false }

  return {
    url: `intent://chowdeck.com/store/search?q=${query}&type=restaurant#Intent;scheme=https;package=${CHOWDECK_PACKAGE};S.browser_fallback_url=${encodeURIComponent(webUrl)};end`,
    isAndroid: true,
  }
}

export default function MealSlot({ meal, type, onSwap, swapping }) {
  const [showMacros, setShowMacros] = useState(false)
  const youtubeQuery = meal.youtube_query || `${meal.name} Nigerian recipe`
  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(youtubeQuery)}`
  const chowdeck = buildChowdeckHandoff(
    meal.name,
    typeof navigator === 'undefined' ? '' : navigator.userAgent
  )

  return (
    <div className="meal">
      <ImageTile name={meal.name} loader={() => fetchMealImage(meal)} placeholder="meal">
        {swapping && <div className="meal-overlay">Swapping...</div>}
      </ImageTile>

      <div className="mealtype">{LABELS[type]}</div>
      <div className="mealname">{meal.name}</div>

      <div className="mealtags">
        <span className="tag">{meal.calories ?? 'N/A'} kcal</span>
        <span className="tag protein">{meal.protein ?? 'N/A'}g protein</span>
      </div>

      <div className="mealactions">
        <button
          className="mbtn"
          onClick={() => setShowMacros((v) => !v)}
          aria-expanded={showMacros}
        >
          Nutrition
        </button>
        <a className="mbtn recipe" href={youtubeUrl} target="_blank" rel="noopener noreferrer">Recipe</a>
        <a
          className="mbtn chowdeck"
          href={chowdeck.url}
          target={chowdeck.isAndroid ? undefined : '_blank'}
          rel="noopener noreferrer"
          title={`Search Chowdeck for ${meal.name}`}
          aria-label={`Search Chowdeck for ${meal.name}`}
        >
          <img src="/chowdeck-icon.png" alt="" aria-hidden="true" />
          <span>Chowdeck</span>
        </a>
        <button className="mbtn swap" onClick={() => onSwap(type)} disabled={swapping}>
          Swap
        </button>
      </div>

      {showMacros && (
        <div className="macros">
          <div className="row">
            <strong>Carbs</strong> {meal.carbs ?? 'N/A'}g, <strong>Fat</strong> {meal.fat ?? 'N/A'}g,{' '}
            <strong>Protein</strong> {meal.protein ?? 'N/A'}g
          </div>
          <div>{meal.description || 'Approximate nutrition for one serving.'}</div>
        </div>
      )}
    </div>
  )
}
