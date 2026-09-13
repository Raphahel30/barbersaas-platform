'use server'

import { getAvailableSlots } from '@/lib/booking/slots'
import { dispatchAppointmentNotifications, type WhatsAppDispatchResult } from '@/lib/services/whatsapp'
import { requireCurrentTenant } from '@/lib/tenant'
import type { Database, Json } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type PaymentMethod = Database['public']['Enums']['payment_method']
type UserRole = Database['public']['Enums']['user_role']

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type BookingActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; message: string }

export type CreateAppointmentHoldInput = {
  tenantId: string
  barberId: string
  serviceIds: string[]
  startsAt: string
  clientId?: string
  guestName?: string
  guestPhone?: string
  notes?: string
}

export type AppointmentHold = {
  appointmentId: string
  startsAt: string
  endsAt: string
  expiresAt: string
  remainingSeconds: number
  totalAmount: number
  reservationFee: number
  vipDiscountAmount: number
  fidelityDiscountAmount: number
}

export type ConfirmPaymentInput = {
  appointmentId: string
  paymentMethod: PaymentMethod
  gatewayPaymentId?: string
}

export type QuickSaleInput = {
  tenantId: string
  barberId: string
  serviceIds: string[]
  paymentMethod: PaymentMethod
  clientId?: string
  guestName?: string
  guestPhone?: string
  notes?: string
}

type Identity = { userId: string; role: UserRole | null; tenantId: string | null }

function toCents(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Invalid monetary value')
  return Math.round(value * 100)
}

function fromCents(value: number): number {
  return value / 100
}

function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  const local = digits.startsWith('55') ? digits.slice(2) : digits
  return local.length === 10 || local.length === 11 ? `55${local}` : null
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

async function getIdentity(): Promise<Identity> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (!userId) return { userId: '', role: null, tenantId: null }
  const { data: profile } = await supabase.from('profiles').select('role,tenant_id').eq('id', userId).maybeSingle()
  return { userId, role: profile?.role ?? null, tenantId: profile?.tenant_id ?? null }
}

function assertIds(ids: string[]): boolean {
  return ids.length > 0 && ids.every((id) => UUID_PATTERN.test(id)) && new Set(ids).size === ids.length
}

