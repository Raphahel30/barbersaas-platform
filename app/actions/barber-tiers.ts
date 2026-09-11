'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import type { Database } from '@/types/database.types'
import {
  type SeniorityTier,
  getTierLabel,
  getTierBadge,
  getServicesCatalogForBarber,
  getBarberOptionsForService,
} from '@/lib/pricing/tiers'

export type ServiceTierPricingRow = Database['public']['Tables']['service_tier_pricing']['Row']

export type BarberTierActionResult<T> =
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
 * Atualiza o nível de senioridade de um barbeiro (junior, pleno, senior, master).
 */
export async function updateBarberSeniorityTierAction(
  tenantId: string,
  barberId: string,
  tier: SeniorityTier
): Promise<BarberTierActionResult<{ id: string; full_name: string; seniority_tier: SeniorityTier }>> {
  try {
    if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(barberId)) {
      return { success: false, message: 'Identificadores inválidos.' }
    }

    const validTiers: SeniorityTier[] = ['junior', 'pleno', 'senior', 'master']
    if (!validTiers.includes(tier)) {
      return { success: false, message: 'Nível de senioridade inválido.' }
    }

    const user = await getAuthenticatedUser()
    if (!user || (user.tenant_id !== tenantId && user.role !== 'super_admin')) {
      return { success: false, message: 'Apenas a gerência pode alterar o nível dos profissionais.' }
    }

    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('profiles')
      .update({
        seniority_tier: tier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', barberId)
      .eq('tenant_id', tenantId)
      .select('id, full_name, seniority_tier')
      .single()

    if (error || !data) {
      return { success: false, message: 'Falha ao atualizar nível do profissional.', error: error?.message }
    }

    return {
      success: true,
      data: {
        id: data.id,
        full_name: data.full_name,
        seniority_tier: data.seniority_tier as SeniorityTier,
      },
    }
  } catch (err: any) {
    return { success: false, message: 'Erro inesperado ao atualizar nível.', error: err?.message }
  }
}

/**
 * Cria ou atualiza a sobretaxa/duração específica de um serviço para uma determinada categoria de profissional.
 */
export async function upsertServiceTierPricingAction(
  tenantId: string,
  serviceId: string,
  tier: SeniorityTier,
  customPrice: number,
  customDurationMinutes: number
): Promise<BarberTierActionResult<ServiceTierPricingRow>> {
  try {
    if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(serviceId)) {
      return { success: false, message: 'Identificadores inválidos.' }
    }

    if (customPrice < 0) {
      return { success: false, message: 'O valor do serviço não pode ser negativo.' }
    }

    if (customDurationMinutes < 5) {
      return { success: false, message: 'A duração mínima deve ser de pelo menos 5 minutos.' }
    }

    const user = await getAuthenticatedUser()
    if (!user || (user.tenant_id !== tenantId && user.role !== 'super_admin')) {
      return { success: false, message: 'Não autorizado a gerenciar precificação de serviços.' }
    }

    const supabase = createAdminClient()

    // Verifica se já existe regra para este service_id e tier
    const { data: existing } = await supabase
      .from('service_tier_pricing')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('service_id', serviceId)
      .eq('tier', tier)
      .maybeSingle()

    let resultData: ServiceTierPricingRow | null = null

    if (existing) {
      const { data, error } = await supabase
        .from('service_tier_pricing')
        .update({
          custom_price: customPrice,
          custom_duration_minutes: customDurationMinutes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) return { success: false, message: 'Falha ao atualizar preço por nível.', error: error.message }
      resultData = data
    } else {
      const { data, error } = await supabase
        .from('service_tier_pricing')
        .insert({
          tenant_id: tenantId,
          service_id: serviceId,
          tier,
          custom_price: customPrice,
          custom_duration_minutes: customDurationMinutes,
        })
        .select()
        .single()

      if (error) return { success: false, message: 'Falha ao cadastrar preço por nível.', error: error.message }
      resultData = data
    }

    return { success: true, data: resultData! }
  } catch (err: any) {
    return { success: false, message: 'Erro ao salvar precificação de nível.', error: err?.message }
  }
}

/**
 * Remove a sobretaxa de nível de um serviço, fazendo com que ele herde o valor padrão da barbearia.
 */
export async function deleteServiceTierPricingAction(
  tenantId: string,
  serviceTierPricingId: string
): Promise<BarberTierActionResult<{ id: string }>> {
  try {
    if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(serviceTierPricingId)) {
      return { success: false, message: 'Identificadores inválidos.' }
    }

    const user = await getAuthenticatedUser()
    if (!user || (user.tenant_id !== tenantId && user.role !== 'super_admin')) {
      return { success: false, message: 'Não autorizado a remover regras de precificação.' }
    }

    const supabase = createAdminClient()

    const { error } = await supabase
      .from('service_tier_pricing')
      .delete()
      .eq('id', serviceTierPricingId)
      .eq('tenant_id', tenantId)

    if (error) {
      return { success: false, message: 'Erro ao excluir regra de precificação.', error: error.message }
    }

    return { success: true, data: { id: serviceTierPricingId } }
  } catch (err: any) {
    return { success: false, message: 'Erro inesperado ao excluir regra.', error: err?.message }
  }
}

/**
 * Lista todas as regras de precificação por categoria (opcionalmente filtrando por um serviço específico).
 */
export async function listServiceTierPricingAction(
  tenantId: string,
  serviceId?: string
): Promise<BarberTierActionResult<ServiceTierPricingRow[]>> {
  try {
    if (!UUID_PATTERN.test(tenantId)) {
      return { success: false, message: 'Tenant ID inválido.' }
    }

    const supabase = createAdminClient()
    let query = supabase
      .from('service_tier_pricing')
      .select('*')
      .eq('tenant_id', tenantId)

    if (serviceId) {
      query = query.eq('service_id', serviceId)
    }

    const { data, error } = await query.order('created_at', { ascending: false })

    if (error) {
      return { success: false, message: 'Erro ao consultar regras de preço por nível.', error: error.message }
    }

    return { success: true, data: data || [] }
  } catch (err: any) {
    return { success: false, message: 'Erro inesperado ao consultar regras.', error: err?.message }
  }
}

/**
 * Lista todos os barbeiros da barbearia com seus níveis de senioridade formatados.
 */
export async function listBarbersWithTiersAction(
  tenantId: string
): Promise<
  BarberTierActionResult<
    Array<{
      id: string
      fullName: string
      email: string
      phone: string | null
      avatarUrl: string | null
      seniorityTier: SeniorityTier
      tierLabel: string
      badge: { label: string; color: string }
    }>
  >
> {
  try {
    if (!UUID_PATTERN.test(tenantId)) {
      return { success: false, message: 'Tenant ID inválido.' }
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, avatar_url, seniority_tier')
      .eq('tenant_id', tenantId)
      .in('role', ['barber', 'owner'])
      .eq('is_active', true)
      .order('full_name', { ascending: true })

    if (error) {
      return { success: false, message: 'Erro ao buscar equipe de barbeiros.', error: error.message }
    }

    const barbers = (data || []).map((b) => {
      const tier: SeniorityTier = (b.seniority_tier as SeniorityTier) || 'pleno'
      return {
        id: b.id,
        fullName: b.full_name,
        email: b.email,
        phone: b.phone,
        avatarUrl: b.avatar_url,
        seniorityTier: tier,
        tierLabel: getTierLabel(tier),
        badge: getTierBadge(tier),
      }
    })

    return { success: true, data: barbers }
  } catch (err: any) {
    return { success: false, message: 'Erro inesperado ao carregar barbeiros.', error: err?.message }
  }
}
