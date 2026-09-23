import { makeCombo } from './combinations.js'
import { supabaseAdmin } from './supabaseAdmin.js'

export async function loadApprovedComboCandidates(selectedIds) {
  const selected = new Set(selectedIds)
  const { data, error } = await supabaseAdmin()
    .from('dish_combos')
    .select('canonical_name,meal_types,dish_combo_components(dish_id,position)')
    .eq('approval_status', 'approved')
  if (error) throw error

  const result = { breakfast: [], lunch: [], dinner: [] }
  for (const record of data || []) {
    const ids = [...(record.dish_combo_components || [])]
      .sort((a, b) => a.position - b.position)
      .map((component) => component.dish_id)
    if (!ids.length || ids.some((id) => !selected.has(id))) continue
    const candidate = { ...makeCombo(ids), name: record.canonical_name }
    for (const mealType of record.meal_types || []) {
      if (result[mealType]) result[mealType].push(candidate)
    }
  }
  return result
}
