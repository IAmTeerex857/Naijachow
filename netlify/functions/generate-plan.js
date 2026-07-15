const Anthropic = require('@anthropic-ai/sdk')

/* Rate limit: 10 req/hour/IP. In-memory Map — resets on cold start (acceptable). */
const requestLog = new Map()
const RATE_LIMIT = 10
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
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests. Please wait an hour.' }) }
  if (!process.env.ANTHROPIC_API_KEY)
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured.' }) }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const { selectedFoods, selectedDays, fastingDay } = body
  if (!selectedFoods || selectedFoods.length < 3)
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Select at least 3 dishes.' }) }
  if (!selectedDays || selectedDays < 1 || selectedDays > 30)
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Plan must be 1–30 days.' }) }

  const safeFoods = selectedFoods
    .slice(0, 60)
    .filter((f) => typeof f === 'string')
    .map((f) => f.replace(/[^a-zA-Z0-9 \-()'&]/g, '').slice(0, 50))
  const safeFastDay = fastingDay ? String(fastingDay).replace(/[^a-zA-Z]/g, '').slice(0, 10) : null
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const planDays = Array.from({ length: selectedDays }, (_, i) => {
    const label = `Day ${i + 1} — ${dayNames[i % 7]}`
    const isFasting = safeFastDay && dayNames[i % 7] === safeFastDay
    return { label, isFasting }
  })

  const prompt = `You are a Nigerian meal-planning assistant. Arrange a ${selectedDays}-day meal plan (breakfast, lunch, dinner) using ONLY the finished dishes the user selected. Pair them the way Nigerians actually eat.

Selected dishes: ${safeFoods.join(', ')}

CRITICAL RULES:
- Build ONLY from the selected dishes. NEVER invent a dish the user did not select. You only pair and arrange.
- A soup is NOT a meal on its own — every soup MUST be paired with a swallow or rice the user selected (e.g. "Egusi Soup with Pounded Yam").
- Rice dishes (Jollof, Fried Rice, White Rice & Stew, Ofada) can stand alone or pair with a selected protein/side.
- The meal "name" must reflect the pairing as served.
- Do not repeat the same pairing more than twice across the whole plan.
- For breakfast, prefer the LIGHTEST dish AMONG THE SELECTED ones (e.g. pap, custard, oats, akara, moi moi, bread, eggs or fruits — but ONLY if the user actually selected them). If the user selected no light dishes, still use one of the SELECTED dishes for breakfast (the lightest available). Under no circumstances introduce bread, egg, or any item that is not in the selected list.
- FINAL CHECK: every meal "name" and "dish_key" must be composed exclusively from the selected dishes listed above. If a dish is not in that list, it must not appear anywhere in the plan.
- For each meal, also return "dish_key": a NORMALISED lowercase key with the swallow/carb FIRST, joined by " and " — e.g. "pounded yam and egusi soup". The SAME combo must always produce the SAME dish_key regardless of phrasing. For a standalone dish, dish_key is just its lowercase name.
${safeFastDay ? '- On any FASTING day: set "is_fasting": true and omit breakfast/lunch/dinner.' : ''}

Day schedule: ${planDays.map((d) => `${d.label}${d.isFasting ? ' [FASTING]' : ''}`).join(', ')}

Respond ONLY with valid JSON — no markdown, no explanation:
{
  "days": [
    {
      "day": "Day 1 — Mon",
      "is_fasting": false,
      "total_calories": 1850,
      "breakfast": { "name": "Akara & Pap", "dish_key": "pap and akara", "description": "...", "calories": 420, "protein": 18, "carbs": 45, "fat": 12, "health_note": "...", "youtube_query": "how to make Akara Nigerian recipe" },
      "lunch":    { "name": "...", "dish_key": "...", "description": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "health_note": "...", "youtube_query": "..." },
      "dinner":   { "name": "...", "dish_key": "...", "description": "...", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "health_note": "...", "youtube_query": "..." }
    }
  ],
  "avg_calories": 1850,
  "avg_protein": "65g",
  "avg_carbs": "220g",
  "avg_fat": "48g",
  "balance_score": "8.2/10",
  "missing_ingredients": ["..."]
}`

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    })
    const text = message.content.map((c) => c.text || '').join('')
    const clean = text.replace(/```json|```/g, '').trim()
    const plan = JSON.parse(clean)
    console.log(`[NaijaPlate] plan tokens — in:${message.usage.input_tokens} out:${message.usage.output_tokens}`)
    return { statusCode: 200, headers, body: JSON.stringify(plan) }
  } catch (err) {
    console.error('[NaijaPlate] generate-plan error:', err.message)
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Could not generate meal plan. Please try again.' }) }
  }
}
