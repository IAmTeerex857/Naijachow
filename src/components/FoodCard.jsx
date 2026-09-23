import ImageTile from './ImageTile'
import { fetchFoodImage } from '../lib/api'

export default function FoodCard({ food, selected, onToggle }) {
  return (
    <button
      type="button"
      className={`dishcard ${selected ? 'selected' : ''}`}
      onClick={() => onToggle(food.id)}
      aria-pressed={selected}
    >
      {selected && (
        <span className="check" aria-hidden="true">
          ✓
        </span>
      )}
      <ImageTile name={food.name} loader={() => fetchFoodImage(food)} />
      <div className="dishcard-body">
        <span className="dishcard-name">{food.name}</span>
        <span className={`catpill ${food.cat}`}>{food.cat}</span>
      </div>
    </button>
  )
}
