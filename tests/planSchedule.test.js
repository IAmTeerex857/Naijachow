import { describe, expect, it } from 'vitest'
import { buildSchedule, chunkSchedule } from '../server/planSchedule.js'

describe('long plan scheduling', () => {
  it('cycles weekdays across a 30-day plan and repeats the selected fasting weekday', () => {
    const schedule = buildSchedule(30, 'Tue')
    expect(schedule).toHaveLength(30)
    expect(schedule[7].day).toBe('Day 8, Mon')
    expect(schedule[29].day).toBe('Day 30, Tue')
    expect(schedule.filter((day) => day.is_fasting)).toHaveLength(5)
  })

  it('keeps every model request at seven days or fewer without losing days', () => {
    const chunks = chunkSchedule(buildSchedule(30, null))
    expect(chunks.map((chunk) => chunk.length)).toEqual([7, 7, 7, 7, 2])
    expect(chunks.flat()).toHaveLength(30)
  })

  it('adds deterministic encouragement and spiritual scripture only when requested', () => {
    const spiritual = buildSchedule(8, 'Mon', 'spiritual')
    const general = buildSchedule(1, 'Mon')
    expect(spiritual[0]).toMatchObject({ is_fasting: true, scripture: 'Matthew 6:17-18' })
    expect(buildSchedule(8, 'Mon', 'spiritual')).toEqual(spiritual)
    expect(general[0].fasting_message).toBeTruthy()
    expect(general[0]).not.toHaveProperty('scripture')
  })
})
