'use server'

import { awardFidelityStamp } from '@/lib/retention/fidelity'
import { calculateCommission } from '@/lib/financial/closings'
import { deductConsumablesForAppointment } from '@/lib/inventory/consumables'
import { generateBarberCalendarToken } from '@/lib/calendar/sync'
import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type AppointmentStatus = Database['public']['Enums']['appointment_status']
type PaymentMethod = Database['public']['Enums']['payment_method']

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Identity = {
  userId: string
  role: Database['public']['Enums']['user_role'] | null
  tenantId: string | null
}

async function getIdentity(): Promise<Identity> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (!userId) return { userId: '', role: null, tenantId: null }
  const { data: profile } = await supabase.from('profiles').select('role,tenant_id').eq('id', userId).maybeSingle()
  return { userId, role: profile?.role ?? null, tenantId: profile?.tenant_id ?? null }
}

export async function getDailyAppointments(
  tenantId: string,
  dateStr: string,
  barberId?: string,
) {
  if (!UUID_PATTERN.test(tenantId)) {
    throw new Error('Barbearia inválida.')
  }

  const from = `${dateStr}T00:00:00.000Z`
  const to = `${dateStr}T23:59:59.999Z`

  const admin = createAdminClient()
  let query = admin
    .from('appointments')
    .select(`
      id,
      tenant_id,
      barber_id,
      client_id,
      status,
      starts_at,
      ends_at,
      total_amount,
      reservation_fee,
      reservation_fee_paid,
      balance_due,
      balance_paid_amount,
      cash_received_by_barber,
      payment_method,
      payment_status,
      guest_name,
      guest_phone,
      notes,
      barber:profiles!appointments_barber_id_fkey(id, full_name, avatar_url),
      client:profiles!appointments_client_id_fkey(id, full_name, phone, avatar_url),
      appointment_services(service_id, service_name, unit_price, duration_minutes)
    `)
    .eq('tenant_id', tenantId)
    .gte('starts_at', from)
    .lte('starts_at', to)
    .order('starts_at', { ascending: true })

  if (barberId && UUID_PATTERN.test(barberId)) {
    query = query.eq('barber_id', barberId)
  }

  const { data, error } = await query
  if (error) {
    throw new Error('Falha ao consultar agendamentos diários.')
  }

  return data ?? []
}

export async function getBarbersList(tenantId: string) {
  if (!UUID_PATTERN.test(tenantId)) return []

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url, phone, is_active')
    .eq('tenant_id', tenantId)
    .eq('role', 'barber')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  return data ?? []
}

export type QuickWalkInInput = {
  tenantId: string
  barberId: string
  serviceIds: string[]
  paymentMethod: Extract<PaymentMethod, 'cash' | 'card_machine' | 'pix_tenant'>
  guestName?: string
  guestPhone?: string
  clientId?: string
  notes?: string
}

