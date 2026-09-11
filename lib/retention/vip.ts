import 'server-only'

import { createPixCharge, getGatewayConnection } from '@/lib/payments/gateways'
import type { Database, Json } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

export type VipFrequency = Database['public']['Enums']['vip_frequency']
export type SubscriptionStatus = Database['public']['Enums']['subscription_status']
export type PaymentMethod = Database['public']['Enums']['payment_method']
export type VipPaymentMode = Database['public']['Enums']['vip_payment_mode']

export type CreateVipPlanInput = {
  name: string
  description?: string | null
  monthlyPrice: number
  frequency: VipFrequency
  includedServices: string[]
  barberId?: string | null
  allowFidelityStamps?: boolean
}

export type VipBookingPriceResult = {
  originalTotal: number
  coveredServices: Array<{ id: string; name: string; originalPrice: number }>
  uncoveredServices: Array<{ id: string; name: string; price: number; reservationFee: number }>
  vipDiscountAmount: number
  payableAmount: number
  reservationFee: number
  isFullyCovered: boolean
}

export type VipEligibilityResult = {
  isActive: boolean
  isOverdue: boolean
  status: SubscriptionStatus | 'none'
  planId?: string
  planName?: string
  allowedToBook: boolean
  message: string
  currentPeriodEnd?: string
  nextPaymentDue?: string | null
}