export async function createAppointmentHold(
  input: CreateAppointmentHoldInput,
): Promise<BookingActionResult<AppointmentHold>> {
  if (!UUID_PATTERN.test(input.tenantId) || !UUID_PATTERN.test(input.barberId) || !assertIds(input.serviceIds)) {
    return { success: false, message: 'Dados do agendamento inválidos.' }
  }
  const tenantContext = await requireCurrentTenant()
  if (tenantContext.id !== input.tenantId) return { success: false, message: 'Barbearia inválida.' }

  const requestedStart = new Date(input.startsAt)
  if (Number.isNaN(requestedStart.getTime()) || requestedStart.getTime() <= Date.now()) {
    return { success: false, message: 'Escolha um horário futuro válido.' }
  }

  const identity = await getIdentity()
  const clientId = input.clientId ?? null
  if (clientId && (!UUID_PATTERN.test(clientId) || identity.userId !== clientId)) {
    return { success: false, message: 'O cliente autenticado não corresponde ao agendamento.' }
  }
  const guestName = input.guestName?.trim() || null
  const guestPhone = input.guestPhone ? normalizePhone(input.guestPhone) : null
  if (!clientId && (!guestName || guestName.length < 2 || !guestPhone)) {
    return { success: false, message: 'Visitantes devem informar nome e WhatsApp válidos.' }
  }

  const admin = createAdminClient()
  const [tenantResult, settingsResult, servicesResult] = await Promise.all([
    admin.from('tenants').select('status').eq('id', input.tenantId).single(),
    admin.from('tenant_settings').select('timezone').eq('tenant_id', input.tenantId).single(),
    admin.from('services').select('*').eq('tenant_id', input.tenantId).eq('is_active', true).in('id', input.serviceIds),
  ])
  const queryError = tenantResult.error ?? settingsResult.error ?? servicesResult.error
  if (queryError || !tenantResult.data || !settingsResult.data || !servicesResult.data) {
    return { success: false, message: 'Não foi possível validar a disponibilidade.' }
  }
  if (tenantResult.data.status === 'suspended' || tenantResult.data.status === 'cancelled') {
    return { success: false, message: 'Esta barbearia não aceita novos agendamentos no momento.' }
  }
  if (servicesResult.data.length !== input.serviceIds.length) {
    return { success: false, message: 'Um ou mais serviços não estão disponíveis.' }
  }

  const localDateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: settingsResult.data.timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(requestedStart)
  const part = (type: 'year' | 'month' | 'day') => localDateParts.find((item) => item.type === type)?.value ?? ''
  const localDate = `${part('year')}-${part('month')}-${part('day')}`
  const slots = await getAvailableSlots(input.tenantId, input.barberId, localDate, input.serviceIds)
  const selectedSlot = slots.find((slot) => slot.startsAt === requestedStart.toISOString())
  if (!selectedSlot) return { success: false, message: 'Este horário não está mais disponível.' }

  let payableCents = servicesResult.data.reduce((sum, service) => sum + toCents(service.price), 0)
  let reservationFeeCents = servicesResult.data.reduce((sum, service) => sum + toCents(service.reservation_fee), 0)

  // Aplicar precificação dinâmica (Yield Management)
  if (selectedSlot.isPromotional && (selectedSlot.discountAmount ?? 0) > 0) {
    const discountCents = toCents(selectedSlot.discountAmount!)
    payableCents = Math.max(0, payableCents - discountCents)
  }

  if (selectedSlot.requireFullFee) {
    reservationFeeCents = payableCents
  } else {
    reservationFeeCents = Math.min(reservationFeeCents, payableCents)
  }

  let vipDiscountCents = 0
  let fidelityDiscountCents = 0
  let fidelityCardId: string | null = null

  // 2. Validação estrita de Desconto de Aniversário no Backend (Verifica data de nascimento em clients)
  let isBirthdayBonusApplied = false
  const targetPhone = guestPhone ? guestPhone.replace(/\D/g, '') : null
  let clientRecord: { id: string; birth_date?: string | null; name?: string } | null = null

  if (clientId) {
    const { data: c } = await admin
      .from('clients')
      .select('id, birth_date, name')
      .eq('id', clientId)
      .eq('tenant_id', input.tenantId)
      .maybeSingle()
    clientRecord = c as any
  } else if (targetPhone && targetPhone.length >= 8) {
    const { data: c } = await admin
      .from('clients')
      .select('id, birth_date, name')
      .eq('tenant_id', input.tenantId)
      .ilike('phone', `%${targetPhone.slice(-8)}%`)
      .maybeSingle()
    clientRecord = c as any
  }

  if (clientRecord?.birth_date) {
    const bdayParts = clientRecord.birth_date.split('-')
    const bdayMonth = bdayParts.length >= 2 ? parseInt(bdayParts[1], 10) - 1 : null
    const bookingMonth = requestedStart.getUTCMonth()
    if (bdayMonth === bookingMonth) {
      isBirthdayBonusApplied = true
      const bdayDiscountCents = Math.round(payableCents * 0.2) // 20% OFF Aniversariante
      payableCents = Math.max(0, payableCents - bdayDiscountCents)
    }
  }

  if (clientId) {
    const nowIso = new Date().toISOString()
    const overdueCheck = await admin
      .from('client_subscriptions')
      .select('id, status')
      .eq('tenant_id', input.tenantId)
      .eq('client_id', clientId)
      .in('status', ['overdue', 'past_due'])
      .limit(1)
      .maybeSingle()

    if (overdueCheck.data) {
      return {
        success: false,
        message: 'Assinatura VIP em atraso. Regularize a fatura para continuar agendando como VIP.',
      }
    }

    const subscriptionResult = await admin
      .from('client_subscriptions')
      .select('vip_plan_id')
      .eq('tenant_id', input.tenantId)
      .eq('client_id', clientId)
      .eq('status', 'active')
      .lte('current_period_start', nowIso)
      .gt('current_period_end', nowIso)
      .limit(1)
      .maybeSingle()
    if (subscriptionResult.error) return { success: false, message: 'Não foi possível validar a assinatura VIP.' }
    if (subscriptionResult.data) {
      const planResult = await admin.from('vip_plans').select('included_services').eq('id', subscriptionResult.data.vip_plan_id).eq('is_active', true).single()
      if (planResult.error) return { success: false, message: 'Não foi possível validar o plano VIP.' }
      const includedIds = parseIncludedServiceIds(planResult.data.included_services)
      vipDiscountCents = servicesResult.data
        .filter((service) => includedIds.has(service.id))
        .reduce((sum, service) => sum + toCents(service.price), 0)
      payableCents = Math.max(0, payableCents - vipDiscountCents)
      reservationFeeCents = 0
    }

    const fidelityResult = await admin
      .from('fidelity_cards')
      .select('*')
      .eq('tenant_id', input.tenantId)
      .eq('client_id', clientId)
      .is('redeemed_at', null)
      .gt('expires_at', nowIso)
      .limit(1)
      .maybeSingle()
    if (fidelityResult.error) return { success: false, message: 'Não foi possível validar a fidelidade.' }
    const card = fidelityResult.data
    const currentStamps = card ? (card.stamps_count ?? (card as unknown as { stamps?: number }).stamps ?? 0) : 0
    if (card && currentStamps >= card.target_stamps) {
      fidelityCardId = card.id
      if (card.reward_type === 'full_discount') fidelityDiscountCents = payableCents
      if (card.reward_type === 'percentage_discount') {
        const percent = Math.min(100, Math.max(0, Number(card.reward_value ?? 0)))
        fidelityDiscountCents = Math.round(payableCents * percent / 100)
      }
      if (card.reward_type === 'fixed_discount') {
        fidelityDiscountCents = Math.min(payableCents, toCents(Number(card.reward_value ?? 0)))
      }
      if (card.reward_type === 'free_service' && card.reward_reference_id) {
        const freeService = servicesResult.data.find((service) => service.id === card.reward_reference_id)
        fidelityDiscountCents = freeService ? Math.min(payableCents, toCents(freeService.price)) : 0
      }
      payableCents = Math.max(0, payableCents - fidelityDiscountCents)
      reservationFeeCents = Math.min(reservationFeeCents, payableCents)
    }
  }

  // Execução via Função Transacional Atômica no Supabase
  const rpcResult = await (admin as any).rpc('create_appointment_hold_atomic', {
    p_tenant_id: input.tenantId,
    p_barber_id: input.barberId,
    p_service_ids: input.serviceIds,
    p_client_name: clientId ? 'Cliente Cadastrado' : (guestName || 'Cliente'),
    p_client_phone: clientId ? '' : (guestPhone || ''),
    p_starts_at: selectedSlot.startsAt,
    p_ends_at: selectedSlot.endsAt,
    p_total_amount: fromCents(payableCents),
    p_reservation_fee: fromCents(reservationFeeCents),
    p_notes: input.notes?.trim() || null,
  })

  if (!rpcResult.error && rpcResult.data && (rpcResult.data as any).success) {
    const resData = rpcResult.data as any
    const isMonthly = Boolean(resData.is_monthly)
    return {
      success: true,
      data: {
        appointmentId: resData.appointment_id,
        startsAt: selectedSlot.startsAt,
        endsAt: selectedSlot.endsAt,
        expiresAt: resData.hold_expires_at || new Date(Date.now() + 5 * 60_000).toISOString(),
        remainingSeconds: 300,
        totalAmount: isMonthly ? 0 : fromCents(payableCents),
        reservationFee: isMonthly ? 0 : fromCents(reservationFeeCents),
        vipDiscountAmount: fromCents(vipDiscountCents),
        fidelityDiscountAmount: fromCents(fidelityDiscountCents),
        isMonthlySubscriber: isMonthly,
      } as any,
    }
  }

  const holdExpiresAt = new Date(Date.now() + 5 * 60_000)
  const appointmentResult = await admin.from('appointments').insert({
    tenant_id: input.tenantId,
    barber_id: input.barberId,
    client_id: clientId,
    status: 'hold',
    starts_at: selectedSlot.startsAt,
    ends_at: selectedSlot.endsAt,
    hold_expires_at: holdExpiresAt.toISOString(),
    guest_name: clientId ? null : guestName,
    guest_phone: clientId ? null : guestPhone,
    notes: input.notes?.trim() || null,
    total_amount: fromCents(payableCents),
    reservation_fee: fromCents(reservationFeeCents),
    vip_discount_amount: fromCents(vipDiscountCents),
    fidelity_discount_amount: fromCents(fidelityDiscountCents),
    fidelity_card_id: fidelityCardId,
  }).select('id').single()
  if (appointmentResult.error) {
    return { success: false, message: appointmentResult.error.code === '23P01' ? 'Este horário acabou de ser reservado.' : 'Não foi possível criar a reserva.' }
  }

  const serviceSnapshots = servicesResult.data.map((service) => ({
    appointment_id: appointmentResult.data.id,
    service_id: service.id,
    service_name: service.name,
    duration_minutes: service.duration_minutes + service.cleanup_minutes,
    unit_price: service.price,
  }))
  const snapshotResult = await admin.from('appointment_services').insert(serviceSnapshots)
  if (snapshotResult.error) {
    await admin.from('appointments').delete().eq('id', appointmentResult.data.id)
    return { success: false, message: 'Não foi possível registrar os serviços da reserva.' }
  }

  return { success: true, data: {
    appointmentId: appointmentResult.data.id,
    startsAt: selectedSlot.startsAt,
    endsAt: selectedSlot.endsAt,
    expiresAt: holdExpiresAt.toISOString(),
    remainingSeconds: 300,
    totalAmount: fromCents(payableCents),
    reservationFee: fromCents(reservationFeeCents),
    vipDiscountAmount: fromCents(vipDiscountCents),
    fidelityDiscountAmount: fromCents(fidelityDiscountCents),
  } }
}

