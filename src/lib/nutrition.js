/* ===========================================================================
   Nutrition is always DERIVED from the meals currently on screen — never read
   from the model's own avg_* / total_calories snapshot.

   That snapshot describes the plan as first generated, so the moment a meal is
   swapped it disagrees with the meals beneath it. Computing here means the
   numbers cannot drift out of step with what the user is actually looking at.
   =========================================================================== */

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner']

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)

/** Meals of one day, in slot order, skipping empty slots. */
export function mealsOf(day) {
  if (!day || day.is_fasting) return []
  return MEAL_TYPES.map((t) => day[t]).filter(Boolean)
}

/** Total kcal for a day, summed from its meals. */
export function dayCalories(day) {
  const meals = mealsOf(day)
  if (!meals.length) return null
  return meals.reduce((sum, m) => sum + num(m.calories), 0)
}

/* Balance grade from average protein, per the handoff: A / A− / B+. */
function balanceGrade(avgProtein) {
  if (avgProtein >= 34) return 'A'
  if (avgProtein >= 26) return 'A−'
  return 'B+'
}

/** Averages across non-fasting days, for the nutrition strip. */
export function planNutrition(days = []) {
  let calories = 0
  let protein = 0
  let carbs = 0
  let fat = 0
  let counted = 0

  days.forEach((day) => {
    const meals = mealsOf(day)
    if (!meals.length) return
    counted++
    meals.forEach((m) => {
      calories += num(m.calories)
      protein += num(m.protein)
      carbs += num(m.carbs)
      fat += num(m.fat)
    })
  })

  const n = counted || 1
  const avgProtein = Math.round(protein / n)

  return {
    calories: Math.round(calories / n),
    protein: avgProtein,
    carbs: Math.round(carbs / n),
    fat: Math.round(fat / n),
    balance: balanceGrade(avgProtein),
    days: counted,
  }
}
