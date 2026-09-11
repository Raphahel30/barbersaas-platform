'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (!userId) return null

  const profile = await supabase
    .from('profiles')
    .select('id, tenant_id, role, full_name')
    .eq('id', userId)
    .maybeSingle()

  return profile.data
}

export type TimeOffReason = 'folga_semanal' | 'ferias' | 'atestado' | 'outros'

export type BarberTimeOffItem = {
  id: string
  barberId: string
  barberName: string
  startDate: string
  endDate: string
  reason: TimeOffReason
  approvedBy: string | null
  notes: string | null
  createdAt: string
}

export type AffectedAppointmentItem = {
  id: string
  appointmentDate: string
  startTime: string
  clientName: string
  clientPhone: string
  serviceName: string
  totalPrice: number
}

/**
 * Lista todos os barbeiros ativos da barbearia a partir da tabela profiles
 */
export async function listBarbersForScheduleAction(): Promise<{
  success: boolean
  data?: Array<{ id: string; name: string; avatarUrl: string | null; role: string }>
  error?: string
}> {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Não autorizado ou tenant não identificado.' }
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .eq('tenant_id', user.tenant_id)
      .eq('role', 'barber')
      .order('full_name', { ascending: true })

    if (error) return { success: false, error: error.message }
    return {
      success: true,
      data: (data || []).map((b) => ({
        id: b.id,
        name: b.full_name,
        avatarUrl: b.avatar_url,
        role: b.role,
      })),
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado' }
  }
}

/**
 * Lista folgas e afastamentos dos barbeiros
 */
export async function listBarberTimeOffAction(input?: {
  barberId?: string
  startDate?: string
  endDate?: string
}): Promise<{ success: boolean; data?: BarberTimeOffItem[]; error?: string }> {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Não autorizado.' }
    }

    const supabase = createAdminClient()
    let query = supabase
      .from('barber_time_off')
      .select('*')
      .eq('tenant_id', user.tenant_id)
      .order('start_date', { ascending: true })

    if (input?.barberId) {
      query = query.eq('barber_id', input.barberId)
    }
    if (input?.startDate) {
      query = query.gte('end_date', input.startDate)
    }
    if (input?.endDate) {
      query = query.lte('start_date', input.endDate)
    }

    const { data, error } = await query
    if (error) return { success: false, error: error.message }

    // Buscar nomes dos barbeiros
    const barberIds = Array.from(new Set((data || []).map((d) => d.barber_id)))
    let nameMap = new Map<string, string>()
    if (barberIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', barberIds)

      nameMap = new Map((profiles || []).map((p) => [p.id, p.full_name]))
    }

    return {
      success: true,
      data: (data || []).map((item) => ({
        id: item.id,
        barberId: item.barber_id,
        barberName: nameMap.get(item.barber_id) || 'Barbeiro',
        startDate: item.start_date,
        endDate: item.end_date,
        reason: item.reason as TimeOffReason,
        approvedBy: item.approved_by,
        notes: item.notes,
        createdAt: item.created_at,
      })),
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado' }
  }
}

/**
 * Checa se existem agendamentos existentes no período de folga solicitado
 */
export async function checkAffectedAppointmentsAction(
  barberId: string,
  startDate: string,
  endDate: string
): Promise<{ success: boolean; data?: AffectedAppointmentItem[]; error?: string }> {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Não autorizado.' }
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('tenant_id', user.tenant_id)
      .eq('barber_id', barberId)
      .in('status', ['scheduled', 'confirmed'])
      .gte('starts_at', `${startDate}T00:00:00`)
      .lte('starts_at', `${endDate}T23:59:59`)
      .order('starts_at', { ascending: true })

    if (error) return { success: false, error: error.message }

    return {
      success: true,
      data: (data || []).map((a) => ({
        id: a.id,
        appointmentDate: a.starts_at ? a.starts_at.substring(0, 10) : '',
        startTime: a.starts_at ? a.starts_at.substring(11, 16) : '',
        clientName: a.guest_name || 'Cliente',
        clientPhone: a.guest_phone || '',
        serviceName: 'Atendimento Barbearia',
        totalPrice: Number(a.total_amount || 0),
      })),
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao buscar agendamentos afetados' }
  }
}

/**
 * Cadastra uma folga ou período de afastamento para o profissional
 */