export async function confirmAppointmentPayment(
  input: ConfirmPaymentInput,
): Promise<BookingActionResult<{ appointmentId: string; notifications: WhatsAppDispatchResult[] }>> {
  if (!UUID_PATTERN.test(input.appointmentId)) return { success: false, message: 'Agendamento inválido.' }
  const identity = await getIdentity()
  const admin = createAdminClient()
  const appointmentResult = await admin.from('appointments').select('*').eq('id', input.appointmentId).single()
  if (appointmentResult.error) return { success: false, message: 'Agendamento não encontrado.' }
  const appointment = appointmentResult.data
  const isClient = Boolean(identity.userId) && appointment.client_id === identity.userId
  const isStaff = identity.tenantId === appointment.tenant_id && ['owner', 'barber', 'receptionist'].includes(identity.role ?? '')
  if (!isClient && !isStaff) return { success: false, message: 'Você não pode confirmar este agendamento.' }
  if (toCents(appointment.reservation_fee) > 0 && !isStaff) {
    return { success: false, message: 'A confirmação do sinal deve ser processada pelo gateway ou pela equipe.' }
  }
  if (appointment.status !== 'hold' || !appointment.hold_expires_at || Date.parse(appointment.hold_expires_at) <= Date.now()) {
    return { success: false, message: 'O tempo desta reserva expirou.' }
  }

  const updateResult = await admin.from('appointments').update({
    status: 'scheduled',
    reservation_fee_paid: appointment.reservation_fee,
    payment_status: toCents(appointment.reservation_fee) > 0 ? 'paid' : 'pending',
    payment_method: input.paymentMethod,
    gateway_payment_id: input.gatewayPaymentId?.trim() || null,
    hold_expires_at: null,
  }).eq('id', appointment.id).eq('status', 'hold').gt('hold_expires_at', new Date().toISOString()).select('id').maybeSingle()
  if (updateResult.error || !updateResult.data) return { success: false, message: 'A reserva expirou ou já foi processada.' }

  if (appointment.fidelity_card_id) {
    await admin.from('fidelity_cards').update({ redeemed_at: new Date().toISOString() }).eq('id', appointment.fidelity_card_id).is('redeemed_at', null)
  }
  let notifications: WhatsAppDispatchResult[] = []
  try {
    notifications = await dispatchAppointmentNotifications(appointment.tenant_id, appointment.id, 'confirmation')
  } catch {
    notifications = []
  }
  return { success: true, data: { appointmentId: appointment.id, notifications } }
}