export async function quickWalkInAppointment(input: QuickWalkInInput) {
  if (!UUID_PATTERN.test(input.tenantId) || !UUID_PATTERN.test(input.barberId)) {
    return { success: false, message: 'Identificadores inválidos.' }
  }

  if (!Array.isArray(input.serviceIds) || input.serviceIds.length === 0) {
    return { success: false, message: 'Selecione ao menos um serviço.' }
  }

  const admin = createAdminClient()

  // Carrega serviços
  const { data: services, error: servError } = await admin
    .from('services')
    .select('id, name, price, duration_minutes, cleanup_minutes')
    .eq('tenant_id', input.tenantId)
    .in('id', input.serviceIds)

  if (servError || !services || services.length === 0) {
    return { success: false, message: 'Serviços não encontrados.' }
  }

  const totalAmount = services.reduce((acc, s) => acc + Number(s.price), 0)
  const totalDuration = services.reduce((acc, s) => acc + s.duration_minutes + s.cleanup_minutes, 0)

  const now = new Date()
  const endsAt = new Date(now.getTime() + totalDuration * 60_000)

  const insertAppt = await admin
    .from('appointments')
    .insert({
      tenant_id: input.tenantId,
      barber_id: input.barberId,
      client_id: input.clientId || null,
      guest_name: input.clientId ? null : (input.guestName?.trim() || 'Cliente Avulso'),
      guest_phone: input.clientId ? null : (input.guestPhone?.trim() || null),
      status: 'completed',
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      is_walk_in: true,
      is_quick_sale: true,
      total_amount: totalAmount,
      reservation_fee: 0,
      reservation_fee_paid: 0,
      balance_paid_amount: totalAmount,
      cash_received_by_barber: input.paymentMethod === 'cash' ? totalAmount : 0,
      payment_method: input.paymentMethod,
      payment_status: 'paid',
      settled_at: now.toISOString(),
      completed_at: now.toISOString(),
      notes: input.notes?.trim() || null,
    })
    .select('id')
    .single()

  if (insertAppt.error || !insertAppt.data) {
    return { success: false, message: 'Não foi possível registrar o atendimento avulso.' }
  }

  const apptId = insertAppt.data.id

  // Registra serviços
  const snapshots = services.map((s) => ({
    appointment_id: apptId,
    service_id: s.id,
    service_name: s.name,
    duration_minutes: s.duration_minutes + s.cleanup_minutes,
    unit_price: Number(s.price),
  }))

  await admin.from('appointment_services').insert(snapshots)

  // Computa comissão e fidelidade
  try {
    await calculateCommission(input.barberId, apptId)
    if (input.clientId) {
      await awardFidelityStamp(input.tenantId, input.clientId, apptId)
    }
  } catch (err) {
    console.error('Pós-processamento de comissão/fidelidade falhou:', err)
  }

  return {
    success: true,
    data: {
      appointmentId: apptId,
      totalAmount,
      paymentMethod: input.paymentMethod,
    },
  }
}

