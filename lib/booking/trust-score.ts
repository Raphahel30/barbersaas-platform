import 'server-only'

import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

export type TrustClassification = 'reliable' | 'neutral' | 'high_risk'
export type TrustScoreEventType = 'completed' | 'late_cancellation' | 'no_show'

export type TrustScoreProfile = {
  id: string
  tenantId: string
  phone: string
  clientName: string | null
  score: number
  classification: TrustClassification
  completedCount: number
  lateCancellationCount: number
  noShowCount: number
  consecutiveNoShows: number
  isBlacklisted: boolean
  blacklistReason: string | null
  customReservationFeePercent: number | null
}

export type DynamicReservationFeePolicy = {
  canBook: boolean
  blockReason?: string
  score: number
  classification: TrustClassification
  isBlacklisted: boolean
  requiredFeeAmount: number
  requireFullPrepayment: boolean
  policyLabel: string
  badgeText: string
}

/**
 * Calcula a classificação textual e comportamental a partir da pontuação (0 a 100).
 */
export function classifyTrustScore(score: number): TrustClassification {
  if (score >= 80) return 'reliable'
  if (score >= 50) return 'neutral'
  return 'high_risk'
}

/**
 * Obtém ou inicializa o perfil de score de confiança de um cliente pelo telefone.
 */
export async function getOrCreateClientTrustScore(
  tenantId: string,
  phone: string,
  clientName?: string
): Promise<TrustScoreProfile> {
  const supabase = createAdminClient()
  const cleanPhone = phone.replace(/\D/g, '')

  const { data: existing, error } = await supabase
    .from('client_trust_scores')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('phone', cleanPhone)
    .maybeSingle()

  if (existing) {
    return {
      id: existing.id,
      tenantId: existing.tenant_id,
      phone: existing.phone,
      clientName: existing.client_name,
      score: existing.score,
      classification: existing.classification,
      completedCount: existing.completed_count,
      lateCancellationCount: existing.late_cancellation_count,
      noShowCount: existing.no_show_count,
      consecutiveNoShows: existing.consecutive_no_shows,
      isBlacklisted: existing.is_blacklisted,
      blacklistReason: existing.blacklist_reason,
      customReservationFeePercent: existing.custom_reservation_fee_percent,
    }
  }

  // Se não existir, inicializa com score neutro de 70 pontos
  const initialScore = 70
  const classification = classifyTrustScore(initialScore)

  const { data: created, error: insertError } = await supabase
    .from('client_trust_scores')
    .insert({
      tenant_id: tenantId,
      phone: cleanPhone,
      client_name: clientName || null,
      score: initialScore,
      classification,
      completed_count: 0,
      late_cancellation_count: 0,
      no_show_count: 0,
      consecutive_no_shows: 0,
      is_blacklisted: false,
    })
    .select()
    .single()

  if (insertError || !created) {
    throw new Error(`Falha ao inicializar Trust Score do cliente: ${insertError?.message}`)
  }

  return {
    id: created.id,
    tenantId: created.tenant_id,
    phone: created.phone,
    clientName: created.client_name,
    score: created.score,
    classification: created.classification,
    completedCount: created.completed_count,
    lateCancellationCount: created.late_cancellation_count,
    noShowCount: created.no_show_count,
    consecutiveNoShows: created.consecutive_no_shows,
    isBlacklisted: created.is_blacklisted,
    blacklistReason: created.blacklist_reason,
    customReservationFeePercent: created.custom_reservation_fee_percent,
  }
}

/**
 * Atualiza o score do cliente com base no desfecho de um agendamento:
 * - 'completed': +5 pontos (reseta no-shows consecutivos)
 * - 'late_cancellation': -20 pontos
 * - 'no_show': -40 pontos (+1 no-show consecutivo; 2 consecutivos = blacklist preventiva)
 */
