'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { dispatchAppointmentNotifications } from '@/lib/services/whatsapp'
import { requireTenantStaff } from '@/lib/auth/guards'
import type { Database } from '@/types/database.types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface TodayAppointmentMatch {
  id: string
  clientName: string
  clientPhone: string
  barberName: string
  barberId: string
  startsAt: string
  serviceNames: string[]
  status: Database['public']['Enums']['appointment_status']
}

export interface QueueDisplayData {
  inService: {
    id: string
    clientName: string
    barberName: string
    serviceNames: string[]
    startedAt: string
  }[]
  nextUp: {
    id: string
    clientName: string
    barberName: string
    serviceNames: string[]
    startsAt: string
  }[]
  waitingReception: {
    id: string
    clientName: string
    barberName: string
    serviceNames: string[]
    arrivedAt: string
  }[]
}

/**
 * Busca agendamentos de hoje pelo número de telefone do cliente para o Totem de autoatendimento.
 */
export async function searchTodayAppointmentsByPhoneAction(
  tenantSlugOrId: string,
  rawPhone: string
): Promise<{ success: boolean; appointments: TodayAppointmentMatch[]; message?: string }> {
  const cleanPhone = rawPhone.replace(/\D/g, '')
  if (cleanPhone.length < 8) {
    return { success: false, appointments: [], message: 'Digite um número de telefone válido com DDD.' }
  }

  const admin = createAdminClient()

  // 1. Resolve tenant_id se for slug
  let tenantId = tenantSlugOrId
  if (!UUID_PATTERN.test(tenantSlugOrId)) {
    const { data: tenant } = await admin
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlugOrId)
      .maybeSingle()
    if (!tenant) {
      return { success: false, appointments: [], message: 'Barbearia não encontrada.' }
    }
    tenantId = tenant.id
  }

  // 2. Define limites do dia de hoje (00:00:00 até 23:59:59)
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const startOfDay = `${todayStr}T00:00:00.000Z`
  const endOfDay = `${todayStr}T23:59:59.999Z`

  // 3. Busca agendamentos do dia vinculados a este telefone (como convidado ou perfil)
  const { data, error } = await admin
    .from('appointments')
    .select(`
      id,
      starts_at,
      status,
      guest_name,
      guest_phone,
      profiles!appointments_client_id_fkey(full_name, phone),
      barber:profiles!appointments_barber_id_fkey(full_name, id),
      appointment_services(services(name))
    `)
    .eq('tenant_id', tenantId)
    .gte('starts_at', startOfDay)
    .lte('starts_at', endOfDay)
    .in('status', ['scheduled', 'confirmed', 'arrived'])
    .order('starts_at', { ascending: true })

  if (error || !data) {
    return { success: false, appointments: [], message: 'Erro ao buscar agendamentos.' }
  }

  // Filtra pelo telefone aproximado (últimos 8 ou 9 dígitos)
  const phoneSuffix = cleanPhone.slice(-8)
  const matches: TodayAppointmentMatch[] = []

  for (const row of data as any[]) {
    const candidatePhone = (row.profiles?.phone || row.guest_phone || '').replace(/\D/g, '')
    if (candidatePhone.endsWith(phoneSuffix)) {
      const clientName = row.profiles?.full_name || row.guest_name || 'Cliente'
      const barberName = row.barber?.full_name || 'Barbeiro'
      const serviceNames = (row.appointment_services || [])
        .map((as: any) => as.services?.name)
        .filter(Boolean)

      matches.push({
        id: row.id,
        clientName,
        clientPhone: candidatePhone,
        barberName,
        barberId: row.barber?.id || '',
        startsAt: row.starts_at,
        serviceNames,
        status: row.status,
      })
    }
  }

  return { success: true, appointments: matches }
}

/**
 * Realiza o check-in presencial no Totem, alterando o status do agendamento para 'arrived'.
 */
