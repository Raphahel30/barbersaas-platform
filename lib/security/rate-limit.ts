export interface RateLimitResult {
  success: boolean
  count: number
  remaining: number
  resetTimeMs: number
}

interface RateLimitRecord {
  timestamps: number[]
}

const rateLimitStore = new Map<string, RateLimitRecord>()

// Limpeza periódica a cada 5 minutos para evitar vazamento de memória
if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitStore.entries()) {
      record.timestamps = record.timestamps.filter((t) => now - t < 30 * 60 * 1000)
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key)
      }
    }
  }, 5 * 60 * 1000)

  if (typeof cleanupTimer?.unref === 'function') {
    cleanupTimer.unref()
  }
}

/**
 * Limitador de taxa em memória por janela deslizante (Sliding Window).
 *
 * @param key Identificador único (IP, Telefone, ou combinação)
 * @param maxRequests Limite máximo de requisições permitidas na janela
 * @param windowMs Duração da janela em milissegundos
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now()
  const record = rateLimitStore.get(key) || { timestamps: [] }

  // Filtra apenas requisições dentro da janela de tempo atual
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs)

  if (record.timestamps.length >= maxRequests) {
    const oldest = record.timestamps[0]
    const resetTimeMs = oldest + windowMs - now

    return {
      success: false,
      count: record.timestamps.length,
      remaining: 0,
      resetTimeMs: Math.max(0, resetTimeMs),
    }
  }

  // Registra a nova requisição
  record.timestamps.push(now)
  rateLimitStore.set(key, record)

  return {
    success: true,
    count: record.timestamps.length,
    remaining: maxRequests - record.timestamps.length,
    resetTimeMs: windowMs,
  }
}

/**
 * Limita a criação de Holds provisórios: Máximo de 3 holds por IP ou telefone a cada 15 minutos.
 */
export function checkHoldRateLimit(identifier: string): RateLimitResult {
  const windowMs = 15 * 60 * 1000 // 15 minutos
  const maxHolds = 3
  return checkRateLimit(`hold:${identifier}`, maxHolds, windowMs)
}

/**
 * Limita tentativas de autenticação: Máximo de 5 tentativas por IP a cada 15 minutos.
 */
export function checkAuthRateLimit(ip: string): RateLimitResult {
  const windowMs = 15 * 60 * 1000 // 15 minutos
  const maxAttempts = 5
  return checkRateLimit(`auth:${ip}`, maxAttempts, windowMs)
}
