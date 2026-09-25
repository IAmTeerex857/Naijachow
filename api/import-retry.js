import { tasks } from '@trigger.dev/sdk'
import { authenticatedUser, supabaseAdmin } from '../server/supabaseAdmin.js'
import { parseJsonBody, requireMethod, sendJson } from '../server/http.js'

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['POST'])) return
  const user = await authenticatedUser(req)
  if (!user) return sendJson(res, 401, { error: 'Sign in to retry this import.' })
  const body = parseJsonBody(req)
  if (typeof body.importId !== 'string') return sendJson(res, 400, { error: 'Invalid retry request.' })

  const db = supabaseAdmin()
  const { data: record, error } = await db
    .from('social_imports')
    .select('id,generation,processing_status')
    .eq('id', body.importId)
    .eq('user_id', user.id)
    .single()
  if (error || !record) return sendJson(res, 404, { error: 'Import not found.' })
  if (!['failed', 'cancelled'].includes(record.processing_status)) {
    return sendJson(res, 409, { error: 'Only failed or cancelled imports can be retried.' })
  }

  const generation = record.generation + 1
  const { data: updated, error: updateError } = await db
    .from('social_imports')
    .update({
      generation,
      processing_status: 'queued',
      review_status: 'not_ready',
      current_step: 'queued',
      trigger_run_id: null,
      supadata_job_id: null,
      error_code: null,
      error_message: null,
      started_at: null,
      completed_at: null,
    })
    .eq('id', record.id)
    .eq('generation', record.generation)
    .select('id')
    .maybeSingle()
  if (updateError || !updated) return sendJson(res, 409, { error: 'This import changed before it could be retried.' })

  try {
    const run = await tasks.trigger(
      'import-social-post',
      { importId: record.id, generation },
      { idempotencyKey: `social-import:${record.id}:${generation}` }
    )
    await db.from('social_imports').update({ trigger_run_id: run.id }).eq('id', record.id).eq('generation', generation)
    return sendJson(res, 202, { importId: record.id, generation })
  } catch (triggerError) {
    await db.from('social_imports').update({
      processing_status: 'failed',
      error_code: 'TRIGGER_FAILED',
      error_message: 'Could not restart import processing.',
    }).eq('id', record.id).eq('generation', generation)
    console.error('[Naijachow] Trigger.dev retry failed:', triggerError.message)
    return sendJson(res, 503, { error: 'Could not restart import processing.' })
  }
}
