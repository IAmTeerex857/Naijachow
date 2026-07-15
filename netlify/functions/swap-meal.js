const Anthropic = require('@anthropic-ai/sdk')

/* Rate limit: 30 req/hour/IP. */
const requestLog = new Map()
const RATE_LIMIT = 30
const WINDOW_MS = 60 * 60 * 1000

function isRateLimited(ip) {
  const now = Date.now()
  const data = requestLog.get(ip) || { count: 0, windowStart: now }
  if (now - data.windowStart > WINDOW_MS) {
    requestLog.set(ip, { count: 1, windowStart: now })
    return false
  }
  if (data.count >= RATE_LIMIT) return true
  data.count++
  requestLog.set(ip, data)
  return false
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  }
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' }
  if (event.httpMethod !== 'POST')
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }

  const ip = event.headers['x-forwarded-for'] || 'unknown'
  if (isRateLimited(ip))
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many swaps. Please wait an hour.' }) }
  if (!process.env.ANTHROPIC_API_KEY)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured.' }) }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { selectedFoods, mealType, currentMealName, otherMealsToday } = body
  if (!selectedFoods || selectedFoods.length < 3)
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Select at least 3 dishes.' }) }
  if (!['breakfast', 'lunch', 'dinner'].includes(mealType))
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid meal type.' }) }

  const safeFoods = selectedFoods
    .slice(0, 60)
    .filter((f) => typeof f === 'string')
    .map((f) => f.replace(/[^a-zA-Z0-9 \-()'&]/g, '').slice(0, 50))
  const safeCurrent = String(currentMealName || '').replace(/[^a-zA-Z0-9 \-()'&]/g, '').slice(0, 80)
  const safeOthers = (otherMealsToday || [])
    .slice(0, 4)
    .filter((m) => typeof m === 'string')
    .map((m) => m.replace(/[^a-zA-Z0-9 \-()'&]/g, '').slice(0, 80))

  const prompt = `You are a Nigerian meal-planning assistant. Suggest ONE different ${mealType} for a meal plan, using ONLY the finished dishes the user selected. You only pair and arrange — never invent a dish.

Selected dishes: ${safeFoods.join(', ')}
Current ${mealType} (must be DIFFERENT from this): ${safeCurrent}
Other meals already planned today (avoid clashing/repeating these): ${safeOthers.join(', ') || 'none'}

RULES:
- Return a DIFFERENT ${mealType} of the same type, built only from selected dishes.
- A soup must pair with a selected swallow or rice ("Egusi Soup with Eba"). Rice can stand alone or pair with a selected protein.
- Provide "dish_key": lowercase, swallow/carb FIRST, joined by " and " (e.g. "eba and egusi soup"); standalone dish = its lowercase name.

Respond ONLY with valid JSON — a single meal object, no markdown:
{ "name": "...", "dish_key": "...", "description": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "health_note": "...", "youtube_query": "..." }`

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content.map((c) => c.text || '').join('')
    const clean = text.replace(/```json|```/g, '').trim()
    const meal = JSON.parse(clean)
    console.log(`[NaijaPlate] swap tokens — in:${message.usage.input_tokens} out:${message.usage.output_tokens}`)
    return { statusCode: 200, headers, body: JSON.stringify(meal) }
  } catch (err) {
    console.error('[NaijaPlate] swap-meal error:', err.message)
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Could not swap this meal. Please try again.' }) }
  }
}