export type SubscribeVipResult = {
  subscriptionId: string
  planId: string
  status: SubscriptionStatus
  paymentMode: VipPaymentMode
  currentPeriodEnd: string
  nextPaymentDue: string | null
  pixCharge?: {
    qrCode: string | null
    qrCodeImage: string | null
    checkoutUrl: string | null
    expiresAt: string
  }
  checkoutUrl?: string | null
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function assertUuid(id: string, name: string): void {
  if (!UUID_PATTERN.test(id)) {
    throw new Error(`Identificador inválido para ${name}: ${id}`)
  }
}

function toCents(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Valor monetário inválido')
  return Math.round(value * 100)
}

function fromCents(value: number): number {
  return value / 100
}

function parseIncludedServiceIds(value: Json): Set<string> {
  if (!Array.isArray(value)) return new Set()
  const ids = value.flatMap((item) => {
    if (typeof item === 'string') return UUID_PATTERN.test(item) ? [item] : []
    if (item && typeof item === 'object' && !Array.isArray(item) && typeof item.service_id === 'string') {
      return UUID_PATTERN.test(item.service_id) ? [item.service_id] : []
    }
    return []
  })
  return new Set(ids)
}

/**
 * Calcula o custo do agendamento para um cliente com plano VIP:
 * Zera o preço dos serviços inclusos no plano.
 * Serviços extras fora do plano são cobrados à parte sem cobrança de taxa de reserva sobre o corte incluso.
 */
export async function calculateVipBookingPrice(
  vipPlanId: string,
  selectedServiceIds: string[],
): Promise<VipBookingPriceResult> {
  assertUuid(vipPlanId, 'vipPlanId')
  if (!Array.isArray(selectedServiceIds) || selectedServiceIds.length === 0) {
    throw new Error('Nenhum serviço selecionado para cálculo.')
  }

  for (const id of selectedServiceIds) {
    assertUuid(id, 'serviceId')
  }

  const admin = createAdminClient()

  const [planResult, servicesResult] = await Promise.all([
    admin
      .from('vip_plans')
      .select('id, name, included_services, is_active')
      .eq('id', vipPlanId)
      .single(),
    admin
      .from('services')
      .select('id, name, price, reservation_fee, is_active')
      .in('id', selectedServiceIds),
  ])

  if (planResult.error || !planResult.data || !planResult.data.is_active) {
    throw new Error('Plano VIP não encontrado ou inativo.')
  }

  if (servicesResult.error || !servicesResult.data) {
    throw new Error('Não foi possível carregar os serviços selecionados.')
  }

  const coveredIds = parseIncludedServiceIds(planResult.data.included_services)
  const coveredServices: Array<{ id: string; name: string; originalPrice: number }> = []
  const uncoveredServices: Array<{ id: string; name: string; price: number; reservationFee: number }> = []

  let originalTotalCents = 0
  let vipDiscountCents = 0
  let uncoveredPriceCents = 0
  let uncoveredReservationFeeCents = 0

  for (const service of servicesResult.data) {
    const priceCents = toCents(Number(service.price))
    originalTotalCents += priceCents

    if (coveredIds.has(service.id)) {
      coveredServices.push({
        id: service.id,
        name: service.name,
        originalPrice: Number(service.price),
      })
      vipDiscountCents += priceCents
    } else {
      const feeCents = toCents(Number(service.reservation_fee))
      uncoveredServices.push({
        id: service.id,
        name: service.name,
        price: Number(service.price),
        reservationFee: Number(service.reservation_fee),
      })
      uncoveredPriceCents += priceCents
      uncoveredReservationFeeCents += feeCents
    }
  }

  const payableCents = Math.max(0, uncoveredPriceCents)

  return {
    originalTotal: fromCents(originalTotalCents),
    coveredServices,
    uncoveredServices,
    vipDiscountAmount: fromCents(vipDiscountCents),
    payableAmount: fromCents(payableCents),
    reservationFee: fromCents(uncoveredReservationFeeCents),
    isFullyCovered: uncoveredServices.length === 0,
  }
}

/**
 * Trava Imediata por Atraso:
 * Verifica o status de assinatura VIP do cliente.
 * Se a assinatura estiver 'overdue', 'past_due', 'suspended' ou 'cancelled',
 * bloqueia instantaneamente o agendamento de cortes VIP.
 */
export async function isClientVipActive(
  clientId: string,
  tenantId: string,
): Promise<VipEligibilityResult> {
  assertUuid(clientId, 'clientId')
  assertUuid(tenantId, 'tenantId')

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const subscriptionResult = await admin
    .from('client_subscriptions')
    .select('id, vip_plan_id, status, current_period_start, current_period_end, next_payment_due, past_due_since, vip_plans(name)')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (subscriptionResult.error) {
    throw new Error('Erro ao consultar assinatura do cliente.')
  }

  const sub = subscriptionResult.data
  if (!sub) {
    return {
      isActive: false,
      isOverdue: false,
      status: 'none',
      allowedToBook: false,
      message: 'Cliente não possui assinatura VIP nesta barbearia.',
    }
  }

  const planName = (sub.vip_plans as { name: string } | null)?.name || 'Plano VIP'

  // Trava imediata caso status seja overdue ou past_due
  if (sub.status === 'overdue' || sub.status === 'past_due') {
    return {
      isActive: false,
      isOverdue: true,
      status: sub.status,
      planId: sub.vip_plan_id,
      planName,
      allowedToBook: false,
      currentPeriodEnd: sub.current_period_end,
      nextPaymentDue: sub.next_payment_due,
      message: 'Assinatura VIP em atraso. Regularize a fatura para continuar agendando cortes VIP.',
    }
  }

  if (sub.status === 'suspended' || sub.status === 'cancelled' || sub.status === 'expired') {
    return {
      isActive: false,
      isOverdue: false,
      status: sub.status,
      planId: sub.vip_plan_id,
      planName,
      allowedToBook: false,
      message: `Assinatura VIP ${sub.status === 'cancelled' ? 'cancelada' : 'inativa'}.`,
    }
  }

  // Verifica se o período atual ainda está válido
  const periodEnded = Date.parse(sub.current_period_end) <= Date.now()
  if (periodEnded) {
    return {
      isActive: false,
      isOverdue: true,
      status: 'expired',
      planId: sub.vip_plan_id,
      planName,
      allowedToBook: false,
      message: 'O período da assinatura VIP expirou. Renove sua assinatura para agendar.',
    }
  }

  return {
    isActive: true,
    isOverdue: false,
    status: 'active',
    planId: sub.vip_plan_id,
    planName,
    allowedToBook: true,
    message: 'Assinatura VIP ativa e regular.',
    currentPeriodEnd: sub.current_period_end,
    nextPaymentDue: sub.next_payment_due,
  }
}

/**
 * Webhook/Gatilho executado ao vencer o plano sem compensação:
 * Altera client_subscriptions.status = 'overdue' e registra data do atraso.
 */
export async function handleVipLatePayment(subscriptionId: string): Promise<{
  success: boolean
  subscriptionId: string
  status: SubscriptionStatus
}> {
  assertUuid(subscriptionId, 'subscriptionId')

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  const updateResult = await admin
    .from('client_subscriptions')
    .update({
      status: 'overdue',
      past_due_since: nowIso,
      updated_at: nowIso,
    })
    .eq('id', subscriptionId)
    .select('id, status')
    .single()

  if (updateResult.error || !updateResult.data) {
    throw new Error('Falha ao atualizar status de inadimplência da assinatura VIP.')
  }

  return {
    success: true,
    subscriptionId: updateResult.data.id,
    status: updateResult.data.status,
  }
}

/**
 * Reativa a assinatura VIP quando o pagamento em atraso for compensado.
 */
export async function reactivateVipSubscription(subscriptionId: string): Promise<{
  success: boolean
  subscriptionId: string
  status: SubscriptionStatus
  newPeriodEnd: string
}> {
  assertUuid(subscriptionId, 'subscriptionId')

  const admin = createAdminClient()
  const now = new Date()
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const updateResult = await admin
    .from('client_subscriptions')
    .update({
      status: 'active',
      past_due_since: null,
      current_period_start: now.toISOString(),
      current_period_end: next30Days.toISOString(),
      next_payment_due: next30Days.toISOString().slice(0, 10),
      updated_at: now.toISOString(),
    })
    .eq('id', subscriptionId)
    .select('id, status, current_period_end')
    .single()

  if (updateResult.error || !updateResult.data) {
    throw new Error('Falha ao reativar assinatura VIP.')
  }

  return {
    success: true,
    subscriptionId: updateResult.data.id,
    status: updateResult.data.status,
    newPeriodEnd: updateResult.data.current_period_end,
  }
}

/**
 * Cria a assinatura VIP do cliente conectando os modos 'recurrent_card' ou 'manual_pix'
 * de acordo com a política definida em tenant_settings.vip_payment_mode.
 */
export async function subscribeClientToVipPlan(
  tenantId: string,
  clientId: string,
  vipPlanId: string,
  paymentMethod: PaymentMethod = 'online_gateway',
): Promise<SubscribeVipResult> {
  assertUuid(tenantId, 'tenantId')
  assertUuid(clientId, 'clientId')
  assertUuid(vipPlanId, 'vipPlanId')

  const admin = createAdminClient()

  const [tenantSettingsResult, planResult, clientResult] = await Promise.all([
    admin.from('tenant_settings').select('vip_payment_mode').eq('tenant_id', tenantId).single(),
    admin.from('vip_plans').select('*').eq('id', vipPlanId).eq('tenant_id', tenantId).eq('is_active', true).single(),
    admin.from('profiles').select('id, full_name, email, phone').eq('id', clientId).single(),
  ])

  if (tenantSettingsResult.error || !tenantSettingsResult.data) {
    throw new Error('Configuração de pagamentos VIP do tenant não encontrada.')
  }

  if (planResult.error || !planResult.data) {
    throw new Error('Plano VIP indisponível para assinatura.')
  }

  if (clientResult.error || !clientResult.data) {
    throw new Error('Cliente não encontrado.')
  }

  const plan = planResult.data
  const client = clientResult.data
  const vipPaymentMode = tenantSettingsResult.data.vip_payment_mode
  const now = new Date()
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const nextPaymentDate = periodEnd.toISOString().slice(0, 10)

  // Insere a assinatura com status ativo
  const subResult = await admin
    .from('client_subscriptions')
    .insert({
      tenant_id: tenantId,
      client_id: clientId,
      vip_plan_id: vipPlanId,
      status: 'active',
      payment_method: paymentMethod,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      next_payment_due: nextPaymentDate,
    })
    .select('id')
    .single()

  if (subResult.error || !subResult.data) {
    throw new Error('Não foi possível registrar a assinatura do plano VIP.')
  }

  const subscriptionId = subResult.data.id
  let pixChargeData: SubscribeVipResult['pixCharge'] = undefined
  let checkoutUrl: string | null = null

  // Se o modo for manual_pix ou recurrent_card com gateway configurado
  try {
    const gatewayConn = await getGatewayConnection(tenantId).catch(() => null)
    if (gatewayConn) {
      const priceCents = toCents(Number(plan.monthly_price))
      const expiryIso = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

      if (vipPaymentMode === 'manual_pix') {
        const pix = await createPixCharge(tenantId, subscriptionId, priceCents, expiryIso, {
          name: client.full_name,
          email: client.email,
          phone: client.phone || '11999999999',
        })
        pixChargeData = {
          qrCode: pix.qrCode,
          qrCodeImage: pix.qrCodeImage,
          checkoutUrl: pix.checkoutUrl,
          expiresAt: pix.expiresAt,
        }
        await admin
          .from('client_subscriptions')
          .update({ gateway_payment_id: pix.externalId })
          .eq('id', subscriptionId)
      } else {
        // recurrent_card
        checkoutUrl = `${process.env.NEXT_PUBLIC_APP_URL || ''}/checkout/vip/${subscriptionId}`
      }
    }
  } catch (gwError) {
    console.error('Falha ao acionar gateway para assinatura VIP:', gwError)
  }

  return {
    subscriptionId,
    planId: vipPlanId,
    status: 'active',
    paymentMode: vipPaymentMode,
    currentPeriodEnd: periodEnd.toISOString(),
    nextPaymentDue: nextPaymentDate,
    pixCharge: pixChargeData,
    checkoutUrl,
  }
}
