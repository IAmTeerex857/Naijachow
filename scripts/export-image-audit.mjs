import fs from 'node:fs/promises'
import path from 'node:path'
import { FOODS } from '../src/data/foods.js'

const outputDirectory = process.argv[2]
if (!outputDirectory) throw new Error('Usage: node scripts/export-image-audit.mjs <output-directory>')

function parseEnvironment(text) {
  const values = {}
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
    if (!match) continue
    values[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
  }
  return values
}

function extensionFor(contentType) {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  return 'jpg'
}

const environment = parseEnvironment(await fs.readFile('.env.local', 'utf8'))
const response = await fetch(
  `${environment.SUPABASE_URL}/rest/v1/image_cache?select=query_key,image_url,credit&limit=1000`,
  {
    headers: {
      apikey: environment.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${environment.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  }
)
if (!response.ok) throw new Error(`image_cache request failed (${response.status})`)
const rows = await response.json()
const rowsByKey = new Map(rows.map((row) => [row.query_key, row]))
await fs.mkdir(outputDirectory, { recursive: true })

const manifest = []
for (const food of FOODS) {
  const row = rowsByKey.get(`food:${food.id}`)
  if (!row?.image_url) continue
  let bytes
  let contentType
  if (row.image_url.startsWith('data:')) {
    const match = row.image_url.match(/^data:([^;,]+);base64,(.+)$/)
    if (!match) continue
    contentType = match[1]
    bytes = Buffer.from(match[2], 'base64')
  } else {
    const imageResponse = await fetch(row.image_url, { signal: AbortSignal.timeout(15_000) })
    if (!imageResponse.ok) continue
    contentType = imageResponse.headers.get('content-type') || 'image/jpeg'
    bytes = Buffer.from(await imageResponse.arrayBuffer())
  }
  const filename = `${food.id}.${extensionFor(contentType)}`
  await fs.writeFile(path.join(outputDirectory, filename), bytes)
  manifest.push({ id: food.id, name: food.name, filename, source: row.image_url.startsWith('data:') ? 'embedded' : 'external' })
}

await fs.writeFile(path.join(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`Exported ${manifest.length} images to ${outputDirectory}`)
