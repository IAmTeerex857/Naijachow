import { task, wait } from '@trigger.dev/sdk'
import { z } from 'zod'
import { generateStructuredJson } from '../server/azureOpenAI.js'
import { getMetadata, getTranscriptJob, startTranscript } from './lib/supadata'
import { triggerDatabase } from './lib/supabase'

const recipeSchema = z.object({
  title: z.string().min(1).max(160),
  description: z.string().max(500),
  servings: z.number().int().min(1).max(100).nullable(),
  prep_minutes: z.number().int().min(0).max(1440).nullable(),
  cook_minutes: z.number().int().min(0).max(1440).nullable(),
  ingredients: z.array(z.object({ item: z.string(), quantity: z.string().nullable() })).max(100),
  steps: z.array(z.string().min(1).max(1000)).max(50),
  dish_ids: z.array(z.string()).max(10),
  review_claims: z.array(z.string().max(500)).max(20),
  confidence: z.number().min(0).max(1),
})

const recipeJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'servings', 'prep_minutes', 'cook_minutes', 'ingredients', 'steps', 'dish_ids', 'review_claims', 'confidence'],
  properties: {
    title: { type: 'string' }, description: { type: 'string' },
    servings: { anyOf: [{ type: 'integer', minimum: 1 }, { type: 'null' }] },
    prep_minutes: { anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }] },
    cook_minutes: { anyOf: [{ type: 'integer', minimum: 0 }, { type: 'null' }] },
    ingredients: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['item', 'quantity'], properties: { item: { type: 'string' }, quantity: { anyOf: [{ type: 'string' }, { type: 'null' }] } } } },
    steps: { type: 'array', items: { type: 'string' } },
    dish_ids: { type: 'array', items: { type: 'string' } },
    review_claims: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
}

