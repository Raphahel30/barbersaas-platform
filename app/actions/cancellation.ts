'use server'

import { dispatchAppointmentNotifications, type WhatsAppDispatchResult } from '@/lib/services/whatsapp'
import { getGatewayConnection } from '@/lib/payments/gateways'
import { triggerAutoFillForSlot } from '@/lib/booking/waitlist'
import type { Database, Json } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type CancelledBy = 'client' | 'barber' | 'owner' | 'receptionist' | 'no_show'
type Gateway = Database['public']['Enums']['gateway_provider']
type UserRole = Database['public']['Enums']['user_role']

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CancellationResult =
  | {
      success: true
      data: {
        appointmentId: string
        status: 'cancelled' | 'no_show'
        reservationFeeRetained: number
        creditCreated: boolean
        refundStatus: 'not_required' | 'completed' | 'manual_required'
        notifications: WhatsAppDispatchResult[]
      }
    }
  | { success: false; message: string }

type Identity = { userId: string; role: UserRole | null; tenantId: string | null }

function toCents(value: number): number {
  return Math.round(value * 100)
}

function getCredential(credentials: Json, ...keys: string[]): string | null {
  if (!credentials || Array.isArray(credentials) || typeof credentials !== 'object') return null
  for (const key of keys) {
    const value = credentials[key]
    if (typeof value === 'string' && value.length > 0) return value
  }
  return null
}

async function getIdentity(): Promise<Identity> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (!userId) return { userId: '', role: null, tenantId: null }
  const { data: profile } = await supabase.from('profiles').select('role,tenant_id').eq('id', userId).maybeSingle()
  return { userId, role: profile?.role ?? null, tenantId: profile?.tenant_id ?? null }
}

async function requestGatewayRefund(
  gateway: Gateway,
  paymentId: string,
  amount: number,
  credentials: Json,
): Promise<{ completed: boolean; error?: string }> {
  try {
    if (gateway === 'asaas') {
      const token = getCredential(credentials, 'api_key', 'access_token') ?? process.env.ASAAS_API_TOKEN
      if (!token) return { completed: false, error: 'Asaas token is unavailable' }
      const baseUrl = process.env.ASAAS_API_URL ?? 'https://api.asaas.com/v3'
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/payments/${encodeURIComponent(paymentId)}/refund`, {
        method: 'POST',
        headers: { access_token: token, 'content-type': 'application/json' },
        body: JSON.stringify({ value: amount }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      })
      return response.ok ? { completed: true } : { completed: false, error: `Asaas returned HTTP ${response.status}` }
    }
    if (gateway === 'mercado_pago') {
      const token = getCredential(credentials, 'access_token')
      if (!token) return { completed: false, error: 'Mercado Pago token is unavailable' }
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}/refunds`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ amount }),
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      })
      return response.ok ? { completed: true } : { completed: false, error: `Mercado Pago returned HTTP ${response.status}` }
    }
    return { completed: false, error: `${gateway} requires manual refund processing` }
  } catch (error) {
    return { completed: false, error: error instanceof Error ? error.message : 'Gateway refund failed' }
  }
}

