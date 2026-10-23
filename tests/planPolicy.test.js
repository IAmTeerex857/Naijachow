import { describe, expect, it } from 'vitest'
import {
  addFruitToPlan,
  assignMealCandidates,
  candidatesForSlot,
  fruitServings,
  mealFamily,
  mealStaple,
  swapCandidates,
} from '../server/planPolicy.js'
import { buildSchedule } from '../server/planSchedule.js'
import { candidateMap } from '../server/combinations.js'

const candidate = (key, score = 0) => ({ key, dish_key: key, food_ids: key.split('+'), preference_score: score })

describe('meal plan policy', () => {
  it('assigns different lunch and dinner families on every non-fasting day', () => {
    const candidates = {
      breakfast: [candidate('pap+akara'), candidate('oats+banana')],
      lunch: [candidate('jollof+beef', 2), candidate('friedrice+beef'), candidate('beans')],
      dinner: [candidate('jollof+grilledchicken', 2), candidate('friedrice+grilledchicken'), candidate('beans')],
    }
    const assigned = assignMealCandidates(buildSchedule(30, 'Tue'), candidates)
    for (const day of assigned.filter((item) => !item.is_fasting)) {
      expect(mealFamily(candidate(day.lunch_key))).not.toBe(mealFamily(candidate(day.dinner_key)))
    }
  })

  it('rotates globally before repeating a candidate', () => {
    const pool = [candidate('pap+akara', 2), candidate('oats+banana'), candidate('bread+eggs')]
    const candidates = { breakfast: pool, lunch: [candidate('jollof+beef'), candidate('beans')], dinner: [candidate('friedrice+beef'), candidate('spaghetti+beef')] }
    const assigned = assignMealCandidates(buildSchedule(6, null), candidates)
    expect(new Set(assigned.slice(0, 3).map((day) => day.breakfast_key)).size).toBe(3)
    const counts = assigned.reduce((map, day) => map.set(day.breakfast_key, (map.get(day.breakfast_key) || 0) + 1), new Map())
    expect(Math.max(...counts.values()) - Math.min(...counts.values())).toBeLessThanOrEqual(1)
  })

  it('anchors the plan on selected foods without serving the same staple or protein twice a day', () => {
    const assigned = assignMealCandidates(buildSchedule(7, null), candidateMap(['jollof', 'friedrice', 'grilledchicken']), 'seed')
    const lunches = assigned.map((day) => day.lunch_key)
    expect(lunches.filter((key) => /jollof|friedrice/.test(key)).length).toBeGreaterThanOrEqual(5)
    for (const day of assigned) {
      const meals = [day.breakfast_key, day.lunch_key, day.dinner_key].map(candidate)
      expect(new Set(meals.map(mealStaple)).size).toBe(3)
      const components = meals.flatMap((meal) => meal.food_ids)
      expect(new Set(components).size).toBe(components.length)
    }
  })

  it('spreads selected swallows across soups instead of reusing one', () => {
    const assigned = assignMealCandidates(buildSchedule(3, null), candidateMap(['tuwo', 'wheatswallow', 'semovita']), 'seed')
    const swallows = assigned.map((day) => candidate(day.lunch_key).food_ids[1])
    expect(new Set(swallows)).toEqual(new Set(['tuwo', 'wheatswallow', 'semovita']))
  })

  it('swaps to the most preferred unused meal', () => {
    const result = swapCandidates([candidate('beans+bread', 0), candidate('pap+akara', 2), candidate('custard+akara', 1)], {
      currentMeal: candidate('bread+eggs'),
      usedKeys: new Set(['custard+akara']),
    })
    expect(result.map((item) => item.key)).toEqual(['pap+akara', 'beans+bread', 'custard+akara'])
  })

  it('rejects soup and swallow dinners even when supplied by another candidate source', () => {
    const dinner = candidatesForSlot([candidate('egusi+eba'), candidate('jollof+beef')], 'dinner')
    expect(dinner.map((item) => item.key)).toEqual(['jollof+beef'])
  })

  it('avoids current, same-day, and historical families during swaps', () => {
    const choices = [candidate('jollof+beef'), candidate('jollof+friedfish'), candidate('beans'), candidate('spaghetti+beef')]
    const result = swapCandidates(choices, {
      currentMeal: candidate('jollof+grilledchicken'),
      sameDayMeals: [candidate('beans')],
      history: ['spaghetti+beef'],
      usedKeys: new Set(),
    })
    expect(result).toEqual([])
  })

  it('rotates selected snack fruit across non-fasting days and excludes non-snack produce', () => {
    const selected = ['banana', 'orange', 'coleslaw', 'cucumber', 'lemon', 'lime']
    expect(fruitServings(selected)).toEqual(['banana', 'orange'])
    const days = addFruitToPlan(buildSchedule(4, 'Tue').map((day) => ({ ...day, total_calories: 1000 })), selected)
    expect(days.map((day) => day.snack?.food_ids[0] || null)).toEqual(['banana', null, 'orange', 'banana'])
    expect(days[0].total_calories).toBe(1105)
  })

  it('offers common fruit every non-fasting day when none was selected', () => {
    const days = addFruitToPlan(buildSchedule(3, null).map((day) => ({ ...day, total_calories: 0 })), ['jollof', 'egusi', 'eba'])
    expect(days.map((day) => day.snack?.food_ids[0])).toEqual(['banana', 'orange', 'pawpaw'])
    expect(fruitServings([], 'bananas, oranges')).not.toEqual(expect.arrayContaining(['banana', 'orange']))
    expect(fruitServings([], 'fruit')).toEqual([])
  })
})
