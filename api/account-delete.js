import { authenticatedUser, supabaseAdmin } from '../server/supabaseAdmin.js'
import { parseJsonBody, requireMethod, sendJson } from '../server/http.js'
import { runs } from '@trigger.dev/sdk'
import { cancelBachsSubscriptionImmediately } from '../server/bachs.js'

export default async function handler(req, res) {
  if (!requireMethod(req, res, ['DELETE'])) return
  const user = await authenticatedUser(req)
  if (!user) return sendJson(res, 401, { error: 'Sign in to delete your account.' })
  const body = parseJsonBody(req)
  if (body.confirmation !== 'DELETE') {
    return sendJson(res, 400, { error: 'Type DELETE to confirm permanent account deletion.' })
  }

  const db = supabaseAdmin()
  let deletionStarted = false
  const { data: runningImports } = await db
    .from('social_imports')
    .select('trigger_run_id')
    .eq('user_id', user.id)
    .in('processing_status', ['queued', 'running'])
    .not('trigger_run_id', 'is', null)
  await Promise.allSettled((runningImports || []).map((item) => runs.cancel(item.trigger_run_id)))
  const { data: assets, error: assetError } = await db
    .from('assets')
    .select('bucket_id,object_path')
    .eq('owner_id', user.id)
  if (assetError) return sendJson(res, 500, { error: 'Could not inspect private files before deletion.' })
  const pathsByBucket = new Map()
  for (const asset of assets || []) {
    const paths = pathsByBucket.get(asset.bucket_id) || []
    paths.push(asset.object_path)
    pathsByBucket.set(asset.bucket_id, paths)
  }
  for (const [bucket, paths] of pathsByBucket) {
    const { error: storageError } = await db.storage.from(bucket).remove(paths)
    if (storageError) return sendJson(res, 500, { error: 'Could not remove private files.' })
  }

  try {
    const { data: subscriptions, error: subscriptionError } = await db.rpc('begin_bachs_account_deletion', {
      p_user_id: user.id,
    })
    if (subscriptionError) throw subscriptionError
    deletionStarted = true
    await Promise.all((subscriptions || []).map((subscription) =>
      cancelBachsSubscriptionImmediately(subscription.provider_subscription_id, 'Customer deleted account')
    ))
  } catch (error) {
    if (deletionStarted) {
      await db.rpc('abort_bachs_account_deletion', { p_user_id: user.id }).catch(() => {})
    }
    console.error('[Naijachow] subscription cancellation before account deletion failed:', error.message)
    return sendJson(res, 502, { error: 'Could not stop subscription billing. Your account was not deleted.' })
  }

  const { error } = await db.auth.admin.deleteUser(user.id)
  if (error) {
    if (deletionStarted) {
      await db.rpc('abort_bachs_account_deletion', { p_user_id: user.id }).catch(() => {})
    }
    console.error('[Naijachow] account deletion failed:', error.message)
    return sendJson(res, 500, { error: 'Could not delete the account.' })
  }
  return sendJson(res, 200, { deleted: true })
}
