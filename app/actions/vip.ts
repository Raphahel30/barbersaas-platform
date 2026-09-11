'use server'

import {
  calculateVipBookingPrice,
  handleVipLatePayment,
  isClientVipActive,
  reactivateVipSubscription,
  subscribeClientToVipPlan,
  type CreateVipPlanInput,
  type SubscribeVipResult,
  type VipBookingPriceResult,
  type VipEligibilityResult,
} from '@/lib/retention/vip'
import { requireCurrentTenant } from '@/lib/tenant'
import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type PaymentMethod = Database['public']['Enums']['payment_method']

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
 * Cria um novo plano VIP na barbearia. Exclusivo para proprietários (owner).
 * Configura nome, valor mensal, frequência de uso, serviços inclusos e vínculo opcional a barbeiro.
 */
export async function createVipPlan(
  tenantId: string,
  planData: CreateVipPlanInput,
): Promise<ActionResult<{ id: string; name: string }>> {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'Barbearia inválida.' }
  }

  const actor = await getActor()
  if (!actor) {
    return { success: false, message: 'Autenticação necessária.' }
  }

  if (actor.role !== 'owner' && actor.role !== 'super_admin') {
    return { success: false, message: 'Apenas proprietários podem criar planos VIP.' }
  }

  if (actor.role === 'owner' && actor.tenant_id !== tenantId) {
    return { success: false, message: 'Operação não autorizada nesta barbearia.' }
  }

  const name = planData.name?.trim()
  if (!name || name.length < 2) {
    return { success: false, message: 'Nome do plano VIP deve conter ao menos 2 caracteres.' }
  }

  if (typeof planData.monthlyPrice !== 'number' || planData.monthlyPrice < 0) {
    return { success: false, message: 'Valor mensal inválido.' }
  }

  const validFrequencies: CreateVipPlanInput['frequency'][] = ['weekly', 'biweekly', 'unlimited']
  if (!validFrequencies.includes(planData.frequency)) {
    return { success: false, message: 'Frequência de plano inválida.' }
  }

  // Define os dias de intervalo respeitando estritamente a check constraint do PostgreSQL
  let usageIntervalDays: number | null = null
  if (planData.frequency === 'weekly') usageIntervalDays = 7
  else if (planData.frequency === 'biweekly') usageIntervalDays = 15

  if (!Array.isArray(planData.includedServices) || planData.includedServices.length === 0) {
    return { success: false, message: 'Selecione ao menos um serviço incluso no plano VIP.' }
  }

  for (const serviceId of planData.includedServices) {
    if (!UUID_PATTERN.test(serviceId)) {
      return { success: false, message: `Identificador de serviço inválido: ${serviceId}` }
    }
  }

  const admin = createAdminClient()

  // Valida barbeiro específico se fornecido
  if (planData.barberId) {
    if (!UUID_PATTERN.test(planData.barberId)) {
      return { success: false, message: 'Barbeiro vinculado inválido.' }
    }
    const barberCheck = await admin
      .from('profiles')
      .select('id')
      .eq('id', planData.barberId)
      .eq('tenant_id', tenantId)
      .eq('role', 'barber')
      .eq('is_active', true)
      .single()

    if (barberCheck.error || !barberCheck.data) {
      return { success: false, message: 'Barbeiro selecionado não encontrado ou inativo.' }
    }
  }

  const insertResult = await admin
    .from('vip_plans')
    .insert({
      tenant_id: tenantId,
      name,
      description: planData.description?.trim() || null,
      monthly_price: planData.monthlyPrice,
      frequency: planData.frequency,
      usage_interval_days: usageIntervalDays,
      included_services: planData.includedServices,
      barber_id: planData.barberId || null,
      allow_fidelity_stamps: Boolean(planData.allowFidelityStamps),
      is_active: true,
    })
    .select('id, name')
    .single()

  if (insertResult.error || !insertResult.data) {
    return {
      success: false,
      message: insertResult.error?.message || 'Falha ao cadastrar plano VIP.',
    }
  }

  return {
    success: true,
    data: insertResult.data,
  }
}

/**
 * Assina um cliente em um plano VIP.
 * Configura status ativo, calcula vencimento e dispara cobrança conforme o modo de pagamento do tenant.
 */
