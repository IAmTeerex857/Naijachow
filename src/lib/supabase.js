import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true },
    })
  : null

export async function accessToken() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || null
}

export async function saveUserPreferences(userId, preferences) {
  if (!supabase || !userId) return
  const { error: preferencesError } = await supabase.from('user_preferences').upsert({
    user_id: userId,
    goal: preferences.goal,
    household_size: preferences.householdSize,
    budget_level: preferences.budgetLevel,
    max_cooking_minutes: preferences.maxCookingMinutes,
  })
  if (preferencesError) throw preferencesError

  if (preferences.healthConsent) {
    const { error: healthError } = await supabase.from('health_profiles').upsert({
      user_id: userId,
      conditions: preferences.conditions,
      excluded_foods: preferences.foodsToAvoid
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
      clinician_instructions: preferences.clinicianInstructions.trim() || null,
      consented_at: new Date().toISOString(),
    })
    if (healthError) throw healthError
  } else {
    const { error: deleteError } = await supabase
      .from('health_profiles')
      .delete()
      .eq('user_id', userId)
    if (deleteError) throw deleteError
  }
}

export async function loadUserPreferences(userId) {
  if (!supabase || !userId) return null
  const [{ data: preferences, error: preferencesError }, { data: health, error: healthError }] =
    await Promise.all([
      supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('health_profiles').select('*').eq('user_id', userId).maybeSingle(),
    ])
  if (preferencesError) throw preferencesError
  if (healthError) throw healthError
  return {
    goal: preferences?.goal || 'balanced',
    householdSize: preferences?.household_size || 1,
    budgetLevel: preferences?.budget_level || 'moderate',
    maxCookingMinutes: preferences?.max_cooking_minutes || 45,
    conditions: health?.conditions || [],
    foodsToAvoid: (health?.excluded_foods || []).join(', '),
    clinicianInstructions: health?.clinician_instructions || '',
    healthConsent: Boolean(health?.consented_at),
  }
}

export async function saveMealPlan(planId, plan) {
  if (!supabase || !planId) throw new Error('This plan cannot be saved yet.')
  const { error } = await supabase
    .from('meal_plans')
    .update({ status: 'saved', saved_at: new Date().toISOString(), plan_data: plan })
    .eq('id', planId)
  if (error) throw error
}
