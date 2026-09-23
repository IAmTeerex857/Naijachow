import fs from 'node:fs/promises'
import path from 'node:path'
import { FOOD_BY_ID } from '../src/data/foods.js'

const [outputDirectory, ...ids] = process.argv.slice(2)
if (!outputDirectory || !ids.length) {
  throw new Error('Usage: node scripts/discover-image-candidates.mjs <output-directory> <food-id...>')
}

const allowedLicenses = new Set(['cc0', 'pdm', 'by', 'by-sa'])
await fs.mkdir(outputDirectory, { recursive: true })
const manifest = []

for (const id of ids) {
  const food = FOOD_BY_ID[id]
  if (!food) continue
  const query = `${food.q} cooked plated dish`
  const response = await fetch(
    `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=10`
  )
  if (!response.ok) throw new Error(`Openverse failed for ${id} (${response.status})`)
  const payload = await response.json()
  const candidates = (payload.results || [])
    .filter((item) => allowedLicenses.has(item.license) && !item.mature && item.width >= 400 && item.height >= 300)
    .slice(0, 3)

  for (const [index, candidate] of candidates.entries()) {
    try {
      const imageResponse = await fetch(candidate.url, { signal: AbortSignal.timeout(15_000) })
      if (!imageResponse.ok) continue
      const contentType = imageResponse.headers.get('content-type') || ''
      if (!contentType.startsWith('image/')) continue
      const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
      const filename = `${id}-${index + 1}.${extension}`
      await fs.writeFile(path.join(outputDirectory, filename), Buffer.from(await imageResponse.arrayBuffer()))
      manifest.push({
        id: `${id}-${index + 1}`,
        name: `${food.name}: ${candidate.title}`,
        filename,
        source: candidate.license.toUpperCase(),
        foodId: id,
        creator: candidate.creator,
        attribution: candidate.attribution,
        license: candidate.license,
        licenseUrl: candidate.license_url,
        sourceUrl: candidate.foreign_landing_url,
      })
    } catch {
      // A dead provider URL is not a usable candidate.
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 3200))
}

await fs.writeFile(path.join(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`Downloaded ${manifest.length} licensed candidates for ${ids.length} dishes`)