export async function createBarberTimeOffAction(input: {
  barberId: string
  startDate: string
  endDate: string
  reason: TimeOffReason
  notes?: string
}): Promise<{
  success: boolean
  data?: {
    timeOff: BarberTimeOffItem
    affectedAppointments: AffectedAppointmentItem[]
  }
  error?: string
}> {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Não autorizado.' }
    }

    const supabase = createAdminClient()

    // 1. Cadastrar em barber_time_off
    const { data: created, error } = await supabase
      .from('barber_time_off')
      .insert({
        tenant_id: user.tenant_id,
        barber_id: input.barberId,
        start_date: input.startDate,
        end_date: input.endDate,
        reason: input.reason,
        approved_by: user.full_name || 'Dono da Barbearia',
        notes: input.notes || null,
      })
      .select()
      .single()

    if (error || !created) {
      return { success: false, error: error?.message || 'Erro ao registrar folga.' }
    }

    // 2. Buscar nome do barbeiro
    const { data: barberProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', input.barberId)
      .single()

    // 3. Verificar agendamentos afetados
    const affectedCheck = await checkAffectedAppointmentsAction(input.barberId, input.startDate, input.endDate)
    const affected = affectedCheck.data || []

    return {
      success: true,
      data: {
        timeOff: {
          id: created.id,
          barberId: created.barber_id,
          barberName: barberProfile?.full_name || 'Barbeiro',
          startDate: created.start_date,
          endDate: created.end_date,
          reason: created.reason as TimeOffReason,
          approvedBy: created.approved_by,
          notes: created.notes,
          createdAt: created.created_at,
        },
        affectedAppointments: affected,
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado' }
  }
}

/**
 * Remaneja um agendamento afetado para outro barbeiro parceiro
 */
export async function reassignAppointmentAction(
  appointmentId: string,
  newBarberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Não autorizado.' }
    }

    const supabase = createAdminClient()

    const { data: newBarber } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', newBarberId)
      .single()

    const { error } = await supabase
      .from('appointments')
      .update({
        barber_id: newBarberId,
        notes: `Remanejado de barbeiro por escala para ${newBarber?.full_name || 'Novo Barbeiro'} em ${new Date().toLocaleDateString('pt-BR')}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .eq('tenant_id', user.tenant_id)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao remanejar agendamento' }
  }
}

/**
 * Cancela um agendamento afetado por folga/atestado com notificação
 */
export async function cancelAffectedAppointmentAction(
  appointmentId: string,
  reason = 'Cancelado devido a afastamento/folga do profissional'
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Não autorizado.' }
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('appointments')
      .update({
        status: 'cancelled',
        notes: `${reason} (${new Date().toLocaleDateString('pt-BR')})`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appointmentId)
      .eq('tenant_id', user.tenant_id)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao cancelar agendamento' }
  }
}

/**
 * Remove um registro de folga/afastamento
 */
export async function deleteBarberTimeOffAction(timeOffId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Não autorizado.' }
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('barber_time_off')
      .delete()
      .eq('id', timeOffId)
      .eq('tenant_id', user.tenant_id)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao remover folga' }
  }
}

/**
 * Gera escala de revezamento de fins de semana (sábados) entre os barbeiros
 */
export async function generateWeekendRotationAction(input: {
  barberIds: string[]
  startDate: string
  weeksCount: number
}): Promise<{ success: boolean; data?: { generatedCount: number }; error?: string }> {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Não autorizado.' }
    }

    if (!input.barberIds || input.barberIds.length < 2) {
      return { success: false, error: 'Selecione pelo menos 2 barbeiros para criar o revezamento.' }
    }

    const supabase = createAdminClient()
    const start = new Date(input.startDate)
    const recordsToInsert: any[] = []

    let currentBarberIndex = 0

    for (let w = 0; w < input.weeksCount; w++) {
      const targetDate = new Date(start)
      targetDate.setDate(targetDate.getDate() + w * 7)

      // Ajustar para o próximo sábado caso a data não seja sábado (6)
      const dayOfWeek = targetDate.getDay()
      const diffToSaturday = (6 - dayOfWeek + 7) % 7
      targetDate.setDate(targetDate.getDate() + diffToSaturday)

      const dateStr = targetDate.toISOString().substring(0, 10)
      const offBarberId = input.barberIds[currentBarberIndex % input.barberIds.length]

      recordsToInsert.push({
        tenant_id: user.tenant_id,
        barber_id: offBarberId,
        start_date: dateStr,
        end_date: dateStr,
        reason: 'folga_semanal',
        approved_by: user.full_name || 'Dono (Escala Automática)',
        notes: `Revezamento de Sábado (Semana ${w + 1})`,
      })

      currentBarberIndex++
    }

    const { data, error } = await supabase
      .from('barber_time_off')
      .insert(recordsToInsert)
      .select()

    if (error) return { success: false, error: error.message }

    return {
      success: true,
      data: { generatedCount: data?.length || recordsToInsert.length },
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro ao gerar revezamento' }
  }
}
