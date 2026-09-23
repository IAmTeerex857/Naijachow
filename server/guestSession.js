import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { supabaseAdmin } from './supabaseAdmin.js'

const COOKIE_NAME = 'np_guest'

function cookieValue(req, name) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=')
    if (key === name) return decodeURIComponent(value.join('='))
  }
  return null
}

export function guestTokenHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function getGuestToken(req) {
  return cookieValue(req, COOKIE_NAME)
}

function setGuestCookie(res, token) {
  const secure = process.env.VERCEL ? '; Secure' : ''
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=86400${secure}`
  )
}

export async function reserveGuestGeneration(req, res) {
  const db = supabaseAdmin()
  let token = getGuestToken(req)
  if (!token) {
    token = randomBytes(32).toString('base64url')
    setGuestCookie(res, token)
  }
  const tokenHash = guestTokenHash(token)
  const { data: existing, error: readError } = await db
    .from('guest_sessions')
    .select('id,generation_count,expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (readError) throw readError

  if (existing) {
    if (new Date(existing.expires_at) <= new Date()) {
      const { error: deleteError } = await db.from('guest_sessions').delete().eq('id', existing.id)
      if (deleteError) throw deleteError
      const { data, error } = await db
        .from('guest_sessions')
        .insert({ token_hash: tokenHash, generation_count: 1 })
        .select('id')
        .single()
      if (error) throw error
      return { id: data.id, tokenHash }
    }
    if (existing.generation_count >= 1) return null
    const { data, error } = await db
      .from('guest_sessions')
      .update({ generation_count: 1 })
      .eq('id', existing.id)
      .eq('generation_count', 0)
      .select('id')
      .maybeSingle()
    if (error) throw error
    return data ? { id: data.id, tokenHash } : null
  }

  const { data, error } = await db
    .from('guest_sessions')
    .insert({ token_hash: tokenHash, generation_count: 1 })
    .select('id')
    .single()
  if (error) throw error
  return { id: data.id, tokenHash }
}

export async function releaseGuestReservation(guestId) {
  if (!guestId) return
  await supabaseAdmin().from('guest_sessions').update({ generation_count: 0 }).eq('id', guestId)
}

export async function saveGeneratedPlan({ user, guestId, input, plan }) {
  const db = supabaseAdmin()
  const planningContext = input.preferences.healthConsent
    ? input.preferences
    : {
        goal: input.preferences.goal,
        householdSize: input.preferences.householdSize,
        budgetLevel: input.preferences.budgetLevel,
        maxCookingMinutes: input.preferences.maxCookingMinutes,
        healthConsent: false,
      }
  const { data, error } = await db.rpc('persist_generated_plan', {
    p_user_id: user?.id || null,
    p_guest_session_id: user ? null : guestId,
    p_duration_days: input.selectedDays,
    p_selected_dish_ids: input.selectedIds,
    p_plan_data: plan,
    p_model_deployment: process.env.AZURE_OPENAI_DEPLOYMENT || null,
    p_planning_context: planningContext,
    p_idempotency_key: randomUUID(),
  })
  if (error) throw error
  return data
}
