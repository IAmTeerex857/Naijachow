const BASE_URL = 'https://api.supadata.ai/v1'

async function request(path: string) {
  const apiKey = process.env.SUPADATA_API_KEY
  if (!apiKey) throw new Error('Supadata is not configured')
  const response = await fetch(`${BASE_URL}${path}`, { headers: { 'x-api-key': apiKey } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok && response.status !== 206) {
    const error = new Error(body.message || body.error || `Supadata request failed (${response.status})`)
    Object.assign(error, { status: response.status })
    throw error
  }
  return { status: response.status, body }
}

export async function getMetadata(url: string) {
  return (await request(`/metadata?url=${encodeURIComponent(url)}`)).body
}

export async function startTranscript(url: string) {
  return request(`/transcript?url=${encodeURIComponent(url)}&text=false&mode=auto`)
}

export async function getTranscriptJob(jobId: string) {
  return (await request(`/transcript/${encodeURIComponent(jobId)}`)).body
}
