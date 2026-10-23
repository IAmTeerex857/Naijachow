// Publishes the reviewed Wikimedia Commons photos in catalog-images.json.
// Every photo is copied into the public catalog-assets bucket. Food photos are registered
// as approved assets; exact meal photos are registered in meal_media with their source.
// Licence, creator, and image URLs are read live from Commons, never typed by hand.
//
// Usage: node scripts/sync-catalog-images.mjs [--dry-run]
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { FOOD_BY_ID } from '../src/data/foods.js'
import { CURATED_MEALS } from '../server/curatedMeals.js'

const DRY_RUN = process.argv.includes('--dry-run')
const BUCKET = 'catalog-assets'
const USER_AGENT = 'NaijachowCatalogBot/1.0 (https://www.naijachow.xyz; hello@naijachow.xyz)'
const ALLOWED_LICENSE = /^(CC0|Public domain|CC BY(-SA)? \d(\.\d)?)$/i

function parseEnvironment(text) {
  const values = {}
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
  return values
}

const environment = {
  ...parseEnvironment(await fs.readFile('.env.local', 'utf8').catch(() => '')),
  ...process.env,
}
const SUPABASE_URL = environment.SUPABASE_URL
const SERVICE_KEY = environment.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
const serviceHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }

// Cards are small, so 720px JPEGs are plenty. macOS has sips built in; elsewhere the
// Commons thumbnail is uploaded unchanged.
async function compress(bytes, contentType) {
  if (process.platform !== 'darwin') return { bytes, contentType }
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'naijachow-image-'))
  try {
    const source = path.join(directory, contentType.includes('png') ? 'source.png' : 'source.jpg')
    const output = path.join(directory, 'output.jpg')
    await fs.writeFile(source, bytes)
    execFileSync('sips', ['-Z', '720', '-s', 'format', 'jpeg', '-s', 'formatOptions', '80', source, '--out', output], { stdio: 'ignore' })
    return { bytes: await fs.readFile(output), contentType: 'image/jpeg' }
  } finally {
    await fs.rm(directory, { recursive: true, force: true })
  }
}

const plain = (value) => String(value || '').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').replace(/\s+/g, ' ').trim()

async function commonsInfo(titles) {
  const info = new Map()
  for (let index = 0; index < titles.length; index += 40) {
    const params = new URLSearchParams({
      action: 'query',
      titles: titles.slice(index, index + 40).join('|'),
      prop: 'imageinfo',
      iiprop: 'url|mime|extmetadata',
      iiurlwidth: '960',
      format: 'json',
    })
    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`Commons lookup failed (${response.status})`)
    const payload = await response.json()
    const normalized = Object.fromEntries((payload.query?.normalized || []).map(({ from, to }) => [to, from]))
    for (const page of Object.values(payload.query?.pages || {})) {
      const image = page.imageinfo?.[0]
      if (!image) continue
      const license = plain(image.extmetadata?.LicenseShortName?.value)
      const creator = plain(image.extmetadata?.Artist?.value).slice(0, 80)
      info.set(normalized[page.title] || page.title, {
        title: page.title,
        license,
        creator,
        thumbnailUrl: image.thumburl,
        width: image.thumbwidth,
        height: image.thumbheight,
        mime: image.mime,
        sourceUrl: image.descriptionurl,
        credit: `${creator}, ${license}, Wikimedia Commons`,
      })
    }
  }
  return info
}

