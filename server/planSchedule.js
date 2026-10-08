export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const FASTING_MESSAGES = [
  'Take today one steady step at a time.',
  'Let today be a quiet pause in your routine.',
  'Stay encouraged and keep your purpose in view.',
]
const SCRIPTURES = [
  'Matthew 6:17-18',
  'Isaiah 58:6',
  'Psalm 46:10',
]

export function buildSchedule(days, fastingDay, fastingType = 'food') {
  return Array.from({ length: days }, (_, index) => {
    const weekday = WEEKDAYS[index % WEEKDAYS.length]
    const isFasting = fastingDay === weekday
    return {
      day: `Day ${index + 1}, ${weekday}`,
      is_fasting: isFasting,
      ...(isFasting ? {
        fasting_message: FASTING_MESSAGES[index % FASTING_MESSAGES.length],
        ...(fastingType === 'spiritual' ? { scripture: SCRIPTURES[index % SCRIPTURES.length] } : {}),
      } : {}),
    }
  })
}

export function chunkSchedule(schedule, size = 7) {
  const chunks = []
  for (let index = 0; index < schedule.length; index += size) chunks.push(schedule.slice(index, index + size))
  return chunks
}