export const importSocialPost = task({
  id: 'import-social-post',
  maxDuration: 900,
  queue: { concurrencyLimit: 1 },
  retry: { maxAttempts: 4, minTimeoutInMs: 2_000, maxTimeoutInMs: 60_000, factor: 2 },
  onFailure: async ({ payload, error }) => {
    const message = error instanceof Error ? error.message : 'Import worker failed'
    await triggerDatabase().from('social_imports').update({
      processing_status: 'failed',
      current_step: 'failed',
      error_code: 'WORKER_FAILED',
      error_message: message.slice(0, 500),
      completed_at: new Date().toISOString(),
    }).eq('id', payload.importId).eq('generation', payload.generation)
  },
  run: async ({ importId, generation }: { importId: string; generation: number }) => {
    const db = triggerDatabase()
    const { data: record, error } = await db.from('social_imports').select('*').eq('id', importId).single()
    if (error || !record) throw new Error('Import record not found')
    if (record.generation !== generation) return { importId, stale: true }
    if (record.processing_status === 'succeeded') return { importId, alreadyComplete: true }

    const running = await db.from('social_imports').update({ processing_status: 'running', current_step: 'metadata', started_at: new Date().toISOString() }).eq('id', importId).eq('generation', generation).select('id').maybeSingle()
    if (running.error || !running.data) throw new Error('Import state changed before processing began')

    try {
      const metadata = record.metadata || await getMetadata(record.canonical_url)
      if (!record.metadata) {
        const metadataUpdate = await db.from('social_imports').update({ metadata, external_media_id: metadata.id || null, current_step: 'transcript' }).eq('id', importId).eq('generation', generation).select('id').maybeSingle()
        if (metadataUpdate.error || !metadataUpdate.data) throw new Error('Could not persist social metadata')
        await wait.for({ seconds: 1 })
      }

      let transcript = record.transcript_text
        ? { content: record.transcript_chunks?.length ? record.transcript_chunks : record.transcript_text }
        : null
      let jobId = record.supadata_job_id
      if (!transcript && !jobId) {
        const transcriptResponse = await startTranscript(record.canonical_url)
        transcript = transcriptResponse.status === 206 ? { content: '' } : transcriptResponse.body
        jobId = transcriptResponse.status === 202 ? transcriptResponse.body.jobId : null
      }
      if (jobId) {
        const jobUpdate = await db.from('social_imports').update({ supadata_job_id: jobId }).eq('id', importId).eq('generation', generation).select('id').maybeSingle()
        if (jobUpdate.error || !jobUpdate.data) throw new Error('Could not persist transcript job')
        let completed = false
        for (let attempt = 0; attempt < 180; attempt += 1) {
          await wait.for({ seconds: 3 })
          const job = await getTranscriptJob(jobId)
          transcript = job
          if (job.status === 'completed') { completed = true; break }
          if (job.status === 'failed') throw new Error('Supadata could not transcribe this post')
        }
        if (!completed) throw new Error('Transcript timed out')
      }

      if (!transcript) throw new Error('No transcript result was returned')

      const chunks = Array.isArray(transcript.content) ? transcript.content : []
      const text = typeof transcript.content === 'string'
        ? transcript.content
        : chunks.map((chunk: { text?: string }) => chunk.text || '').join(' ')
      const transcriptUpdate = await db.from('social_imports').update({ transcript_text: text, transcript_chunks: chunks, current_step: 'extracting' }).eq('id', importId).eq('generation', generation).select('id').maybeSingle()
      if (transcriptUpdate.error || !transcriptUpdate.data) throw new Error('Could not persist transcript')

      const { data: dishes, error: dishesError } = await db.from('dishes').select('id,name,category').eq('active', true)
      if (dishesError) throw dishesError
      const extracted = recipeSchema.parse(await generateStructuredJson({
        prompt: `Extract a recipe candidate and separately list subjective review claims. Use only dish_ids from this catalogue when there is a clear match: ${JSON.stringify(dishes || [])}. Never invent quantities or steps; use null or an empty array when the source does not say. Source metadata: ${JSON.stringify(metadata)}. Transcript: ${text.slice(0, 30000)}`,
        schemaName: 'naijaplate_social_recipe',
        schema: recipeJsonSchema,
        maxTokens: 3000,
        timeoutMs: 90_000,
      }))
      const validDishIds = new Set((dishes || []).map((dish) => dish.id))
      if (extracted.dish_ids.some((id) => !validDishIds.has(id))) throw new Error('Extraction returned an unknown dish')

      const { data: recipe, error: recipeError } = await db.from('recipes').upsert({
        source_import_id: importId,
        owner_id: record.user_id,
        title: extracted.title,
        description: extracted.description,
        servings: extracted.servings,
        prep_minutes: extracted.prep_minutes,
        cook_minutes: extracted.cook_minutes,
        ingredients: extracted.ingredients,
        steps: extracted.steps,
        dish_ids: extracted.dish_ids,
        source_url: record.canonical_url,
        source_creator: metadata.author?.displayName || metadata.author?.username || null,
        extraction_confidence: extracted.confidence,
        status: 'needs_review',
      }, { onConflict: 'source_import_id' }).select('id').single()
      if (recipeError) throw recipeError

      const completedUpdate = await db.from('social_imports').update({
        processing_status: 'succeeded', review_status: 'pending', current_step: 'review',
        recipe_id: recipe.id, extracted_claims: extracted.review_claims,
        completed_at: new Date().toISOString(), error_code: null, error_message: null,
      }).eq('id', importId).eq('generation', generation).select('id').maybeSingle()
      if (completedUpdate.error || !completedUpdate.data) throw new Error('Could not complete import record')
      return { importId, recipeId: recipe.id }
    } catch (taskError) {
      const message = taskError instanceof Error ? taskError.message : 'Import failed'
      await db.from('social_imports').update({ processing_status: 'failed', current_step: 'failed', error_code: 'IMPORT_FAILED', error_message: message.slice(0, 500), completed_at: new Date().toISOString() }).eq('id', importId).eq('generation', generation)
      throw taskError
    }
  },
})