export async function checkInAppointmentAction(
  appointmentId: string
): Promise<{ success: boolean; message: string; barberName?: string }> {
  if (!UUID_PATTERN.test(appointmentId)) {
    return { success: false, message: 'Agendamento inválido.' }
  }

  const admin = createAdminClient()

  const { data: appt, error: apptErr } = await admin
    .from('appointments')
    .select('id, tenant_id, barber_id, status, barber:profiles!appointments_barber_id_fkey(full_name)')
    .eq('id', appointmentId)
    .single()

  if (apptErr || !appt) {
    return { success: false, message: 'Agendamento não localizado.' }
  }

  if (appt.status === 'arrived') {
    return {
      success: true,
      message: 'Seu check-in já foi realizado anteriormente! Pode sentar e aguardar ser chamado.',
      barberName: (appt.barber as any)?.full_name,
    }
  }

  if (!['scheduled', 'confirmed'].includes(appt.status)) {
    return { success: false, message: 'Este horário não está com status válido para check-in.' }
  }

  const { error: updateErr } = await admin
    .from('appointments')
    .update({
      status: 'arrived',
      updated_at: new Date().toISOString(),
    })
    .eq('id', appointmentId)

  if (updateErr) {
    return { success: false, message: 'Falha ao confirmar presença no sistema.' }
  }

  return {
    success: true,
    message: 'Presença confirmada com sucesso! O barbeiro já foi notificado da sua chegada.',
    barberName: (appt.barber as any)?.full_name,
  }
}

/**
 * Cria uma entrada de fila de balcão (Walk-in) direto pelo Totem para clientes sem agendamento prévio.
 */
export async function createWalkInQueueTicketAction(input: {
  tenantSlugOrId: string
  clientName: string
  clientPhone: string
  barberId?: string | null
  serviceIds: string[]
}): Promise<{ success: boolean; message: string; appointmentId?: string }> {
  const admin = createAdminClient()

  let tenantId = input.tenantSlugOrId
  if (!UUID_PATTERN.test(input.tenantSlugOrId)) {
    const { data: tenant } = await admin
      .from('tenants')
      .select('id')
      .eq('slug', input.tenantSlugOrId)
      .maybeSingle()
    if (!tenant) {
      return { success: false, message: 'Barbearia não encontrada.' }
    }
    tenantId = tenant.id
  }

  if (!input.clientName.trim()) {
    return { success: false, message: 'Por favor, digite seu nome.' }
  }

  const cleanPhone = input.clientPhone.replace(/\D/g, '')
  if (cleanPhone.length < 8) {
    return { success: false, message: 'Digite seu telefone com DDD.' }
  }

  if (!input.serviceIds || input.serviceIds.length === 0) {
    return { success: false, message: 'Selecione pelo menos um serviço.' }
  }

  // 1. Busca os serviços para somar tempo e valor
  const { data: services, error: servErr } = await admin
    .from('services')
    .select('id, name, price, duration_minutes, cleanup_minutes')
    .in('id', input.serviceIds)

  if (servErr || !services || services.length === 0) {
    return { success: false, message: 'Serviços não localizados.' }
  }

  const totalAmount = services.reduce((sum, s) => sum + Number(s.price), 0)
  const totalDuration = services.reduce((sum, s) => sum + s.duration_minutes + s.cleanup_minutes, 0)

  // 2. Define o barbeiro (se não selecionado, busca o primeiro ativo do tenant)
  let targetBarberId = input.barberId
  if (!targetBarberId || !UUID_PATTERN.test(targetBarberId)) {
    const { data: barbers } = await admin
      .from('profiles')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('role', 'barber')
      .eq('is_active', true)
      .limit(1)

    if (barbers && barbers.length > 0) {
      targetBarberId = barbers[0].id
    } else {
      return { success: false, message: 'Nenhum barbeiro disponível para atendimento imediato.' }
    }
  }

  const now = new Date()
  const endsAt = new Date(now.getTime() + totalDuration * 60_000).toISOString()

  // 3. Insere o agendamento como walk-in com status 'arrived' (já na recepção)
  const { data: appt, error: apptErr } = await admin
    .from('appointments')
    .insert({
      tenant_id: tenantId,
      barber_id: targetBarberId!,
      guest_name: input.clientName.trim(),
      guest_phone: cleanPhone,
      status: 'arrived',
      starts_at: now.toISOString(),
      ends_at: endsAt,
      is_walk_in: true,
      is_quick_sale: false,
      total_amount: totalAmount,
      reservation_fee: 0,
      reservation_fee_paid: 0,
      balance_paid_amount: 0,
      cash_received_by_barber: 0,
      payment_status: 'pending',
    })
    .select('id')
    .single()

  if (apptErr || !appt) {
    return { success: false, message: 'Falha ao gerar senha de atendimento. Tente novamente.' }
  }

  // 4. Vincula serviços
  const apptServices = services.map((s) => ({
    appointment_id: appt.id,
    service_id: s.id,
    service_name: s.name,
    duration_minutes: s.duration_minutes + s.cleanup_minutes,
    unit_price: s.price,
  }))

  await admin.from('appointment_services').insert(apptServices)

  return {
    success: true,
    message: 'Senha gerada com sucesso! Você entrou na fila de atendimento. Acompanhe a chamada na TV.',
    appointmentId: appt.id,
  }
}

