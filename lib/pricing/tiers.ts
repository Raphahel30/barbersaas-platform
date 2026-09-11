import 'server-only'

import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

export type SeniorityTier = 'junior' | 'pleno' | 'senior' | 'master'

export type ServiceTierPricingRow = Database['public']['Tables']['service_tier_pricing']['Row']

export interface ResolvedServicePricing {
  serviceId: string
  serviceName: string
  barberId: string
  barberName: string
  tier: SeniorityTier
  tierLabel: string
  price: number
  durationMinutes: number
  isCustomTier: boolean
  basePrice: number
  baseDurationMinutes: number
}

export interface BarberServiceOption {
  barberId: string
  barberName: string
  avatarUrl: string | null
  tier: SeniorityTier
  tierLabel: string
  price: number
  durationMinutes: number
  isCustomTier: boolean
  badge: {
    label: string
    color: string
  }
}

/**
 * Retorna o rótulo humanizado do nível de senioridade.
 */
export function getTierLabel(tier: SeniorityTier): string {
  switch (tier) {
    case 'junior':
      return 'Barbeiro Júnior'
    case 'pleno':
      return 'Barbeiro Pleno'
    case 'senior':
      return 'Barbeiro Sênior'
    case 'master':
      return 'Barbeiro Master'
    default:
      return 'Barbeiro'
  }
}

/**
 * Retorna configurações de badge visual para cada nível técnico.
 */
export function getTierBadge(tier: SeniorityTier): { label: string; color: string } {
  switch (tier) {
    case 'junior':
      return { label: 'Júnior', color: 'emerald' }
    case 'pleno':
      return { label: 'Pleno', color: 'blue' }
    case 'senior':
      return { label: 'Sênior', color: 'amber' }
    case 'master':
      return { label: 'Master', color: 'purple' }
    default:
      return { label: 'Pleno', color: 'blue' }
  }
}

/**
 * Resolve o preço e duração de um serviço para um nível de senioridade específico,
 * utilizando sobretaxa de service_tier_pricing ou fallback para os valores base.
 */
export function resolveTierPriceAndDuration(
  basePrice: number,
  baseDurationMinutes: number,
  tier: SeniorityTier,
  tierOverrides?: Array<{ tier: string; custom_price: number; custom_duration_minutes: number }>
): {
  price: number
  durationMinutes: number
  isCustomTier: boolean
  tierLabel: string
} {
  const match = tierOverrides?.find((override) => override.tier === tier)

  if (match) {
    return {
      price: Number(match.custom_price),
      durationMinutes: match.custom_duration_minutes,
      isCustomTier: true,
      tierLabel: getTierLabel(tier),
    }
  }

  return {
    price: basePrice,
    durationMinutes: baseDurationMinutes,
    isCustomTier: false,
    tierLabel: getTierLabel(tier),
  }
}

/**
 * Busca o preço e a duração de um serviço específico para um profissional no banco de dados.
 */
export async function getServicePriceForBarber(
  tenantId: string,
  serviceId: string,
  barberId: string
): Promise<ResolvedServicePricing> {
  const supabase = createAdminClient()

  const [serviceRes, barberRes, overrideRes] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, price, duration_minutes')
      .eq('id', serviceId)
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('profiles')
      .select('id, full_name, seniority_tier')
      .eq('id', barberId)
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('service_tier_pricing')
      .select('*')
      .eq('service_id', serviceId)
      .eq('tenant_id', tenantId),
  ])

  if (!serviceRes.data) throw new Error('Serviço não encontrado.')
  if (!barberRes.data) throw new Error('Profissional não encontrado.')

  const service = serviceRes.data
  const barber = barberRes.data
  const tier: SeniorityTier = (barber.seniority_tier as SeniorityTier) || 'pleno'

  const resolved = resolveTierPriceAndDuration(
    service.price,
    service.duration_minutes,
    tier,
    overrideRes.data || []
  )

  return {
    serviceId: service.id,
    serviceName: service.name,
    barberId: barber.id,
    barberName: barber.full_name,
    tier,
    tierLabel: resolved.tierLabel,
    price: resolved.price,
    durationMinutes: resolved.durationMinutes,
    isCustomTier: resolved.isCustomTier,
    basePrice: service.price,
    baseDurationMinutes: service.duration_minutes,
  }
}

/**
 * Retorna o catálogo completo de serviços adaptado em tempo real com os preços
 * e durações correspondentes à senioridade do barbeiro selecionado.
 */
export async function getServicesCatalogForBarber(
  tenantId: string,
  barberId: string
): Promise<
  Array<{
    id: string
    name: string
    description: string | null
    price: number
    durationMinutes: number
    basePrice: number
    baseDurationMinutes: number
    isCustomTier: boolean
    tier: SeniorityTier
    tierLabel: string
  }>
> {
  const supabase = createAdminClient()

  const [barberRes, servicesRes, overridesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, seniority_tier')
      .eq('id', barberId)
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('services')
      .select('id, name, description, price, duration_minutes')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .order('price', { ascending: true }),
    supabase.from('service_tier_pricing').select('*').eq('tenant_id', tenantId),
  ])

  if (!barberRes.data) throw new Error('Barbeiro não encontrado.')
  const tier: SeniorityTier = (barberRes.data.seniority_tier as SeniorityTier) || 'pleno'
  const overrides = overridesRes.data || []

  return (servicesRes.data || []).map((service) => {
    const serviceOverrides = overrides.filter((o) => o.service_id === service.id)
    const resolved = resolveTierPriceAndDuration(
      service.price,
      service.duration_minutes,
      tier,
      serviceOverrides
    )

    return {
      id: service.id,
      name: service.name,
      description: service.description,
      price: resolved.price,
      durationMinutes: resolved.durationMinutes,
      basePrice: service.price,
      baseDurationMinutes: service.duration_minutes,
      isCustomTier: resolved.isCustomTier,
      tier,
      tierLabel: resolved.tierLabel,
    }
  })
}

/**
 * Retorna a lista de barbeiros com os preços e tempos calculados especificamente para o serviço selecionado.
 */
export async function getBarberOptionsForService(
  tenantId: string,
  serviceId: string
): Promise<BarberServiceOption[]> {
  const supabase = createAdminClient()

  const [serviceRes, barbersRes, overridesRes] = await Promise.all([
    supabase
      .from('services')
      .select('id, price, duration_minutes')
      .eq('id', serviceId)
      .eq('tenant_id', tenantId)
      .single(),
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, seniority_tier')
      .eq('tenant_id', tenantId)
      .in('role', ['barber', 'owner'])
      .eq('is_active', true),
    supabase
      .from('service_tier_pricing')
      .select('*')
      .eq('service_id', serviceId)
      .eq('tenant_id', tenantId),
  ])

  if (!serviceRes.data) throw new Error('Serviço não localizado.')
  const service = serviceRes.data
  const overrides = overridesRes.data || []

  return (barbersRes.data || []).map((barber) => {
    const tier: SeniorityTier = (barber.seniority_tier as SeniorityTier) || 'pleno'
    const resolved = resolveTierPriceAndDuration(
      service.price,
      service.duration_minutes,
      tier,
      overrides
    )

    return {
      barberId: barber.id,
      barberName: barber.full_name,
      avatarUrl: barber.avatar_url,
      tier,
      tierLabel: resolved.tierLabel,
      price: resolved.price,
      durationMinutes: resolved.durationMinutes,
      isCustomTier: resolved.isCustomTier,
      badge: getTierBadge(tier),
    }
  })
}
