export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function buildSchedule(days, fastingDay) {
  return Array.from({ length: days }, (_, index) => {
    const weekday = WEEKDAYS[index % WEEKDAYS.length]
    return {
      day: `Day ${index + 1} — ${weekday}`,
      is_fasting: fastingDay === weekday,
    }
  })
}

export function chunkSchedule(schedule, size = 7) {
  const chunks = []
  for (let index = 0; index < schedule.length; index += size) chunks.push(schedule.slice(index, index + size))
  return chunks
}
