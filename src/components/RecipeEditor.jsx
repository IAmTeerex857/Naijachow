import { useState } from 'react'

function ingredientLines(ingredients) {
  return (ingredients || [])
    .map((ingredient) => `${ingredient.quantity || ''} | ${ingredient.item}`)
    .join('\n')
}

function parseIngredients(value) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [quantity, ...item] = line.split('|')
      return item.length
        ? { quantity: quantity.trim() || null, item: item.join('|').trim() }
        : { quantity: null, item: quantity.trim() }
    })
}

export default function RecipeEditor({ recipe, onSave, onCancel }) {
  const [title, setTitle] = useState(recipe.title || '')
  const [description, setDescription] = useState(recipe.description || '')
  const [ingredients, setIngredients] = useState(ingredientLines(recipe.ingredients))
  const [steps, setSteps] = useState((recipe.steps || []).join('\n'))
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    try {
      await onSave({
        recipeId: recipe.id,
        title,
        description,
        ingredients: parseIngredients(ingredients),
        steps: steps.split('\n').map((step) => step.trim()).filter(Boolean),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="recipe-editor" onSubmit={submit}>
      <label>
        Recipe title
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={160} required />
      </label>
      <label>
        Description
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={500} />
      </label>
      <label>
        Ingredients, one per line using quantity | ingredient
        <textarea value={ingredients} onChange={(event) => setIngredients(event.target.value)} placeholder="2 cups | rice" />
      </label>
      <label>
        Steps, one per line
        <textarea value={steps} onChange={(event) => setSteps(event.target.value)} />
      </label>
      <div className="import-review-actions">
        <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save corrections'}</button>
        <button className="btn btn-ghost" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
