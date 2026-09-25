import { describe, expect, it } from 'vitest'
import { buildSchedule, chunkSchedule } from '../server/planSchedule.js'

describe('long plan scheduling', () => {
  it('cycles weekdays across a 30-day plan and repeats the selected fasting weekday', () => {
    const schedule = buildSchedule(30, 'Tue')
    expect(schedule).toHaveLength(30)
    expect(schedule[7].day).toBe('Day 8 — Mon')
    expect(schedule[29].day).toBe('Day 30 — Tue')
    expect(schedule.filter((day) => day.is_fasting)).toHaveLength(5)
  })

  it('keeps every model request at seven days or fewer without losing days', () => {
    const chunks = chunkSchedule(buildSchedule(30, null))
    expect(chunks.map((chunk) => chunk.length)).toEqual([7, 7, 7, 7, 2])
    expect(chunks.flat()).toHaveLength(30)
  })
})
