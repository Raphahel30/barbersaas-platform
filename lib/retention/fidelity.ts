import 'server-only'

import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

export type RewardType = Database['public']['Enums']['reward_type']

export type AwardStampResult = {
  awarded: boolean
  reason: 'awarded' | 'already_awarded' | 'vip_not_eligible' | 'not_completed' | 'error'
  cardId?: string
  stampsCount?: number
  targetStamps?: number
  expiresAt?: string
  message?: string
}

export type RedeemRewardResult = {
  success: boolean
  rewardId?: string
  rewardType?: RewardType
  rewardValue?: number | null
  rewardReferenceId?: string | null
  expiresAt?: string
  remainingStamps?: number
  message?: string
}

export type ExpiredCleanupResult = {
  expiredCardsCount: number
  expiredCreditsCount: number
  expiredCreditsAmount: number
  expiredRewardsCount: number
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function assertUuid(id: string, name: string): void {
  if (!UUID_PATTERN.test(id)) {
    throw new Error(`Identificador inválido para ${name}: ${id}`)
  }
}

/**
 * Concede 1 selo de fidelidade para o cliente após um atendimento concluído.
 * Respeita a regra do tenant para assinantes VIP (allow_vip_members) e
 * renova a expiração dos selos acumulados para 30 dias a partir de agora.
 */
export async function awardFidelityStamp(
  tenantId: string,
  clientId: string,
  appointmentId: string,
): Promise<AwardStampResult> {
  assertUuid(tenantId, 'tenantId')
  assertUuid(clientId, 'clientId')
  assertUuid(appointmentId, 'appointmentId')

  const admin = createAdminClient()

  // Invoca a stored procedure atômica do PostgreSQL com SECURITY DEFINER
  const { data, error } = await admin.rpc('award_fidelity_stamp_internal', {
    requested_tenant_id: tenantId,
    requested_client_id: clientId,
    requested_appointment_id: appointmentId,
  })

  if (error) {
    // Fallback gracioso com tratamento de exceções específicas da função SQL
    if (error.message.includes('already awarded') || error.code === '23505') {
      return {
        awarded: false,
        reason: 'already_awarded',
        message: 'Este atendimento já teve seu selo de fidelidade concedido.',
      }
    }

    if (error.message.includes('does not match tenant and client') || error.message.includes('completed')) {
      return {
        awarded: false,
        reason: 'not_completed',
        message: 'O atendimento precisa estar com status concluído para gerar selo.',
      }
    }

    return {
      awarded: false,
      reason: 'error',
      message: error.message || 'Falha ao conceder selo de fidelidade.',
    }
  }

  const result = data as {
    awarded: boolean
    reason: string
    card_id?: string
    stamps_count?: number
    target_stamps?: number
    expires_at?: string
  }

  return {
    awarded: Boolean(result.awarded),
    reason: (result.reason as AwardStampResult['reason']) || (result.awarded ? 'awarded' : 'vip_not_eligible'),
    cardId: result.card_id,
    stampsCount: result.stamps_count,
    targetStamps: result.target_stamps,
    expiresAt: result.expires_at,
    message: result.awarded
      ? 'Selo concedido com sucesso! Validade renovada por 30 dias.'
      : result.reason === 'vip_not_eligible'
        ? 'Assinantes VIP não acumulam selos nesta barbearia.'
        : 'Selo não concedido.',
  }
}

/**
 * Resgata a recompensa de fidelidade atingida pelo cliente.
 * Verifica validade (expires_at > now), quantidade necessária de selos,
 * debita os selos utilizados, baixa estoque caso seja produto e gera o registro em retention_rewards.
 */
export async function redeemFidelityReward(
  clientId: string,
  tenantId: string,
): Promise<RedeemRewardResult> {
  assertUuid(clientId, 'clientId')
  assertUuid(tenantId, 'tenantId')

  const admin = createAdminClient()

  const { data, error } = await admin.rpc('redeem_fidelity_reward_internal', {
    requested_tenant_id: tenantId,
    requested_client_id: clientId,
  })

  if (error) {
    let userMessage = 'Não foi possível resgatar o benefício.'
    if (error.message.includes('insufficient fidelity stamps')) {
      userMessage = 'Quantidade de selos insuficiente para resgatar a recompensa.'
    } else if (error.message.includes('fidelity stamps expired')) {
      userMessage = 'Os selos de fidelidade expiraram.'
    } else if (error.message.includes('reward product unavailable')) {
      userMessage = 'O produto de recompensa está sem estoque no momento.'
    } else if (error.message.includes('reward service unavailable')) {
      userMessage = 'O serviço de recompensa está indisponível.'
    }

    return {
      success: false,
      message: userMessage,
    }
  }

  const payload = data as {
    reward_id: string
    reward_type: RewardType
    reward_value: number | null
    reward_reference_id: string | null
    expires_at: string
    remaining_stamps: number
  }

  return {
    success: true,
    rewardId: payload.reward_id,
    rewardType: payload.reward_type,
    rewardValue: payload.reward_value,
    rewardReferenceId: payload.reward_reference_id,
    expiresAt: payload.expires_at,
    remainingStamps: payload.remaining_stamps,
    message: 'Recompensa de fidelidade resgatada com sucesso! Válida por 30 dias.',
  }
}

/**
 * Rotina executada periodicamente para expirar selos e créditos
 * cuja data limite (30 dias corridos) tenha sido ultrapassada.
 */
export async function checkExpiredCreditsAndStamps(
  tenantId?: string,
): Promise<ExpiredCleanupResult> {
  if (tenantId) {
    assertUuid(tenantId, 'tenantId')
  }

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  // 1. Invalida créditos de cancelamento/antecipação expirados (expires_at <= now, used_at is null, invalidated_at is null)
  let creditsQuery = admin
    .from('client_credits')
    .select('id, amount')
    .lte('expires_at', nowIso)
    .is('used_at', null)
    .is('invalidated_at', null)

  if (tenantId) {
    creditsQuery = creditsQuery.eq('tenant_id', tenantId)
  }

  const creditsResult = await creditsQuery
  const creditsToInvalidate = creditsResult.data ?? []

  let expiredCreditsAmount = 0
  if (creditsToInvalidate.length > 0) {
    const ids = creditsToInvalidate.map((c) => c.id)
    expiredCreditsAmount = creditsToInvalidate.reduce(
      (sum, item) => sum + Math.round(Number(item.amount) * 100),
      0,
    ) / 100

    await admin
      .from('client_credits')
      .update({ invalidated_at: nowIso })
      .in('id', ids)
  }

  // 2. Zera selos em cartões de fidelidade vencidos (expires_at <= now e stamps_count > 0)
  let cardsQuery = admin
    .from('fidelity_cards')
    .select('id, stamps_count')
    .lte('expires_at', nowIso)
    .gt('stamps_count', 0)

  if (tenantId) {
    cardsQuery = cardsQuery.eq('tenant_id', tenantId)
  }

  const cardsResult = await cardsQuery
  const cardsToReset = cardsResult.data ?? []

  if (cardsToReset.length > 0) {
    const cardIds = cardsToReset.map((card) => card.id)
    await admin
      .from('fidelity_cards')
      .update({
        stamps_count: 0,
        updated_at: nowIso,
      })
      .in('id', cardIds)
  }

  // 3. Atualiza status de recompensas geradas que não foram usadas em 30 dias
  let rewardsQuery = admin
    .from('retention_rewards')
    .select('id')
    .eq('status', 'available')
    .lte('expires_at', nowIso)

  if (tenantId) {
    rewardsQuery = rewardsQuery.eq('tenant_id', tenantId)
  }

  const rewardsResult = await rewardsQuery
  const rewardsToExpire = rewardsResult.data ?? []

  if (rewardsToExpire.length > 0) {
    const rewardIds = rewardsToExpire.map((r) => r.id)
    await admin
      .from('retention_rewards')
      .update({ status: 'expired' })
      .in('id', rewardIds)
  }

  return {
    expiredCardsCount: cardsToReset.length,
    expiredCreditsCount: creditsToInvalidate.length,
    expiredCreditsAmount,
    expiredRewardsCount: rewardsToExpire.length,
  }
}

/**
 * Consulta o estado atual do cartão de fidelidade de um cliente.
 */
export async function getClientFidelityCard(
  clientId: string,
  tenantId: string,
) {
  assertUuid(clientId, 'clientId')
  assertUuid(tenantId, 'tenantId')

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const cardResult = await admin
    .from('fidelity_cards')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (cardResult.error) {
    throw new Error('Não foi possível carregar o cartão de fidelidade.')
  }

  const card = cardResult.data
  if (!card) {
    return {
      hasCard: false,
      stampsCount: 0,
      targetStamps: 10,
      isExpired: false,
      canRedeem: false,
      expiresAt: null,
      rewardType: 'full_discount' as RewardType,
      rewardValue: null,
    }
  }

  const isExpired = Date.parse(card.expires_at) <= Date.now()
  const activeStamps = isExpired ? 0 : card.stamps_count
  const canRedeem = !isExpired && activeStamps >= card.target_stamps

  return {
    hasCard: true,
    cardId: card.id,
    stampsCount: activeStamps,
    targetStamps: card.target_stamps,
    isExpired,
    canRedeem,
    expiresAt: card.expires_at,
    rewardType: card.reward_type,
    rewardValue: card.reward_value,
    rewardReferenceId: card.reward_reference_id,
  }
}
