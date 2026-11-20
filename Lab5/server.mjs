import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { diagnoseGeminiError, diagnoseConnectionError } from './gemini-diagnostics.mjs'

const root = fileURLToPath(new URL('.', import.meta.url))
const envPath = join(root, '.env')
if (existsSync(envPath)) process.loadEnvFile(envPath)

const production = process.argv.includes('--production')
const port = Number(process.env.PORT || 5173)
const model = 'gemini-flash-latest'
const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

const vite = production ? null : await import('vite').then(({ createServer: createViteServer }) =>
  createViteServer({ server: { middlewareMode: true }, appType: 'spa' }),
)

function json(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
  response.end(JSON.stringify(data))
}

async function readJson(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (body.length > 100_000) throw new Error('too-large')
  }
  return JSON.parse(body)
}

async function handleChat(request, response) {
  if (request.method !== 'POST') return json(response, 405, { error: 'Método no permitido.' })
  if (!process.env.GEMINI_API_KEY) return json(response, 503, {
    error: 'Falta configurar GEMINI_API_KEY en .env.',
    explanation: 'El servidor no envió ninguna solicitud a Gemini.',
    diagnostic: { kind: 'MISSING_API_KEY', model },
  })

  let payload
  try {
    payload = await readJson(request)
  } catch (error) {
    if (error?.message === 'too-large') return json(response, 413, { error: 'La conversación es demasiado larga.' })
    return json(response, 400, { error: 'El JSON de la solicitud no es válido.' })
  }
  const messages = payload?.messages
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 30) {
    return json(response, 400, { error: 'La conversación no es válida.' })
  }
  const valid = messages.every(message =>
    ['user', 'model'].includes(message?.role) &&
    typeof message.text === 'string' &&
    message.text.trim().length > 0 &&
    message.text.length <= 6000,
  )
  if (!valid || messages.at(-1).role !== 'user') {
    return json(response, 400, { error: 'El mensaje no es válido.' })
  }

  let upstream
  try {
    upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: messages.map(({ role, text }) => ({ role, parts: [{ text: text.trim() }] })),
        generationConfig: { maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(30_000),
    })

  } catch (error) {
    const diagnosis = diagnoseConnectionError(error, model)
    console.error('[Gemini:connection]', diagnosis.diagnostic)
    return json(response, diagnosis.diagnostic.kind === 'CONNECTION_TIMEOUT' ? 504 : 502, diagnosis)
  }

  if (!upstream.ok) {
    const raw = await upstream.text().catch(() => '')
    let providerPayload
    try {
      providerPayload = JSON.parse(raw)
    } catch {
      providerPayload = { rawMessage: raw }
    }
    const diagnosis = diagnoseGeminiError(upstream.status, providerPayload, upstream.headers, process.env.GEMINI_API_KEY, model)
    console.error('[Gemini:response]', diagnosis.diagnostic)
    return json(response, upstream.status, diagnosis)
  }

  let data
  try {
    data = await upstream.json()
  } catch {
    return json(response, 502, {
      error: 'Gemini devolvió una respuesta que no es JSON.',
      explanation: 'No se puede determinar el estado de la cuota con esta respuesta.',
      diagnostic: { kind: 'INVALID_PROVIDER_RESPONSE', httpStatus: upstream.status, model },
    })
  }
  const parts = data?.candidates?.[0]?.content?.parts
  const answer = Array.isArray(parts)
    ? parts.filter(part => typeof part.text === 'string').map(part => part.text).join('\n').trim()
    : ''
  if (!answer) {
    return json(response, 502, {
      error: 'Gemini no devolvió texto.',
      explanation: 'Puede que la respuesta se haya bloqueado o detenido. Revisa los motivos de finalización.',
      diagnostic: {
        kind: 'NO_TEXT_RESPONSE',
        httpStatus: upstream.status,
        blockReason: data?.promptFeedback?.blockReason,
        finishReason: data?.candidates?.[0]?.finishReason,
        model,
      },
    })
  }
  return json(response, 200, { answer })
}

const mime = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2',
}

async function serveStatic(request, response) {
  const dist = resolve(root, 'dist')
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname)
  const file = resolve(dist, `.${pathname}`)
  if (file !== dist && !file.startsWith(dist + sep)) return json(response, 403, { error: 'Acceso denegado.' })
  let target = file
  try {
    if (!(await stat(target)).isFile()) target = join(dist, 'index.html')
  } catch {
    target = join(dist, 'index.html')
  }
  try {
    const contents = await readFile(target)
    response.writeHead(200, { 'Content-Type': mime[extname(target)] || 'application/octet-stream' })
    response.end(contents)
  } catch {
    json(response, 404, { error: 'Archivo no encontrado.' })
  }
}

createServer((request, response) => {
  if (new URL(request.url, 'http://localhost').pathname === '/api/chat') {
    void handleChat(request, response)
  } else if (vite) {
    vite.middlewares(request, response, () => json(response, 404, { error: 'No encontrado.' }))
  } else {
    void serveStatic(request, response)
  }
}).listen(port, () => console.log(`SANTI.AI listo en http://localhost:${port}`))