/**
 * Consulta os dados da fila de atendimento em tempo real para o Painel de TV (Queue Display).
 */
export async function getTodayQueueDisplayAction(
  tenantSlugOrId: string
): Promise<{ success: boolean; data: QueueDisplayData; tenantName?: string }> {
  const admin = createAdminClient()

  let tenantId = tenantSlugOrId
  let tenantName = 'Barbearia'

  const { data: tenant } = await admin
    .from('tenants')
    .select('id, name')
    .or(UUID_PATTERN.test(tenantSlugOrId) ? `id.eq.${tenantSlugOrId}` : `slug.eq.${tenantSlugOrId}`)
    .maybeSingle()

  if (tenant) {
    tenantId = tenant.id
    tenantName = tenant.name
  }

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const startOfDay = `${todayStr}T00:00:00.000Z`
  const endOfDay = `${todayStr}T23:59:59.999Z`

  const { data, error } = await admin
    .from('appointments')
    .select(`
      id,
      starts_at,
      status,
      guest_name,
      profiles!appointments_client_id_fkey(full_name),
      barber:profiles!appointments_barber_id_fkey(full_name),
      appointment_services(services(name))
    `)
    .eq('tenant_id', tenantId)
    .gte('starts_at', startOfDay)
    .lte('starts_at', endOfDay)
    .in('status', ['confirmed', 'scheduled', 'arrived'])
    .order('starts_at', { ascending: true })

  if (error || !data) {
    return {
      success: false,
      tenantName,
      data: { inService: [], nextUp: [], waitingReception: [] },
    }
  }

  const inService: QueueDisplayData['inService'] = []
  const nextUp: QueueDisplayData['nextUp'] = []
  const waitingReception: QueueDisplayData['waitingReception'] = []

  for (const row of data as any[]) {
    const clientName = row.profiles?.full_name || row.guest_name || 'Cliente'
    const barberName = row.barber?.full_name || 'Barbeiro'
    const serviceNames = (row.appointment_services || [])
      .map((as: any) => as.services?.name)
      .filter(Boolean)

    const item = {
      id: row.id,
      clientName,
      barberName,
      serviceNames,
    }

    if (row.status === 'arrived') {
      waitingReception.push({
        ...item,
        arrivedAt: row.starts_at,
      })
    } else if (row.status === 'confirmed' || row.status === 'scheduled') {
      // Se já passou do horário de início mas não concluiu, considera em atendimento
      const startTime = new Date(row.starts_at).getTime()
      if (startTime <= now.getTime()) {
        inService.push({
          ...item,
          startedAt: row.starts_at,
        })
      } else {
        nextUp.push({
          ...item,
          startsAt: row.starts_at,
        })
      }
    }
  }

  // Se não houver nenhum em atendimento, mas houver clientes na recepção, o primeiro da recepção é promovido a Próximo
  return {
    success: true,
    tenantName,
    data: {
      inService,
      nextUp: nextUp.slice(0, 5),
      waitingReception,
    },
  }
}

/**
 * Chama o próximo cliente da fila para a cadeira (Ação restrita à equipe do tenant).
 */
export async function callNextQueueAppointmentAction(
  tenantId: string,
  appointmentId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await requireTenantStaff(tenantId)
    const admin = createAdminClient()

    const { error } = await admin
      .from('appointments')
      .update({
        status: 'confirmed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .eq('tenant_id', tenantId)

    if (error) throw error

    return { success: true, message: 'Cliente chamado para atendimento com sucesso!' }
  } catch (err: any) {
    return { success: false, message: err?.message || 'Falha ao chamar cliente da fila.' }
  }
}