export async function getCurrentBarberProfile() {
  const supabase = await createClient()
  const { data: claimsData } = await supabase.auth.getClaims()
  const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null

  if (!userId) {
    // Fallback para desenvolvimento / primeiro barbeiro
    const admin = createAdminClient()
    const { data: firstBarber } = await admin
      .from('profiles')
      .select('id, tenant_id, full_name, avatar_url, role, phone, commission_percent')
      .eq('role', 'barber')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()

    if (firstBarber) {
      return {
        barberId: firstBarber.id,
        tenantId: firstBarber.tenant_id || '',
        fullName: firstBarber.full_name,
        avatarUrl: firstBarber.avatar_url,
        role: firstBarber.role,
        commissionPercent: firstBarber.commission_percent,
      }
    }
    return null
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, tenant_id, full_name, avatar_url, role, phone, commission_percent')
    .eq('id', userId)
    .maybeSingle()

  if (!profile || !profile.tenant_id) return null

  return {
    barberId: profile.id,
    tenantId: profile.tenant_id,
    fullName: profile.full_name,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    commissionPercent: profile.commission_percent,
  }
}

export async function updateAppointmentStatus(
  appointmentId: string,
  newStatus: AppointmentStatus,
) {
  if (!UUID_PATTERN.test(appointmentId)) {
    return { success: false, message: 'ID de agendamento inválido.' }
  }

  const identity = await getIdentity()
  if (!identity.userId || !identity.tenantId) {
    return { success: false, message: 'Autenticação necessária.' }
  }

  const admin = createAdminClient()
  const { data: appt, error: apptErr } = await admin
    .from('appointments')
    .select('id, tenant_id, barber_id')
    .eq('id', appointmentId)
    .single()

  if (apptErr || !appt || appt.tenant_id !== identity.tenantId) {
    return { success: false, message: 'Agendamento não encontrado.' }
  }

  if (identity.role !== 'owner' && (identity.role !== 'barber' || appt.barber_id !== identity.userId)) {
    return { success: false, message: 'Acesso não autorizado para alterar este agendamento.' }
  }

  const updatePayload: Partial<Database['public']['Tables']['appointments']['Update']> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  if (newStatus === 'completed') {
    updatePayload.completed_at = new Date().toISOString()
  }

  const { error } = await admin
    .from('appointments')
    .update(updatePayload)
    .eq('id', appointmentId)

  if (error) {
    return { success: false, message: 'Falha ao atualizar status do agendamento.' }
  }

  if (newStatus === 'completed') {
    try {
      await deductConsumablesForAppointment(appointmentId)
    } catch (consumablesErr) {
      console.error('Falha ao dar baixa automática nos insumos:', consumablesErr)
    }
  }

  return { success: true }
}

export async function getBarberDailySummary(tenantId: string, barberId: string, dateStr: string) {
  if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(barberId)) {
    return {
      completedCount: 0,
      totalGross: 0,
      commissionTotal: 0,
      cashReceived: 0,
    }
  }

  const identity = await getIdentity()
  if (!identity.userId || identity.tenantId !== tenantId) {
    return {
      completedCount: 0,
      totalGross: 0,
      commissionTotal: 0,
      cashReceived: 0,
    }
  }

  // Apenas o dono ou o próprio profissional autenticado podem visualizar os valores
  if (identity.role !== 'owner' && (identity.role !== 'barber' || identity.userId !== barberId)) {
    return {
      completedCount: 0,
      totalGross: 0,
      commissionTotal: 0,
      cashReceived: 0,
    }
  }

  const admin = createAdminClient()
  const from = `${dateStr}T00:00:00.000Z`
  const to = `${dateStr}T23:59:59.999Z`

  const [apptsRes, commsRes] = await Promise.all([
    admin
      .from('appointments')
      .select('total_amount, cash_received_by_barber, status')
      .eq('tenant_id', tenantId)
      .eq('barber_id', barberId)
      .gte('starts_at', from)
      .lte('starts_at', to),
    admin
      .from('commissions')
      .select('commission_amount')
      .eq('tenant_id', tenantId)
      .eq('barber_id', barberId)
      .gte('created_at', from)
      .lte('created_at', to),
  ])

  const appointments = apptsRes.data ?? []
  const commissions = commsRes.data ?? []

  const completed = appointments.filter((a) => a.status === 'completed')
  const totalGross = completed.reduce((acc, a) => acc + Number(a.total_amount || 0), 0)
  const cashReceived = appointments.reduce((acc, a) => acc + Number(a.cash_received_by_barber || 0), 0)
  const commissionTotal = commissions.reduce((acc, c) => acc + Number(c.commission_amount || 0), 0)

  return {
    completedCount: completed.length,
    totalGross,
    commissionTotal,
    cashReceived,
  }
}

/**
 * Retorna a URL de feed iCal / Webcal assinada para sincronização da agenda do barbeiro com Google Calendar / Apple Calendar
 */
export async function getBarberCalendarFeedUrlAction(targetBarberId?: string) {
  const identity = await getIdentity()
  if (!identity.userId || !identity.tenantId) {
    return { success: false, message: 'Autenticação necessária.' }
  }

  const barberId = targetBarberId || identity.userId
  if (!UUID_PATTERN.test(barberId)) {
    return { success: false, message: 'Barbeiro inválido.' }
  }

  if (identity.role === 'barber' && identity.userId !== barberId) {
    return { success: false, message: 'Acesso não autorizado ao calendário deste profissional.' }
  }

  const token = generateBarberCalendarToken(barberId, identity.tenantId)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://barbersaas.com'
  const httpsUrl = `${baseUrl}/api/calendar/${barberId}/feed.ics?token=${token}`
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, 'webcal://')

  return {
    success: true,
    feedUrl: httpsUrl,
    webcalUrl,
    token,
  }
}

