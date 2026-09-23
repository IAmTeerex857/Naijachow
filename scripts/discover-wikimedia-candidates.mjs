import fs from 'node:fs/promises'
import path from 'node:path'
import { FOOD_BY_ID } from '../src/data/foods.js'

const [outputDirectory, ...ids] = process.argv.slice(2)
if (!outputDirectory || !ids.length) {
  throw new Error('Usage: node scripts/discover-wikimedia-candidates.mjs <output-directory> <food-id...>')
}

const queryOverrides = {
  ewedugbegiri: 'ewedu gbegiri Nigerian food',
  fufu: 'fufu Nigerian food',
  semovita: 'semovita Nigerian food',
  whiterice: 'white rice stew Nigerian food',
  ofada: 'ofada rice Nigerian food',
  spaghetti: 'Nigerian spaghetti dish',
  moimoi: 'moi moi Nigerian food',
  custard: 'Nigerian custard breakfast',
  boiledyam: 'boiled yam Nigerian food',
  friedplantain: 'fried plantain dodo Nigerian food',
  sweetpotato: 'cooked sweet potato dish',
  irishpotato: 'boiled potato dish',
  friedfish: 'fried fish Nigerian food',
  beans: 'beans porridge Nigerian food',
  beef: 'beef stew Nigerian food',
  eggs: 'egg stew Nigerian food',
}

function plain(value) {
  return String(value || '').replace(/<[^>]+>/g, '').replace(/&[^;]+;/g, ' ').trim()
}

await fs.mkdir(outputDirectory, { recursive: true })
const manifest = []
for (const id of ids) {
  const food = FOOD_BY_ID[id]
  if (!food) continue
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: queryOverrides[id] || food.q,
    gsrnamespace: '6',
    gsrlimit: '10',
    prop: 'imageinfo',
    iiprop: 'url|size|mime|extmetadata',
    format: 'json',
    origin: '*',
  })
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`)
  if (!response.ok) continue
  const payload = await response.json()
  const pages = Object.values(payload.query?.pages || {})
  const candidates = pages
    .map((page) => ({ page, info: page.imageinfo?.[0] }))
    .filter(({ info }) => info?.url && info.width >= 400 && info.height >= 300 && info.mime?.startsWith('image/'))
    .filter(({ info }) => /CC|Creative Commons|Public domain/i.test(info.extmetadata?.LicenseShortName?.value || info.extmetadata?.UsageTerms?.value || ''))
    .slice(0, 3)

  for (const [index, { page, info }] of candidates.entries()) {
    try {
      const imageResponse = await fetch(info.url, { signal: AbortSignal.timeout(15_000) })
      if (!imageResponse.ok) continue
      const contentType = imageResponse.headers.get('content-type') || info.mime
      const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
      const filename = `${id}-${index + 1}.${extension}`
      await fs.writeFile(path.join(outputDirectory, filename), Buffer.from(await imageResponse.arrayBuffer()))
      const creator = plain(info.extmetadata?.Artist?.value)
      const license = plain(info.extmetadata?.LicenseShortName?.value || info.extmetadata?.UsageTerms?.value)
      manifest.push({
        id: `${id}-${index + 1}`,
        name: `${food.name}: ${page.title.replace(/^File:/, '')}`,
        filename,
        source: license,
        foodId: id,
        creator,
        attribution: `${page.title.replace(/^File:/, '')} by ${creator} (${license})`,
        license,
        licenseUrl: info.extmetadata?.LicenseUrl?.value || '',
        sourceUrl: info.descriptionurl,
      })
    } catch {
      // Skip transient and unsupported provider images.
    }
  }
}

await fs.writeFile(path.join(outputDirectory, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`Downloaded ${manifest.length} Wikimedia candidates for ${ids.length} dishes`)
