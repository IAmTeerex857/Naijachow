import ImageTile from './ImageTile'
import { fetchFoodImage } from '../lib/api'

export default function FoodCard({ food, selected, onToggle }) {
  return (
    <div
      className={`foodcard ${selected ? 'selected' : ''}`}
      onClick={() => onToggle(food.id)}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onToggle(food.id)
        }
      }}
    >
      {selected && <span className="check" aria-hidden="true">✓</span>}
      <ImageTile
        cat={food.cat}
        emoji={food.emoji}
        alt={food.name}
        loader={() => fetchFoodImage(food)}
      />
      <div className="foodcard-body">
        <div className="foodcard-name">{food.name}</div>
        <span className={`catpill ${food.cat}`}>{food.cat}</span>
      </div>
    </div>
  )
}
