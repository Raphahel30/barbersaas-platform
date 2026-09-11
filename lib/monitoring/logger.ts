export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'metric'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: string
  tenantId?: string | null
  userId?: string | null
  details?: Record<string, any>
  durationMs?: number
  error?: {
    name?: string
    message: string
    stack?: string
  }
}

/**
 * Sanitiza e anonimiza dados sensíveis (senhas, cartões, tokens e CPFs) antes de registrar nos logs.
 */
export function sanitizeLogData(data: any): any {
  if (data === null || data === undefined) return data
  if (typeof data !== 'object') {
    if (typeof data === 'string') {
      // Mascarar cartões de crédito (16 dígitos)
      if (/^\d{16}$/.test(data.replace(/\s|-/g, ''))) {
        return `**** **** **** ${data.slice(-4)}`
      }
      // Mascarar tokens longos
      if (data.length > 30 && (data.startsWith('ey') || data.startsWith('$') || data.includes('secret'))) {
        return `${data.slice(0, 4)}...${data.slice(-4)}`
      }
    }
    return data
  }

  if (Array.isArray(data)) {
    return data.map(sanitizeLogData)
  }

  const sanitized: Record<string, any> = {}
  const SENSITIVE_KEYS = [
    'password',
    'senha',
    'token',
    'access_token',
    'secret',
    'api_key',
    'apiKey',
    'card_number',
    'cardNumber',
    'cvv',
    'security_code',
    'authorization',
    'asaas-access-token',
  ]

  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase()
    if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
      sanitized[key] = '[REDACTED]'
    } else if (lowerKey === 'document' || lowerKey === 'cpf') {
      const strVal = String(val)
      sanitized[key] = strVal.length >= 11
        ? `***.${strVal.slice(3, 6)}.${strVal.slice(6, 9)}-**`
        : '***.***.***-**'
    } else {
      sanitized[key] = sanitizeLogData(val)
    }
  }

  return sanitized
}

class Logger {
  private isProduction = process.env.NODE_ENV === 'production'

  private emit(entry: LogEntry) {
    const sanitizedDetails = entry.details ? sanitizeLogData(entry.details) : undefined
    const payload: LogEntry = {
      ...entry,
      details: sanitizedDetails,
    }

    // Se houver Sentry ou Logflare configurado
    if (this.isProduction && process.env.LOGFLARE_API_KEY && process.env.LOGFLARE_SOURCE_TOKEN) {
      this.sendToRemoteDrain(payload).catch(() => {})
    }

    const formattedJson = JSON.stringify(payload)

    switch (entry.level) {
      case 'error':
        console.error(formattedJson)
        break
      case 'warn':
        console.warn(formattedJson)
        break
      case 'metric':
        console.info(`[METRIC] ${formattedJson}`)
        break
      default:
        console.log(formattedJson)
        break
    }
  }

  private async sendToRemoteDrain(payload: LogEntry) {
    try {
      await fetch(`https://api.logflare.app/logs/json?source=${process.env.LOGFLARE_SOURCE_TOKEN}`, {
        method: 'POST',
        headers: {
          'X-API-KEY': process.env.LOGFLARE_API_KEY || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
    } catch {
      // Silencioso para não travar o loop de evento
    }
  }

  info(message: string, meta?: { context?: string; tenantId?: string; userId?: string; details?: Record<string, any> }) {
    this.emit({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      ...meta,
    })
  }

  warn(message: string, meta?: { context?: string; tenantId?: string; userId?: string; details?: Record<string, any> }) {
    this.emit({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      ...meta,
    })
  }

  error(message: string, error?: unknown, meta?: { context?: string; tenantId?: string; userId?: string; details?: Record<string, any> }) {
    const errorDetails = error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : { message: String(error) }

    this.emit({
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      error: errorDetails,
      ...meta,
    })
  }

  metric(name: string, value: number, unit = 'ms', meta?: { context?: string; tenantId?: string; details?: Record<string, any> }) {
    this.emit({
      timestamp: new Date().toISOString(),
      level: 'metric',
      message: `${name}: ${value}${unit}`,
      durationMs: value,
      details: { metricName: name, metricValue: value, unit, ...(meta?.details || {}) },
      context: meta?.context,
      tenantId: meta?.tenantId,
    })
  }
}

export const logger = new Logger()

/**
 * Registra especificamente eventos de webhook recebidos com anonimização.
 */
export function logWebhookEvent(
  provider: string,
  event: string,
  status: 'received' | 'processed' | 'failed' | 'ignored',
  details?: Record<string, any>,
) {
  logger.info(`Webhook ${provider.toUpperCase()}: [${event}] -> ${status}`, {
    context: 'webhook-handler',
    details: {
      provider,
      event,
      status,
      ...details,
    },
  })
}

/**
 * Wrapper de monitoramento de performance. Emite alerta caso a execução ultrapasse thresholdMs (padrão: 1500ms).
 */
export async function measurePerformance<T>(
  actionName: string,
  fn: () => Promise<T>,
  thresholdMs = 1500,
  contextMeta?: { tenantId?: string; userId?: string },
): Promise<T> {
  const start = Date.now()
  try {
    const result = await fn()
    const duration = Date.now() - start

    if (duration > thresholdMs) {
      logger.warn(`Operação lenta detectada: ${actionName} durou ${duration}ms (limiar: ${thresholdMs}ms)`, {
        context: 'performance-profiler',
        details: { actionName, durationMs: duration, thresholdMs },
        ...contextMeta,
      })
    } else {
      logger.metric(actionName, duration, 'ms', {
        context: 'performance-profiler',
        ...contextMeta,
      })
    }

    return result
  } catch (error) {
    const duration = Date.now() - start
    logger.error(`Falha durante execução de ${actionName} após ${duration}ms`, error, {
      context: 'performance-profiler',
      details: { actionName, durationMs: duration },
      ...contextMeta,
    })
    throw error
  }
}