async function createCounterAppointment(input: QuickSaleInput, kind: 'quick' | 'walk-in'): Promise<BookingActionResult<{ appointmentId: string; commissionAmount: number }>> {
  if (!UUID_PATTERN.test(input.tenantId) || !UUID_PATTERN.test(input.barberId) || !assertIds(input.serviceIds)) {
    return { success: false, message: 'Dados do atendimento inválidos.' }
  }
  if (input.clientId && !UUID_PATTERN.test(input.clientId)) {
    return { success: false, message: 'Cliente inválido.' }
  }
  const identity = await getIdentity()
  if (identity.tenantId !== input.tenantId || !['owner', 'barber', 'receptionist'].includes(identity.role ?? '')) {
    return { success: false, message: 'Apenas a equipe da barbearia pode lançar atendimentos de balcão.' }
  }
  if (identity.role === 'barber' && identity.userId !== input.barberId) {
    return { success: false, message: 'O barbeiro só pode lançar atendimentos próprios.' }
  }
  const guestPhone = input.guestPhone ? normalizePhone(input.guestPhone) : null
  if (!input.clientId && (!input.guestName?.trim() || !guestPhone)) {
    return { success: false, message: 'Informe o cliente ou os dados do visitante.' }
  }

  const admin = createAdminClient()
  const [servicesResult, barberResult, clientResult] = await Promise.all([
    admin.from('services').select('*').eq('tenant_id', input.tenantId).eq('is_active', true).in('id', input.serviceIds),
    admin.from('profiles').select('commission_percent').eq('id', input.barberId).eq('tenant_id', input.tenantId).eq('role', 'barber').eq('is_active', true).single(),
    input.clientId
      ? admin.from('profiles').select('id').eq('id', input.clientId).eq('tenant_id', input.tenantId).eq('role', 'client').eq('is_active', true).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  if (servicesResult.error || barberResult.error || clientResult.error || (input.clientId && !clientResult.data) || servicesResult.data.length !== input.serviceIds.length) {
    return { success: false, message: 'Serviços ou barbeiro inválidos.' }
  }
  const totalCents = servicesResult.data.reduce((sum, service) => sum + toCents(service.price), 0)
  const durationMinutes = servicesResult.data.reduce((sum, service) => sum + service.duration_minutes + service.cleanup_minutes, 0)
  const commissionCents = Math.round(totalCents * barberResult.data.commission_percent / 100)
  const startsAt = new Date()
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000)
  const appointmentResult = await admin.from('appointments').insert({
    tenant_id: input.tenantId,
    barber_id: input.barberId,
    client_id: input.clientId ?? null,
    status: 'completed',
    starts_at: startsAt.toISOString(),
    ends_at: endsAt.toISOString(),
    is_walk_in: kind === 'walk-in',
    is_quick_sale: kind === 'quick',
    guest_name: input.clientId ? null : input.guestName!.trim(),
    guest_phone: input.clientId ? null : guestPhone,
    notes: input.notes?.trim() || null,
    total_amount: fromCents(totalCents),
    reservation_fee: 0,
    reservation_fee_paid: 0,
    payment_method: input.paymentMethod,
    payment_status: 'paid',
    completed_at: startsAt.toISOString(),
  }).select('id').single()
  if (appointmentResult.error) return { success: false, message: 'Não foi possível registrar o atendimento.' }

  const snapshotsResult = await admin.from('appointment_services').insert(servicesResult.data.map((service) => ({
    appointment_id: appointmentResult.data.id,
    service_id: service.id,
    service_name: service.name,
    duration_minutes: service.duration_minutes + service.cleanup_minutes,
    unit_price: service.price,
  })))
  const commissionResult = await admin.from('commissions').insert({
    tenant_id: input.tenantId,
    barber_id: input.barberId,
    appointment_id: appointmentResult.data.id,
    base_amount: fromCents(totalCents),
    rate_percent: barberResult.data.commission_percent,
    commission_amount: fromCents(commissionCents),
    status: 'payable',
  })
  if (snapshotsResult.error || commissionResult.error) {
    await admin.from('appointments').delete().eq('id', appointmentResult.data.id)
    return { success: false, message: 'O atendimento não pôde ser consolidado no caixa.' }
  }
  return { success: true, data: { appointmentId: appointmentResult.data.id, commissionAmount: fromCents(commissionCents) } }
}

export async function createQuickSale(input: QuickSaleInput) {
  return createCounterAppointment(input, 'quick')
}

export async function createWalkIn(input: QuickSaleInput) {
  return createCounterAppointment(input, 'walk-in')
}

export async function fetchAvailableSlots(
  tenantId: string,
  barberId: string,
  date: string,
  serviceIds: string[],
) {
  if (
    !UUID_PATTERN.test(tenantId) ||
    (!UUID_PATTERN.test(barberId) && barberId !== 'any') ||
    !Array.isArray(serviceIds) ||
    serviceIds.length === 0
  ) {
    return []
  }
  try {
    if (barberId === 'any') {
      const admin = createAdminClient()
      const { data: activeBarbers } = await admin
        .from('profiles')
        .select('id, full_name')
        .eq('tenant_id', tenantId)
        .in('role', ['barber', 'owner'])
        .eq('is_active', true)

      if (!activeBarbers || activeBarbers.length === 0) return []

      const slotMap = new Map<string, any>()

      for (const b of activeBarbers) {
        try {
          const barberSlots = await getAvailableSlots(tenantId, b.id, date, serviceIds)
          for (const s of barberSlots) {
            if (!slotMap.has(s.startsAt)) {
              slotMap.set(s.startsAt, {
                ...s,
                barberId: b.id,
                barberName: b.full_name,
              })
            }
          }
        } catch {
          // ignora dias de folga individuais do barbeiro
        }
      }

      return Array.from(slotMap.values()).sort(
        (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt),
      )
    }

    const slots = await getAvailableSlots(tenantId, barberId, date, serviceIds)
    return slots.map((s) => ({ ...s, barberId }))
  } catch (error) {
    console.error('Falha ao calcular slots disponíveis:', error)
    return []
  }
}

/**
 * Consulta em tempo real o status de pagamento e confirmação do agendamento no Supabase/Gateway.
 */
export async function checkAppointmentPaymentStatus(
  appointmentId: string
): Promise<{
  success: boolean
  status: string
  isConfirmed: boolean
  paymentStatus: string
  message?: string
}> {
  if (!UUID_PATTERN.test(appointmentId)) {
    return {
      success: false,
      status: 'invalid',
      isConfirmed: false,
      paymentStatus: 'invalid',
      message: 'ID de agendamento inválido.',
    }
  }

  try {
    const admin = createAdminClient()
    const { data: apt, error } = await admin
      .from('appointments')
      .select('id, status, payment_status, hold_expires_at, total_amount, reservation_fee, reservation_fee_paid')
      .eq('id', appointmentId)
      .single()

    if (error || !apt) {
      return {
        success: false,
        status: 'not_found',
        isConfirmed: false,
        paymentStatus: 'not_found',
        message: 'Agendamento não localizado.',
      }
    }

    const currentStatus = (apt.status as string) || ''
    const isConfirmed =
      currentStatus === 'confirmed' ||
      currentStatus === 'scheduled' ||
      currentStatus === 'arrived' ||
      currentStatus === 'in_service' ||
      currentStatus === 'completed'

    const isExpired =
      apt.status === 'hold' &&
      apt.hold_expires_at &&
      new Date(apt.hold_expires_at).getTime() < Date.now()

    return {
      success: true,
      status: isExpired ? 'expired' : apt.status,
      isConfirmed,
      paymentStatus: apt.payment_status || 'pending',
    }
  } catch (err: any) {
    return {
      success: false,
      status: 'error',
      isConfirmed: false,
      paymentStatus: 'error',
      message: err?.message,
    }
  }
}