export async function cancelAppointment(
  appointmentId: string,
  cancelledBy: CancelledBy,
): Promise<CancellationResult> {
  if (!UUID_PATTERN.test(appointmentId)) return { success: false, message: 'Agendamento inválido.' }
  const validActors: CancelledBy[] = ['client', 'barber', 'owner', 'receptionist', 'no_show']
  if (!validActors.includes(cancelledBy)) return { success: false, message: 'Responsável pelo cancelamento inválido.' }

  const identity = await getIdentity()
  const admin = createAdminClient()
  const appointmentResult = await admin.from('appointments').select('*').eq('id', appointmentId).single()
  if (appointmentResult.error) return { success: false, message: 'Agendamento não encontrado.' }
  const appointment = appointmentResult.data
  if (!['scheduled', 'confirmed'].includes(appointment.status)) {
    return { success: false, message: 'Este agendamento não pode mais ser cancelado.' }
  }

  const isClient = cancelledBy === 'client' && appointment.client_id === identity.userId
  const isBarber = cancelledBy === 'barber' && appointment.barber_id === identity.userId && identity.tenantId === appointment.tenant_id
  const isManagement = ['owner', 'receptionist'].includes(cancelledBy) && identity.role === cancelledBy && identity.tenantId === appointment.tenant_id
  const isNoShow = cancelledBy === 'no_show' && ['owner', 'barber', 'receptionist'].includes(identity.role ?? '') && identity.tenantId === appointment.tenant_id
  if (!isClient && !isBarber && !isManagement && !isNoShow) {
    return { success: false, message: 'Você não pode cancelar este agendamento.' }
  }

  const [settingsResult, tenantResult] = await Promise.all([
    admin.from('tenant_settings').select('cancellation_notice_hours,no_show_policy').eq('tenant_id', appointment.tenant_id).single(),
    admin.from('tenants').select('active_gateway').eq('id', appointment.tenant_id).single(),
  ])
  if (settingsResult.error || tenantResult.error) return { success: false, message: 'Não foi possível carregar a política de cancelamento.' }

  const noticeMilliseconds = settingsResult.data.cancellation_notice_hours * 60 * 60 * 1000
  const hasRequiredNotice = Date.parse(appointment.starts_at) - Date.now() >= noticeMilliseconds
  const barberInitiated = cancelledBy === 'barber' || cancelledBy === 'owner' || cancelledBy === 'receptionist'
  const retainFee = !barberInitiated && (!hasRequiredNotice || isNoShow)
  const newStatus = isNoShow ? 'no_show' : 'cancelled'
  const actorRole: UserRole | null = cancelledBy === 'no_show' ? null : cancelledBy
  const updateResult = await admin.from('appointments').update({
    status: newStatus,
    cancelled_at: new Date().toISOString(),
    cancelled_by: actorRole,
    cancellation_reason: isNoShow ? 'No-show registrado pela equipe' : `Cancelado por ${cancelledBy}`,
  }).eq('id', appointmentId).in('status', ['scheduled', 'confirmed']).select('id').maybeSingle()
  if (updateResult.error || !updateResult.data) return { success: false, message: 'O agendamento já foi alterado por outra operação.' }

  const paidFeeCents = toCents(appointment.reservation_fee_paid)
  let creditCreated = false
  let refundStatus: 'not_required' | 'completed' | 'manual_required' = 'not_required'

  if (retainFee && paidFeeCents > 0) {
    const commissionResult = await admin.from('commissions').insert({
      tenant_id: appointment.tenant_id,
      barber_id: appointment.barber_id,
      appointment_id: appointment.id,
      base_amount: appointment.reservation_fee_paid,
      rate_percent: 100,
      commission_amount: appointment.reservation_fee_paid,
      status: 'payable',
      is_no_show: true,
    })
    if (commissionResult.error && commissionResult.error.code !== '23505') {
      return { success: false, message: 'Cancelado, mas não foi possível computar a comissão retida.' }
    }
  }

  if (!retainFee && paidFeeCents > 0) {
    const mustRefundGateway = barberInitiated || settingsResult.data.no_show_policy === 'gateway_refund'
    if (!mustRefundGateway && appointment.client_id) {
      const creditResult = await admin.from('client_credits').insert({
        tenant_id: appointment.tenant_id,
        client_id: appointment.client_id,
        appointment_id: appointment.id,
        type: 'cancellation',
        amount: appointment.reservation_fee_paid,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      creditCreated = !creditResult.error || creditResult.error.code === '23505'
    } else {
      const gateway = tenantResult.data.active_gateway
      const paymentId = appointment.gateway_payment_id
      let connection: Awaited<ReturnType<typeof getGatewayConnection>> | null = null
      try { if (gateway) connection = await getGatewayConnection(appointment.tenant_id) } catch { connection = null }
      const refund = gateway && paymentId && connection
        ? await requestGatewayRefund(gateway, paymentId, appointment.reservation_fee_paid, connection.credentials)
        : { completed: false, error: 'No refundable gateway payment was found' }
      if (refund.completed) {
        refundStatus = 'completed'
        await admin.from('appointments').update({ payment_status: 'refunded' }).eq('id', appointment.id)
      } else {
        refundStatus = 'manual_required'
        await admin.from('refund_requests').upsert({
          tenant_id: appointment.tenant_id,
          appointment_id: appointment.id,
          client_id: appointment.client_id,
          amount: appointment.reservation_fee_paid,
          gateway,
          gateway_payment_id: paymentId,
          status: 'manual_required',
          reason: barberInitiated ? 'Cancelamento pela barbearia' : 'Cancelamento dentro do prazo',
          error_message: refund.error ?? null,
        }, { onConflict: 'appointment_id,amount' })
      }
    }
  }

  let notifications: WhatsAppDispatchResult[] = []
  try {
    notifications = await dispatchAppointmentNotifications(appointment.tenant_id, appointment.id, 'cancellation')
  } catch {
    notifications = []
  }

  // Preenchimento automático de lacuna da Lista de Espera se cancelado com < 3h ou no-show
  const hoursUntilStart = (Date.parse(appointment.starts_at) - Date.now()) / (1000 * 60 * 60)
  if (isNoShow || hoursUntilStart <= 3) {
    try {
      await triggerAutoFillForSlot(
        appointment.tenant_id,
        appointment.barber_id,
        appointment.starts_at,
        appointment.ends_at
      )
    } catch (waitlistErr) {
      console.error('[Cancellation] Falha ao acionar auto-fill da lista de espera:', waitlistErr)
    }
  }

  return { success: true, data: {
    appointmentId,
    status: newStatus,
    reservationFeeRetained: retainFee ? appointment.reservation_fee_paid : 0,
    creditCreated,
    refundStatus,
    notifications,
  } }
}