export async function updateClientTrustScoreOnEvent(
  tenantId: string,
  phone: string,
  event: TrustScoreEventType,
  clientName?: string
): Promise<TrustScoreProfile> {
  const current = await getOrCreateClientTrustScore(tenantId, phone, clientName)
  const supabase = createAdminClient()

  let delta = 0
  let newConsecutiveNoShows = current.consecutiveNoShows
  let newCompleted = current.completedCount
  let newLateCancels = current.lateCancellationCount
  let newNoShows = current.noShowCount

  switch (event) {
    case 'completed':
      delta = 5
      newCompleted++
      newConsecutiveNoShows = 0 // Reseta a contagem de faltas consecutivas
      break
    case 'late_cancellation':
      delta = -20
      newLateCancels++
      break
    case 'no_show':
      delta = -40
      newNoShows++
      newConsecutiveNoShows++
      break
  }

  // Trava entre 0 e 100
  let newScore = Math.min(100, Math.max(0, current.score + delta))
  let classification = classifyTrustScore(newScore)

  // Blacklist automática: 2 no-shows consecutivos ou pontuação zerada (< 20)
  let isBlacklisted = current.isBlacklisted
  let blacklistReason = current.blacklistReason

  if (newConsecutiveNoShows >= 2 && !isBlacklisted) {
    isBlacklisted = true
    blacklistReason = 'Bloqueio preventivo automático: 2 faltas consecutivas (No-Show)'
  } else if (newScore <= 15 && !isBlacklisted) {
    isBlacklisted = true
    blacklistReason = 'Bloqueio preventivo por pontuação crítica (< 15 pontos)'
  }

  const { data: updated, error } = await supabase
    .from('client_trust_scores')
    .update({
      score: newScore,
      classification,
      completed_count: newCompleted,
      late_cancellation_count: newLateCancels,
      no_show_count: newNoShows,
      consecutive_no_shows: newConsecutiveNoShows,
      is_blacklisted: isBlacklisted,
      blacklist_reason: blacklistReason,
      blacklisted_at: isBlacklisted && !current.isBlacklisted ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', current.id)
    .select()
    .single()

  if (error || !updated) {
    throw new Error(`Erro ao atualizar score do cliente: ${error?.message}`)
  }

  return {
    id: updated.id,
    tenantId: updated.tenant_id,
    phone: updated.phone,
    clientName: updated.client_name,
    score: updated.score,
    classification: updated.classification,
    completedCount: updated.completed_count,
    lateCancellationCount: updated.late_cancellation_count,
    noShowCount: updated.no_show_count,
    consecutiveNoShows: updated.consecutive_no_shows,
    isBlacklisted: updated.is_blacklisted,
    blacklistReason: updated.blacklist_reason,
    customReservationFeePercent: updated.custom_reservation_fee_percent,
  }
}

/**
 * Avalia o valor da taxa de reserva dinâmica para o agendamento de acordo com o score do cliente:
 * - Confiável (>= 80): Sinal R$ 0,00 (100% no balcão)
 * - Neutro (50-79): Taxa padrão do serviço / tenant
 * - Alto Risco (< 50): 100% antecipado (Valor integral do corte)
 */
export async function calculateDynamicReservationPolicy(
  tenantId: string,
  phone: string,
  defaultReservationFee: number,
  totalServicePrice: number
): Promise<DynamicReservationFeePolicy> {
  const profile = await getOrCreateClientTrustScore(tenantId, phone)

  // 1. Cliente na Blacklist
  if (profile.isBlacklisted) {
    return {
      canBook: false,
      blockReason: profile.blacklistReason || 'Agendamento temporariamente bloqueado por faltas recorrentes. Fale com a gerência.',
      score: profile.score,
      classification: profile.classification,
      isBlacklisted: true,
      requiredFeeAmount: totalServicePrice,
      requireFullPrepayment: true,
      policyLabel: 'Bloqueado na Blacklist',
      badgeText: '🚫 Bloqueado',
    }
  }

  // 2. Se houver porcentagem customizada manual configurada pelo dono para o cliente
  if (profile.customReservationFeePercent !== null && profile.customReservationFeePercent !== undefined) {
    const customAmount = Math.round((totalServicePrice * profile.customReservationFeePercent) / 100)
    return {
      canBook: true,
      score: profile.score,
      classification: profile.classification,
      isBlacklisted: false,
      requiredFeeAmount: customAmount,
      requireFullPrepayment: profile.customReservationFeePercent >= 100,
      policyLabel: `Regra Individual (${profile.customReservationFeePercent}%)`,
      badgeText: '⚙️ Personalizado',
    }
  }

  // 3. Cliente Confiável / VIP (Score >= 80): Sinal R$ 0,00
  if (profile.score >= 80) {
    return {
      canBook: true,
      score: profile.score,
      classification: 'reliable',
      isBlacklisted: false,
      requiredFeeAmount: 0,
      requireFullPrepayment: false,
      policyLabel: 'Cliente Confiável: Isenção de Sinal (Paga 100% no Balcão)',
      badgeText: '⭐ Cliente Confiável (Sinal R$ 0)',
    }
  }

  // 4. Cliente Neutro (50 a 79): Taxa padrão configurada
  if (profile.score >= 50) {
    return {
      canBook: true,
      score: profile.score,
      classification: 'neutral',
      isBlacklisted: false,
      requiredFeeAmount: defaultReservationFee,
      requireFullPrepayment: false,
      policyLabel: 'Taxa de Reserva Padrão',
      badgeText: '🛡️ Sinal Padrão',
    }
  }

  // 5. Cliente de Alto Risco (< 50): 100% Antecipado
  return {
    canBook: true,
    score: profile.score,
    classification: 'high_risk',
    isBlacklisted: false,
    requiredFeeAmount: totalServicePrice,
    requireFullPrepayment: true,
    policyLabel: 'Alto Risco de Falta: Pagamento 100% Antecipado Obrigatório',
    badgeText: '⚠️ Pré-pagamento Integral',
  }
}
