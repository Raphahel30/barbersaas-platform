import 'server-only'

import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type YieldRuleRow = Database['public']['Tables']['tenant_yield_rules']['Row']

export type DynamicPricingResult = {
  isPromotional: boolean
  promotionalBadge: string | null
  discountType: 'percent' | 'fixed' | null
  discountValue: number
  discountAmount: number
  originalPrice: number
  finalPrice: number
  originalReservationFee: number
  finalReservationFee: number
  requireFullReservationFee: boolean
  appliedRuleId: string | null
  appliedRuleName: string | null
}

const toCents = (val: number) => Math.round(val * 100)
const fromCents = (val: number) => val / 100

function parseTimeMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/**
 * Avalia se determinado horário de agendamento se enquadra em regras de Yield Management
 * (desconto em horários ociosos ou tarifa de reserva integral em horários de pico).
 */
export async function evaluateDynamicPricing(
  tenantId: string,
  startsAtIso: string,
  baseTotalPrice: number,
  baseReservationFee: number,
): Promise<DynamicPricingResult> {
  const basePriceCents = toCents(baseTotalPrice)
  const baseFeeCents = toCents(baseReservationFee)

  const defaultResult: DynamicPricingResult = {
    isPromotional: false,
    promotionalBadge: null,
    discountType: null,
    discountValue: 0,
    discountAmount: 0,
    originalPrice: baseTotalPrice,
    finalPrice: baseTotalPrice,
    originalReservationFee: baseReservationFee,
    finalReservationFee: baseReservationFee,
    requireFullReservationFee: false,
    appliedRuleId: null,
    appliedRuleName: null,
  }

  if (!UUID_REGEX.test(tenantId) || basePriceCents <= 0) {
    return defaultResult
  }

  const slotDate = new Date(startsAtIso)
  if (isNaN(slotDate.getTime())) return defaultResult

  const admin = createAdminClient()

  // Buscar fuso horário do tenant
  const settingsRes = await admin
    .from('tenant_settings')
    .select('timezone')
    .eq('tenant_id', tenantId)
    .single()

  const timezone = settingsRes.data?.timezone || 'America/Sao_Paulo'

  // Extrair dia da semana (0=Dom, 6=Sáb) e hora local
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  })
  const parts = formatter.formatToParts(slotDate)
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  const slotMinutes = hour * 60 + minute

  // Dia da semana local
  const weekdayFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'narrow', // 'S', 'M', 'T', 'W', 'T', 'F', 'S'
  })
  // Usar Date nativo ajustado para UTC offset
  const localDateStr = slotDate.toLocaleDateString('en-CA', { timeZone: timezone })
  const localDayOfWeek = new Date(localDateStr + 'T12:00:00Z').getUTCDay()

  // Buscar regras ativas de yield
  const rulesRes = await admin
    .from('tenant_yield_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (rulesRes.error || !rulesRes.data || rulesRes.data.length === 0) {
    return defaultResult
  }

  // Encontrar regra aplicável para este dia e horário
  const matchedRule = rulesRes.data.find((rule) => {
    if (!rule.weekdays.includes(localDayOfWeek)) return false
    const startM = parseTimeMinutes(rule.starts_at)
    const endM = parseTimeMinutes(rule.ends_at)
    return slotMinutes >= startM && slotMinutes < endM
  })

  if (!matchedRule) {
    return defaultResult
  }

  let discountCents = 0
  if (matchedRule.discount_value > 0) {
    if (matchedRule.discount_type === 'percent') {
      const pct = Math.min(100, Math.max(0, matchedRule.discount_value))
      discountCents = Math.round((basePriceCents * pct) / 100)
    } else {
      discountCents = Math.min(basePriceCents, toCents(matchedRule.discount_value))
    }
  }

  const finalPriceCents = Math.max(0, basePriceCents - discountCents)

  // Tratamento da taxa de reserva
  let finalFeeCents = Math.min(baseFeeCents, finalPriceCents)
  let requireFullFee = false

  if (matchedRule.require_full_reservation_fee) {
    // Horário de pico: exige 100% de sinal/reserva
    finalFeeCents = finalPriceCents
    requireFullFee = true
  }

  const isPromotional = discountCents > 0
  const badge = isPromotional
    ? matchedRule.discount_type === 'percent'
      ? `⚡ Horário Promocional (-${matchedRule.discount_value}%)`
      : `⚡ Horário Promocional (-R$ ${matchedRule.discount_value.toFixed(2)})`
    : null

  return {
    isPromotional,
    promotionalBadge: badge,
    discountType: matchedRule.discount_type,
    discountValue: matchedRule.discount_value,
    discountAmount: fromCents(discountCents),
    originalPrice: baseTotalPrice,
    finalPrice: fromCents(finalPriceCents),
    originalReservationFee: baseReservationFee,
    finalReservationFee: fromCents(finalFeeCents),
    requireFullReservationFee: requireFullFee,
    appliedRuleId: matchedRule.id,
    appliedRuleName: matchedRule.name,
  }
}

/**
 * Versão síncrona/pré-carregada para otimizar getAvailableSlots.
 */
export function matchYieldRuleForSlot(
  ruleList: YieldRuleRow[],
  weekday: number,
  slotMinutesAfterMidnight: number,
  baseTotal: number,
  baseReservationFee: number,
): {
  isPromotional: boolean
  promotionalBadge: string | null
  discountAmount: number
  finalPrice: number
  finalReservationFee: number
  requireFullFee: boolean
} {
  const matched = ruleList.find((r) => {
    if (!r.is_active || !r.weekdays.includes(weekday)) return false
    const s = parseTimeMinutes(r.starts_at)
    const e = parseTimeMinutes(r.ends_at)
    return slotMinutesAfterMidnight >= s && slotMinutesAfterMidnight < e
  })

  if (!matched) {
    return {
      isPromotional: false,
      promotionalBadge: null,
      discountAmount: 0,
      finalPrice: baseTotal,
      finalReservationFee: baseReservationFee,
      requireFullFee: false,
    }
  }

  const baseCents = toCents(baseTotal)
  let discountCents = 0

  if (matched.discount_value > 0) {
    if (matched.discount_type === 'percent') {
      discountCents = Math.round((baseCents * matched.discount_value) / 100)
    } else {
      discountCents = Math.min(baseCents, toCents(matched.discount_value))
    }
  }

  const finalCents = Math.max(0, baseCents - discountCents)
  const finalFeeCents = matched.require_full_reservation_fee
    ? finalCents
    : Math.min(toCents(baseReservationFee), finalCents)

  const badge = discountCents > 0
    ? matched.discount_type === 'percent'
      ? `⚡ Promocional (-${matched.discount_value}%)`
      : `⚡ Promocional (-R$ ${matched.discount_value.toFixed(0)})`
    : null

  return {
    isPromotional: discountCents > 0,
    promotionalBadge: badge,
    discountAmount: fromCents(discountCents),
    finalPrice: fromCents(finalCents),
    finalReservationFee: fromCents(finalFeeCents),
    requireFullFee: matched.require_full_reservation_fee,
  }
}
