import { authenticatedUser, supabaseAdmin } from '../server/supabaseAdmin.js'
import { parseJsonBody, requireMethod, sendJson } from '../server/http.js'
import { cancelBachsSubscriptionImmediately } from '../server/bachs.js'

async function listStoredFiles(storage, bucket, root) {
  const files = []
  const folders = [root]
  while (folders.length) {
    const prefix = folders.pop()
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await storage.from(bucket).list(prefix, { limit: 1000, offset })
      if (error) throw error
      for (const item of data || []) {
        const path = `${prefix}/${item.name}`
        if (item.id) files.push(path)
        else folders.push(path)
      }
      if (!data || data.length < 1000) break
    }
  }
  return files
}

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
  let uploadPaths
  try {
    uploadPaths = await listStoredFiles(db.storage, 'user-imports', user.id)
  } catch {
    return sendJson(res, 500, { error: 'Could not inspect private files before deletion.' })
  }
  if (uploadPaths.length) pathsByBucket.set('user-imports', [...new Set([...(pathsByBucket.get('user-imports') || []), ...uploadPaths])])

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
      const rollback = await db.rpc('abort_bachs_account_deletion', { p_user_id: user.id })
      if (rollback.error) console.error('[Naijachow] deletion rollback failed:', rollback.error.message)
    }
    console.error('[Naijachow] subscription cancellation before account deletion failed:', error.message)
    return sendJson(res, 502, { error: 'Could not stop subscription billing. Your account was not deleted.' })
  }

  for (const [bucket, paths] of pathsByBucket) {
    for (let index = 0; index < paths.length; index += 100) {
      const { error: storageError } = await db.storage.from(bucket).remove(paths.slice(index, index + 100))
      if (storageError) {
        if (deletionStarted) {
          const rollback = await db.rpc('abort_bachs_account_deletion', { p_user_id: user.id })
          if (rollback.error) console.error('[Naijachow] deletion rollback failed:', rollback.error.message)
        }
        return sendJson(res, 500, { error: 'Could not remove private files. Your account was not deleted.' })
      }
    }
  }

  const { error } = await db.auth.admin.deleteUser(user.id)
  if (error) {
    if (deletionStarted) {
      const rollback = await db.rpc('abort_bachs_account_deletion', { p_user_id: user.id })
      if (rollback.error) console.error('[Naijachow] deletion rollback failed:', rollback.error.message)
    }
    console.error('[Naijachow] account deletion failed:', error.message)
    return sendJson(res, 500, { error: 'Could not delete the account.' })
  }
  return sendJson(res, 200, { deleted: true })
}
