import { fetchWithTimeout } from './http.js'

function requiredEnvironment() {
  let bundled = {}
  if (process.env.OPENAI_API_ENVS) {
    try {
      bundled = JSON.parse(process.env.OPENAI_API_ENVS)
    } catch {
      throw new Error('OPENAI_API_ENVS must be valid JSON')
    }
  }
  const values = {
    endpoint: process.env.AZURE_OPENAI_ENDPOINT || bundled.endpoint,
    apiKey: process.env.AZURE_OPENAI_API_KEY || bundled.apiKey,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || bundled.apiVersion,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || bundled.deployment,
  }
  if (Object.values(values).some((value) => !value)) {
    throw new Error('Azure OpenAI is not configured')
  }
  return values
}

export async function generateStructuredJson({ prompt, schemaName, schema, maxTokens, timeoutMs = 55_000 }) {
  const { endpoint, apiKey, apiVersion, deployment } = requiredEnvironment()
  const base = endpoint.replace(/\/+$/, '')
  const requestBody = {
    model: deployment,
    messages: [
      {
        role: 'system',
        content:
          'You are NaijaPlate, a careful Nigerian meal-planning assistant. Follow the supplied candidate lists exactly and return only schema-valid JSON.',
      },
      { role: 'user', content: prompt },
    ],
    max_completion_tokens: maxTokens,
    response_format: {
      type: 'json_schema',
      json_schema: { name: schemaName, strict: true, schema },
    },
  }
  const options = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
    body: JSON.stringify(requestBody),
  }
  let response = await fetchWithTimeout(`${base}/openai/v1/chat/completions`, options, timeoutMs)
  if (response.status === 404) {
    const legacyBody = { ...requestBody }
    delete legacyBody.model
    response = await fetchWithTimeout(
      `${base}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`,
      { ...options, body: JSON.stringify(legacyBody) },
      timeoutMs
    )
  }

  if (!response.ok) throw new Error(`Azure OpenAI request failed (${response.status})`)
  const payload = await response.json()
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new Error('Azure OpenAI returned no content')
  return JSON.parse(content)
}