async function rest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...serviceHeaders, 'Content-Type': 'application/json', ...options.headers },
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${path} failed (${response.status}): ${text}`)
  return text ? JSON.parse(text) : null
}

const manifest = JSON.parse(await fs.readFile(new URL('./catalog-images.json', import.meta.url), 'utf8'))
const mealNames = Object.fromEntries(CURATED_MEALS.map((meal) => [meal.ids.join('+'), meal.name]))
for (const id of Object.keys(manifest.foods)) if (!FOOD_BY_ID[id]) throw new Error(`Unknown food id ${id}`)
for (const key of Object.keys(manifest.meals)) if (!mealNames[key]) throw new Error(`Unknown curated meal ${key}`)

const info = await commonsInfo([...new Set([...Object.values(manifest.foods), ...Object.values(manifest.meals)])])
const problems = [...Object.values(manifest.foods), ...Object.values(manifest.meals)]
  .filter((title) => !info.get(title) || !ALLOWED_LICENSE.test(info.get(title).license) || !info.get(title).creator)
// Every licence we accept requires naming the creator, so a file without one cannot be used.
if (problems.length) throw new Error(`Missing, non-free, or uncredited Commons files:\n${problems.join('\n')}`)

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function download(url) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    await pause(400)
    const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (response.ok) return response
    if (response.status !== 429 || attempt === 4) throw new Error(`Download failed for ${url} (${response.status})`)
    await pause(attempt * 5000)
  }
}

// Copies a Commons photo into our bucket so pages never depend on Wikimedia hotlinking.
// The checksum in the path lets the file be cached forever; a new photo gets a new URL.
async function storeImage(folder, key, image) {
  const response = await download(image.thumbnailUrl)
  const { bytes, contentType } = await compress(
    Buffer.from(await response.arrayBuffer()),
    response.headers.get('content-type') || image.mime
  )
  const checksum = createHash('sha256').update(bytes).digest('hex')
  const slug = key.replace(/[^a-z0-9]+/g, '-')
  const objectPath = `${folder}/${slug}-${checksum.slice(0, 10)}.${contentType.includes('png') ? 'png' : 'jpg'}`
  const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${objectPath}`, {
    method: 'POST',
    headers: { ...serviceHeaders, 'Content-Type': contentType, 'Cache-Control': 'public, max-age=31536000, immutable', 'x-upsert': 'true' },
    body: bytes,
  })
  if (!upload.ok) throw new Error(`Upload failed for ${key} (${upload.status}): ${await upload.text()}`)
  return { objectPath, bytes, contentType, checksum, publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${objectPath}` }
}

for (const [foodId, title] of Object.entries(manifest.foods)) {
  const image = info.get(title)
  console.log(`${DRY_RUN ? '[dry run] ' : ''}food ${foodId} <- ${title} (${image.license})`)
  if (DRY_RUN) continue
  const { objectPath, bytes, contentType, checksum } = await storeImage('foods', foodId, image)

  await rest('assets?on_conflict=bucket_id,object_path', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      dish_id: foodId,
      bucket_id: BUCKET,
      object_path: objectPath,
      visibility: 'public',
      mime_type: contentType,
      byte_size: bytes.length,
      width: image.width,
      height: image.height,
      source_url: image.sourceUrl,
      source_creator: image.creator,
      license: image.license,
      attribution: image.credit,
      checksum,
      review_status: 'approved',
    }),
  })
  // Retire any earlier photo for this food so exactly one approved asset remains.
  await rest(`assets?dish_id=eq.${encodeURIComponent(foodId)}&bucket_id=eq.${BUCKET}&object_path=neq.${encodeURIComponent(objectPath)}&review_status=eq.approved`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ review_status: 'rejected' }),
  })
}

const mealRows = []
for (const [dishKey, title] of Object.entries(manifest.meals)) {
  const image = info.get(title)
  console.log(`${DRY_RUN ? '[dry run] ' : ''}meal ${dishKey} <- ${title} (${image.license})`)
  if (DRY_RUN) continue
  const { publicUrl } = await storeImage('meals', dishKey, image)
  const now = new Date().toISOString()
  mealRows.push({
    dish_key: dishKey,
    meal_name: mealNames[dishKey],
    thumbnail_url: publicUrl,
    source_url: image.sourceUrl,
    source_title: image.title.replace(/^File:/, ''),
    source_creator: image.creator,
    credit: image.credit,
    source_type: 'wikimedia',
    verified_at: now,
    review_status: 'approved',
    composition: 'exact_combo',
    reviewed_at: now,
  })
}
if (mealRows.length) {
  await rest('meal_media?on_conflict=dish_key', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(mealRows),
  })
}
console.log(`${DRY_RUN ? 'Checked' : 'Published'} ${Object.keys(manifest.foods).length} food photos and ${Object.keys(manifest.meals).length} meal photos.`)