export async function subscribeClientToVip(
  clientId: string,
  vipPlanId: string,
  paymentMethod: PaymentMethod = 'online_gateway',
): Promise<ActionResult<SubscribeVipResult>> {
  if (!UUID_PATTERN.test(clientId) || !UUID_PATTERN.test(vipPlanId)) {
    return { success: false, message: 'Identificadores inválidos.' }
  }

  const actor = await getActor()
  if (!actor) {
    return { success: false, message: 'Autenticação necessária.' }
  }

  if (
    actor.id !== clientId &&
    !['owner', 'barber', 'receptionist', 'super_admin'].includes(actor.role)
  ) {
    return { success: false, message: 'Permissão negada para assinar este plano em nome de outro cliente.' }
  }

  const admin = createAdminClient()
  const planResult = await admin.from('vip_plans').select('tenant_id').eq('id', vipPlanId).single()
  if (planResult.error || !planResult.data) {
    return { success: false, message: 'Plano VIP não encontrado.' }
  }

  const tenantId = planResult.data.tenant_id

  try {
    const result = await subscribeClientToVipPlan(tenantId, clientId, vipPlanId, paymentMethod)
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Falha ao processar adesão VIP.',
    }
  }
}

/**
 * Trava por Atraso: Marca a assinatura como 'overdue' e bloqueia agendamentos VIP instantaneamente.
 */
export async function handleVipLatePaymentAction(
  subscriptionId: string,
): Promise<ActionResult<{ subscriptionId: string; status: string }>> {
  if (!UUID_PATTERN.test(subscriptionId)) {
    return { success: false, message: 'Assinatura inválida.' }
  }

  const actor = await getActor()
  if (!actor || (!['owner', 'super_admin'].includes(actor.role))) {
    return { success: false, message: 'Apenas administradores podem registrar inadimplência manual.' }
  }

  try {
    const result = await handleVipLatePayment(subscriptionId)
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Falha ao registrar inadimplência.',
    }
  }
}

/**
 * Reativação de assinatura VIP após compensação financeira.
 */
export async function reactivateVipSubscriptionAction(
  subscriptionId: string,
): Promise<ActionResult<{ subscriptionId: string; status: string; newPeriodEnd: string }>> {
  if (!UUID_PATTERN.test(subscriptionId)) {
    return { success: false, message: 'Assinatura inválida.' }
  }

  const actor = await getActor()
  if (!actor || (!['owner', 'super_admin'].includes(actor.role))) {
    return { success: false, message: 'Apenas administradores podem reativar assinaturas manualmente.' }
  }

  try {
    const result = await reactivateVipSubscription(subscriptionId)
    return { success: true, data: result }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Falha ao reativar assinatura.',
    }
  }
}

/**
 * Calcula o custo do agendamento para clientes VIP (zerando corte incluso e cobrando apenas extras).
 */
export async function calculateVipBookingPriceAction(
  vipPlanId: string,
  selectedServiceIds: string[],
): Promise<ActionResult<VipBookingPriceResult>> {
  if (!UUID_PATTERN.test(vipPlanId)) {
    return { success: false, message: 'Plano VIP inválido.' }
  }

  try {
    const calculation = await calculateVipBookingPrice(vipPlanId, selectedServiceIds)
    return { success: true, data: calculation }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao calcular valores com desconto VIP.',
    }
  }
}

/**
 * Consulta elegibilidade VIP do cliente e estado de bloqueio por inadimplência.
 */
export async function getClientVipStatusAction(
  tenantId?: string,
  clientId?: string,
): Promise<ActionResult<VipEligibilityResult>> {
  const actor = await getActor()
  if (!actor) {
    return { success: false, message: 'Autenticação necessária.' }
  }

  let resolvedTenantId = tenantId
  if (!resolvedTenantId) {
    const current = await requireCurrentTenant().catch(() => null)
    resolvedTenantId = current?.id || actor.tenant_id || undefined
  }

  if (!resolvedTenantId || !UUID_PATTERN.test(resolvedTenantId)) {
    return { success: false, message: 'Barbearia não informada.' }
  }

  const targetClientId = clientId || actor.id
  if (!UUID_PATTERN.test(targetClientId)) {
    return { success: false, message: 'Cliente inválido.' }
  }

  try {
    const status = await isClientVipActive(targetClientId, resolvedTenantId)
    return { success: true, data: status }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Falha ao consultar status VIP.',
    }
  }
}
