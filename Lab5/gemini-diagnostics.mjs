function safeText(value, secret = '', limit = 700) {
  let text = String(value || '')
  if (secret) text = text.replaceAll(secret, '[clave oculta]')
  return text
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, '[clave oculta]')
    .replace(/AQ\.[A-Za-z0-9_-]{20,}/g, '[clave oculta]')
    .replace(/([?&]key=)[^\s&]+/gi, '$1[clave oculta]')
    .slice(0, limit)
}

function safeIdentifier(value, limit = 180) {
  return typeof value === 'string' ? value.replace(/[^A-Za-z0-9_./:-]/g, '').slice(0, limit) : undefined
}

export function diagnoseGeminiError(httpStatus, payload, headers, secret, model) {
  const provider = payload?.error && typeof payload.error === 'object' ? payload.error : {}
  const details = Array.isArray(provider.details) ? provider.details : []
  const reasons = details.map(item => item?.reason).filter(Boolean)
  const violations = details.flatMap(item => Array.isArray(item?.violations) ? item.violations : [])
  const quotaMetric = safeIdentifier(violations.find(item => item?.quotaMetric)?.quotaMetric)
  const providerMessage = safeText(provider.message || payload?.rawMessage, secret)
  const reason = safeIdentifier(reasons[0])
  const providerStatus = safeIdentifier(provider.status)
  const retryDelay = details.find(item => typeof item?.retryDelay === 'string')?.retryDelay
  const retryAfter = safeText(headers?.get?.('retry-after') || retryDelay || '', '', 60) || undefined
  const freeTier = /free.?tier/i.test(`${quotaMetric || ''} ${providerMessage}`)

  let kind = 'GEMINI_ERROR'
  let error = 'Gemini rechazó la solicitud.'
  let explanation = 'Revisa el mensaje de Google en los detalles técnicos.'

  if (httpStatus === 429) {
    kind = freeTier ? 'FREE_TIER_LIMIT' : 'RATE_OR_QUOTA_LIMIT'
    error = freeTier ? 'Se alcanzó un límite del plan gratuito.' : 'Se alcanzó un límite de cuota o velocidad.'
    explanation = 'Puede ser un límite por minuto, por día o de tokens. Consulta el límite exacto en Google AI Studio.'
  } else if (httpStatus === 402) {
    kind = 'CREDITS_DEPLETED'
    error = 'Los créditos prepagados de Gemini están agotados.'
    explanation = 'Revisa la facturación y el proyecto de la clave en Google AI Studio.'
  } else if (httpStatus === 400 && (reason === 'API_KEY_INVALID' || /api key not valid|invalid api key/i.test(providerMessage))) {
    kind = 'INVALID_API_KEY'
    error = 'La clave de Gemini no es válida.'
    explanation = 'Revisa GEMINI_API_KEY en .env y que la clave pertenezca al proyecto correcto.'
  } else if (httpStatus === 400) {
    kind = 'INVALID_REQUEST'
    error = 'Gemini rechazó el formato de la solicitud.'
    explanation = 'Revisa el mensaje de Google para identificar el campo o parámetro inválido.'
  } else if (httpStatus === 401 || httpStatus === 403) {
    kind = 'ACCESS_DENIED'
    error = 'La clave no tiene acceso a Gemini para esta solicitud.'
    explanation = 'Revisa los permisos, restricciones y API habilitadas en el proyecto de la clave.'
  } else if (httpStatus === 404) {
    kind = 'MODEL_NOT_FOUND'
    error = 'El modelo de Gemini no está disponible.'
    explanation = 'Comprueba el nombre del modelo y el acceso de tu proyecto.'
  } else if (httpStatus === 503) {
    kind = 'GEMINI_UNAVAILABLE'
    error = 'Gemini está temporalmente saturado o no disponible.'
    explanation = 'Este estado no indica por sí mismo que hayas agotado la cuota.'
  } else if (httpStatus === 504) {
    kind = 'GEMINI_TIMEOUT'
    error = 'Gemini tardó demasiado en responder.'
    explanation = 'Un timeout no permite concluir que se agotó la cuota.'
  }

  return {
    error,
    explanation,
    diagnostic: {
      kind,
      httpStatus,
      providerCode: Number.isInteger(provider.code) ? provider.code : undefined,
      providerStatus,
      reason,
      quotaMetric,
      retryAfter,
      providerMessage: providerMessage || undefined,
      model,
    },
  }
}

export function diagnoseConnectionError(error, model) {
  const timeout = error?.name === 'TimeoutError' || error?.name === 'AbortError'
  const networkCode = safeIdentifier(error?.cause?.code || error?.code, 40)
  return {
    error: timeout ? 'Se agotó el tiempo de espera de Gemini.' : 'El servidor no pudo conectarse con Gemini.',
    explanation: timeout
      ? 'No llegó una respuesta antes de 30 segundos. Esto no confirma que se agotó la cuota.'
      : 'Puede ser un problema de red, DNS o certificado. Esto no confirma que se agotó la cuota.',
    diagnostic: { kind: timeout ? 'CONNECTION_TIMEOUT' : 'CONNECTION_ERROR', networkCode, model },
  }
}
