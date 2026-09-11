'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import type { Database } from '@/types/database.types'
import {
  getOrCreateClientTrustScore,
  calculateDynamicReservationPolicy,
  classifyTrustScore,
  type TrustClassification,
  type TrustScoreProfile,
  type DynamicReservationFeePolicy,
} from '@/lib/booking/trust-score'

export type ClientTrustScoreRow = Database['public']['Tables']['client_trust_scores']['Row']

export type ClientActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string; error?: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getAuthenticatedUser() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (!userId) return null

  const profile = await supabase
    .from('profiles')
    .select('id, tenant_id, role')
    .eq('id', userId)
    .maybeSingle()

  return profile.data
}

/**
 * Lista todos os clientes e seus respectivos Trust Scores com suporte a busca e filtros.
 */
export async function listClientsWithTrustScoreAction(
  tenantId: string,
  options?: {
    search?: string
    classification?: TrustClassification | 'all'
    onlyBlacklisted?: boolean
    limit?: number
    offset?: number
  }
): Promise<ClientActionResult<{ clients: ClientTrustScoreRow[]; total: number }>> {
  try {
    if (!UUID_PATTERN.test(tenantId)) {
      return { success: false, message: 'ID de tenant inválido.' }
    }

    const user = await getAuthenticatedUser()
    if (!user || (user.tenant_id !== tenantId && user.role !== 'super_admin')) {
      return { success: false, message: 'Não autorizado a acessar dados deste estabelecimento.' }
    }

    const supabase = createAdminClient()
    let query = supabase
      .from('client_trust_scores')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)

    if (options?.classification && options.classification !== 'all') {
      query = query.eq('classification', options.classification)
    }

    if (options?.onlyBlacklisted) {
      query = query.eq('is_blacklisted', true)
    }

    if (options?.search && options.search.trim()) {
      const cleanSearch = options.search.trim()
      const numericSearch = cleanSearch.replace(/\D/g, '')
      if (numericSearch.length >= 3) {
        query = query.or(`client_name.ilike.%${cleanSearch}%,phone.ilike.%${numericSearch}%`)
      } else {
        query = query.ilike('client_name', `%${cleanSearch}%`)
      }
    }

    query = query
      .order('is_blacklisted', { ascending: false })
      .order('score', { ascending: true })
      .range(options?.offset || 0, (options?.offset || 0) + (options?.limit || 50) - 1)

    const { data, count, error } = await query

    if (error) {
      return { success: false, message: 'Falha ao carregar lista de clientes.', error: error.message }
    }

    return {
      success: true,
      data: {
        clients: data || [],
        total: count || 0,
      },
    }
  } catch (err: any) {
    return { success: false, message: 'Erro inesperado ao listar clientes.', error: err?.message }
  }
}

/**
 * Ativa ou remove o bloqueio de um cliente na Blacklist da barbearia.
 */
export async function toggleClientBlacklistAction(
  tenantId: string,
  trustScoreId: string,
  isBlacklisted: boolean,
  reason?: string
): Promise<ClientActionResult<ClientTrustScoreRow>> {
  try {
    if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(trustScoreId)) {
      return { success: false, message: 'Identificadores inválidos.' }
    }

    const user = await getAuthenticatedUser()
    if (!user || (user.tenant_id !== tenantId && user.role !== 'super_admin')) {
      return { success: false, message: 'Apenas a gerência pode alterar o status da Blacklist.' }
    }

    const supabase = createAdminClient()

    const updatePayload: Database['public']['Tables']['client_trust_scores']['Update'] = {
      is_blacklisted: isBlacklisted,
      blacklist_reason: isBlacklisted ? (reason || 'Bloqueio manual pela recepção/gerência') : null,
      blacklisted_at: isBlacklisted ? new Date().toISOString() : null,
      // Se estiver sendo desbloqueado manualmente, zera a contagem de no-shows consecutivos
      consecutive_no_shows: isBlacklisted ? undefined : 0,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabase
      .from('client_trust_scores')
      .update(updatePayload)
      .eq('id', trustScoreId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error || !data) {
      return { success: false, message: 'Falha ao atualizar status de Blacklist.', error: error?.message }
    }

    return { success: true, data }
  } catch (err: any) {
    return { success: false, message: 'Erro inesperado ao alternar Blacklist.', error: err?.message }
  }
}

/**
 * Define uma porcentagem de taxa de reserva customizada para um cliente específico.
 * Se feePercent for null, reverte para a política dinâmica calculada pelo Score.
 */
export async function setCustomClientReservationFeeAction(
  tenantId: string,
  trustScoreId: string,
  feePercent: number | null
): Promise<ClientActionResult<ClientTrustScoreRow>> {
  try {
    if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(trustScoreId)) {
      return { success: false, message: 'Identificadores inválidos.' }
    }

    if (feePercent !== null && (feePercent < 0 || feePercent > 100)) {
      return { success: false, message: 'A porcentagem de taxa deve estar entre 0% e 100%.' }
    }

    const user = await getAuthenticatedUser()
    if (!user || (user.tenant_id !== tenantId && user.role !== 'super_admin')) {
      return { success: false, message: 'Apenas a gerência pode customizar a taxa do cliente.' }
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('client_trust_scores')
      .update({
        custom_reservation_fee_percent: feePercent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', trustScoreId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (error || !data) {
      return { success: false, message: 'Falha ao definir taxa personalizada.', error: error?.message }
    }

    return { success: true, data }
  } catch (err: any) {
    return { success: false, message: 'Erro inesperado ao atualizar taxa.', error: err?.message }
  }
}

/**
 * Obtém detalhes de pontuação, política dinâmica e histórico de agendamentos de um cliente.
 */
export async function getClientTrustDetailsAction(
  tenantId: string,
  phone: string,
  sampleServicePrice: number = 50,
  defaultReservationFee: number = 15
): Promise<
  ClientActionResult<{
    profile: TrustScoreProfile
    policy: DynamicReservationFeePolicy
    recentAppointments: any[]
  }>
> {
  try {
    if (!UUID_PATTERN.test(tenantId)) {
      return { success: false, message: 'Tenant ID inválido.' }
    }

    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length < 8) {
      return { success: false, message: 'Telefone inválido.' }
    }

    const profile = await getOrCreateClientTrustScore(tenantId, cleanPhone)
    const policy = await calculateDynamicReservationPolicy(
      tenantId,
      cleanPhone,
      defaultReservationFee,
      sampleServicePrice
    )

    const supabase = createAdminClient()
    const { data: recentAppointments } = await supabase
      .from('appointments')
      .select('id, starts_at, status, total_amount, reservation_fee, cancellation_reason, guest_name')
      .eq('tenant_id', tenantId)
      .eq('guest_phone', cleanPhone)
      .order('starts_at', { ascending: false })
      .limit(10)

    return {
      success: true,
      data: {
        profile,
        policy,
        recentAppointments: recentAppointments || [],
      },
    }
  } catch (err: any) {
    return { success: false, message: 'Erro ao buscar detalhes do cliente.', error: err?.message }
  }
}
