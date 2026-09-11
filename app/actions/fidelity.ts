'use server'

import {
  awardFidelityStamp,
  checkExpiredCreditsAndStamps,
  getClientFidelityCard,
  redeemFidelityReward,
  type AwardStampResult,
  type ExpiredCleanupResult,
  type RedeemRewardResult,
} from '@/lib/retention/fidelity'
import { requireCurrentTenant } from '@/lib/tenant'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string }

async function getActor() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (!userId) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, tenant_id, is_active')
    .eq('id', userId)
    .maybeSingle()

  if (!profile || !profile.is_active) return null
  return profile
}

/**
 * Server Action para conceder selo manualmente ou via finalização de atendimento.
 */
export async function awardFidelityStampAction(
  appointmentId: string,
): Promise<ActionResult<AwardStampResult>> {
  if (!UUID_PATTERN.test(appointmentId)) {
    return { success: false, message: 'Agendamento inválido.' }
  }

  const actor = await getActor()
  if (!actor) {
    return { success: false, message: 'Autenticação necessária.' }
  }

  const admin = createAdminClient()
  const appointmentResult = await admin
    .from('appointments')
    .select('id, tenant_id, client_id, barber_id, status')
    .eq('id', appointmentId)
    .single()

  if (appointmentResult.error || !appointmentResult.data) {
    return { success: false, message: 'Atendimento não encontrado.' }
  }

  const appt = appointmentResult.data

  if (actor.tenant_id !== appt.tenant_id && actor.role !== 'super_admin') {
    return { success: false, message: 'Operação não autorizada nesta barbearia.' }
  }

  if (
    actor.role === 'barber' &&
    actor.id !== appt.barber_id
  ) {
    return { success: false, message: 'Você só pode conceder selos dos seus próprios atendimentos.' }
  }

  if (!appt.client_id) {
    return { success: false, message: 'Atendimentos de visitantes sem cadastro não acumulam selos.' }
  }

  if (appt.status !== 'completed') {
    return { success: false, message: 'O atendimento deve estar finalizado como concluído para pontuar.' }
  }

  try {
    const result = await awardFidelityStamp(appt.tenant_id, appt.client_id, appt.id)
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Falha ao conceder selo de fidelidade.',
    }
  }
}

/**
 * Server Action para resgatar benefício do programa de fidelidade.
 */
export async function redeemFidelityRewardAction(
  tenantId: string,
  clientId?: string,
): Promise<ActionResult<RedeemRewardResult>> {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'Barbearia inválida.' }
  }

  const actor = await getActor()
  if (!actor) {
    return { success: false, message: 'Autenticação necessária.' }
  }

  let targetClientId = actor.id

  if (clientId && clientId !== actor.id) {
    if (!UUID_PATTERN.test(clientId)) {
      return { success: false, message: 'Cliente inválido.' }
    }

    // Apenas profissionais do tenant podem resgatar em nome de outro cliente
    if (!['owner', 'barber', 'receptionist', 'super_admin'].includes(actor.role) || (actor.tenant_id !== tenantId && actor.role !== 'super_admin')) {
      return { success: false, message: 'Você não tem permissão para resgatar benefício por este cliente.' }
    }
    targetClientId = clientId
  }

  try {
    const result = await redeemFidelityReward(targetClientId, tenantId)
    if (!result.success) {
      return { success: false, message: result.message || 'Falha no resgate.' }
    }
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao processar resgate.',
    }
  }
}

/**
 * Server Action para acionar a verificação de expiração de selos e créditos (30 dias).
 */
export async function checkExpiredCreditsAndStampsAction(
  tenantId?: string,
): Promise<ActionResult<ExpiredCleanupResult>> {
  const actor = await getActor()
  if (!actor) {
    return { success: false, message: 'Autenticação necessária.' }
  }

  const targetTenantId = tenantId || actor.tenant_id

  if (targetTenantId) {
    if (!UUID_PATTERN.test(targetTenantId)) {
      return { success: false, message: 'Identificador do tenant inválido.' }
    }

    if (actor.role !== 'owner' && actor.role !== 'super_admin') {
      return { success: false, message: 'Apenas proprietários podem executar esta rotina.' }
    }

    if (actor.role === 'owner' && actor.tenant_id !== targetTenantId) {
      return { success: false, message: 'Operação não autorizada.' }
    }
  } else if (actor.role !== 'super_admin') {
    return { success: false, message: 'Operação global restrita a administradores.' }
  }

  try {
    const result = await checkExpiredCreditsAndStamps(targetTenantId || undefined)
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao processar expiração de selos.',
    }
  }
}

/**
 * Server Action para consultar o cartão de fidelidade do cliente.
 */
export async function getClientFidelityStatusAction(
  tenantId?: string,
  clientId?: string,
) {
  const actor = await getActor()
  if (!actor) {
    return { success: false as const, message: 'Autenticação necessária.' }
  }

  let resolvedTenantId = tenantId
  if (!resolvedTenantId) {
    const current = await requireCurrentTenant().catch(() => null)
    resolvedTenantId = current?.id || actor.tenant_id || undefined
  }

  if (!resolvedTenantId || !UUID_PATTERN.test(resolvedTenantId)) {
    return { success: false as const, message: 'Barbearia não informada.' }
  }

  const targetClientId = clientId || actor.id
  if (!UUID_PATTERN.test(targetClientId)) {
    return { success: false as const, message: 'Cliente inválido.' }
  }

  if (targetClientId !== actor.id && !['owner', 'barber', 'receptionist', 'super_admin'].includes(actor.role)) {
    return { success: false as const, message: 'Permissão negada.' }
  }

  try {
    const card = await getClientFidelityCard(targetClientId, resolvedTenantId)
    return { success: true as const, data: card }
  } catch (error) {
    return {
      success: false as const,
      message: error instanceof Error ? error.message : 'Erro ao carregar dados do cartão.',
    }
  }
}
