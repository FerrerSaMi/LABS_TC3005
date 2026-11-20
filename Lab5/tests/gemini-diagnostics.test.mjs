import test from 'node:test'
import assert from 'node:assert/strict'
import { diagnoseGeminiError, diagnoseConnectionError } from '../gemini-diagnostics.mjs'

const headers = new Headers({ 'retry-after': '42' })

test('clasifica una cuota gratuita sin exponer la clave', () => {
  const secret = 'AQ.abcdefghijklmnopqrstuvwxyz1234567890'
  const result = diagnoseGeminiError(429, {
    error: {
      code: 429,
      status: 'RESOURCE_EXHAUSTED',
      message: `Quota exceeded for key ${secret}`,
      details: [{ violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests' }] }],
    },
  }, headers, secret, 'gemini-flash-latest')
  assert.equal(result.diagnostic.kind, 'FREE_TIER_LIMIT')
  assert.equal(result.diagnostic.retryAfter, '42')
  assert.ok(result.diagnostic.quotaMetric.includes('free_tier_requests'))
  assert.ok(!JSON.stringify(result).includes(secret))
})

test('separa créditos agotados, servicio no disponible y clave inválida', () => {
  assert.equal(diagnoseGeminiError(402, { error: { status: 'RESOURCE_EXHAUSTED' } }, null, '', 'model').diagnostic.kind, 'CREDITS_DEPLETED')
  assert.equal(diagnoseGeminiError(503, { error: { status: 'UNAVAILABLE' } }, null, '', 'model').diagnostic.kind, 'GEMINI_UNAVAILABLE')
  assert.equal(diagnoseGeminiError(400, { error: { details: [{ reason: 'API_KEY_INVALID' }] } }, null, '', 'model').diagnostic.kind, 'INVALID_API_KEY')
})

test('un timeout de red no se presenta como cuota agotada', () => {
  const result = diagnoseConnectionError({ name: 'TimeoutError' }, 'gemini-flash-latest')
  assert.equal(result.diagnostic.kind, 'CONNECTION_TIMEOUT')
  assert.match(result.explanation, /no confirma/i)
})
