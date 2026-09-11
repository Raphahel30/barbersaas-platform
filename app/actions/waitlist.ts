'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import {
  type ShiftType,
  expireUnclaimedWaitlistOffers,
  triggerAutoFillForSlot,
} from '@/lib/booking/waitlist'
import type { Database } from '@/types/database.types'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface JoinWaitlistInput {
  tenantId: string
  barberId?: string | null
  requestedDate: string // YYYY-MM-DD
  preferredShift?: ShiftType
  serviceIds: string[]
  guestName?: string | null
  guestPhone?: string | null
}

export interface WaitlistActionResult {
  success: boolean
  message: string
  waitlistId?: string
  claimToken?: string
  expiresAt?: string
}

/**
 * Registra um cliente na lista de espera para um dia ou turno específico.
 */
export async function joinWaitlistAction(
  input: JoinWaitlistInput
): Promise<WaitlistActionResult> {
  if (!UUID_PATTERN.test(input.tenantId)) {
    return { success: false, message: 'Barbearia inválida.' }
  }

  if (input.barberId && !UUID_PATTERN.test(input.barberId)) {
    return { success: false, message: 'Barbeiro selecionado inválido.' }
  }

  if (!input.requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.requestedDate)) {
    return { success: false, message: 'Data informada inválida (formato YYYY-MM-DD).' }
  }

  if (!input.serviceIds || input.serviceIds.length === 0) {
    return { success: false, message: 'Selecione pelo menos um serviço.' }
  }

  // Verifica identidade do usuário autenticado (se houver)
  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = typeof authData?.claims?.sub === 'string' ? authData.claims.sub : null

  let clientName = input.guestName?.trim() || null
  let clientPhone = input.guestPhone?.replace(/\D/g, '') || null

  if (userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', userId)
      .maybeSingle()

    if (profile) {
      clientName = clientName || profile.full_name
      clientPhone = clientPhone || profile.phone
    }
  }

  if (!clientPhone && !userId) {
    return { success: false, message: 'Informe seu telefone de contato para receber o aviso de vaga.' }
  }

  const admin = createAdminClient()

  // Evita duplicatas ativas no mesmo dia para o mesmo telefone/cliente
  let duplicateQuery = admin
    .from('waitlist')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .eq('requested_date', input.requestedDate)
    .in('status', ['waiting', 'notified'])

  if (userId) {
    duplicateQuery = duplicateQuery.eq('client_id', userId)
  } else if (clientPhone) {
    duplicateQuery = duplicateQuery.eq('guest_phone', clientPhone)
  }

  const { data: existing } = await duplicateQuery.maybeSingle()
  if (existing) {
    return {
      success: true,
      message: 'Você já está na lista de espera deste dia! Entraremos em contato assim que abrir uma vaga.',
      waitlistId: existing.id,
    }
  }

  const { data: inserted, error } = await admin
    .from('waitlist')
    .insert({
      tenant_id: input.tenantId,
      client_id: userId,
      guest_name: clientName,
      guest_phone: clientPhone,
      barber_id: input.barberId || null,
      requested_date: input.requestedDate,
      preferred_shift: input.preferredShift || 'any',
      service_ids: input.serviceIds,
      status: 'waiting',
    })
    .select('id')
    .single()

  if (error || !inserted) {
    return { success: false, message: 'Não foi possível cadastrar na lista de espera. Tente novamente.' }
  }

  return {
    success: true,
    message: 'Você entrou na Lista de Espera! Se uma vaga abrir, você receberá um link prioritário com 10 minutos para garantir.',
    waitlistId: inserted.id,
  }
}

/**
 * Reivindica a vaga oferecida pela lista de espera dentro do prazo de 10 minutos.
 */
export async function claimWaitlistSlotAction(claimToken: string): Promise<{
  success: boolean
  message: string
  appointmentId?: string
  waitlistEntry?: any
}> {
  if (!claimToken || typeof claimToken !== 'string') {
    return { success: false, message: 'Token de reivindicação inválido.' }
  }

  const admin = createAdminClient()

  const { data: entry, error } = await admin
    .from('waitlist')
    .select('*')
    .eq('claim_token', claimToken)
    .maybeSingle()

  if (error || !entry) {
    return { success: false, message: 'Vaga não encontrada ou link inválido.' }
  }

  if (entry.status === 'claimed') {
    return { success: false, message: 'Esta vaga já foi garantida e confirmada com sucesso!' }
  }

  if (entry.status === 'expired' || (entry.expires_at && new Date(entry.expires_at) < new Date())) {
    // Se expirou, atualiza para expirado e tenta chamar o próximo
    await admin.from('waitlist').update({ status: 'expired' }).eq('id', entry.id)
    return {
      success: false,
      message: 'O prazo de 10 minutos para reivindicar esta vaga expirou. A oportunidade foi repassada para o próximo da fila.',
    }
  }

  // Marca como reivindicado
  const { error: claimErr } = await admin
    .from('waitlist')
    .update({ status: 'claimed' })
    .eq('id', entry.id)
    .eq('status', 'notified')

  if (claimErr) {
    return { success: false, message: 'Não foi possível concluir a reivindicação da vaga.' }
  }

  return {
    success: true,
    message: 'Vaga reivindicada com sucesso! Prossiga com a confirmação do seu corte.',
    waitlistEntry: entry,
  }
}

/**
 * Consulta a lista de espera da barbearia para o painel de controle do barbeiro ou recepcionista.
 */
export async function getWaitlistForTenantAction(tenantId: string, dateStr?: string) {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'Barbearia inválida.', items: [] }
  }

  const supabase = await createClient()
  const { data: authData } = await supabase.auth.getClaims()
  const userId = typeof authData?.claims?.sub === 'string' ? authData.claims.sub : null

  if (!userId) {
    return { success: false, message: 'Não autorizado.', items: [] }
  }

  const admin = createAdminClient()
  const targetDate = dateStr || new Date().toISOString().slice(0, 10)

  let query = admin
    .from('waitlist')
    .select(`
      id,
      tenant_id,
      client_id,
      guest_name,
      guest_phone,
      barber_id,
      requested_date,
      preferred_shift,
      service_ids,
      status,
      claim_token,
      notified_at,
      expires_at,
      created_at
    `)
    .eq('tenant_id', tenantId)
    .eq('requested_date', targetDate)
    .order('created_at', { ascending: true })

  const { data, error } = await query

  if (error) {
    return { success: false, message: 'Erro ao buscar lista de espera.', items: [] }
  }

  return { success: true, message: 'Lista recuperada.', items: data || [] }
}

/**
 * Permite que a equipe ou cliente remova/cancele sua entrada na lista de espera.
 */
export async function cancelWaitlistEntryAction(waitlistId: string): Promise<WaitlistActionResult> {
  if (!UUID_PATTERN.test(waitlistId)) {
    return { success: false, message: 'Identificador inválido.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('waitlist')
    .delete()
    .eq('id', waitlistId)

  if (error) {
    return { success: false, message: 'Não foi possível remover da lista de espera.' }
  }

  return { success: true, message: 'Removido da lista de espera com sucesso.' }
}
