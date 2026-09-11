import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'

export interface BranchSummary {
  tenantId: string
  name: string
  slug: string
  status: string
  city: string
  grossRevenue: number
  appointmentsCount: number
  averageTicket: number
  occupancyRate: number
  commissionExpense: number
  activeBarbersCount: number
}

export interface RoamingBarber {
  barberId: string
  name: string
  email: string
  phone: string | null
  branches: Array<{
    tenantId: string
    tenantName: string
    scheduledDays: number[]
  }>
}

export interface ConsolidatedNetworkResult {
  isMultiBranch: boolean
  organizationName: string
  branchesCount: number
  totalGrossRevenue: number
  totalAppointmentsCount: number
  networkAverageTicket: number
  networkOccupancyRate: number
  totalCommissionExpense: number
  topPerformingBranch: string
  branches: BranchSummary[]
  roamingBarbers: RoamingBarber[]
}

/**
 * Obtém métricas financeiras e operacionais consolidadas de todas as filiais de uma rede.
 */
export async function getConsolidatedNetworkMetrics(
  organizationId: string,
  periodDays: number = 30,
): Promise<ConsolidatedNetworkResult> {
  const admin = createAdminClient()
  const sinceDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString()

  // 1. Busca dados da organização
  const { data: org, error: orgError } = await admin
    .from('organizations')
    .select('id, name, is_multi_branch')
    .eq('id', organizationId)
    .single()

  if (orgError || !org) {
    throw new Error('Organização não encontrada.')
  }

  // 2. Busca todos os tenants associados a esta organização
  const { data: tenants, error: tenantsError } = await admin
    .from('tenants')
    .select('id, name, slug, status, address')
    .eq('organization_id', organizationId)

  if (tenantsError || !tenants || tenants.length === 0) {
    return {
      isMultiBranch: org.is_multi_branch,
      organizationName: org.name,
      branchesCount: 0,
      totalGrossRevenue: 0,
      totalAppointmentsCount: 0,
      networkAverageTicket: 0,
      networkOccupancyRate: 0,
      totalCommissionExpense: 0,
      topPerformingBranch: 'Nenhuma',
      branches: [],
      roamingBarbers: [],
    }
  }

  const tenantIds = tenants.map((t) => t.id)

  // 3. Busca agendamentos concluídos de todos os tenants no período
  const { data: appointments } = await admin
    .from('appointments')
    .select('id, tenant_id, total_amount, status, starts_at')
    .in('tenant_id', tenantIds)
    .eq('status', 'completed')
    .gte('starts_at', sinceDate)

  // 4. Busca comissões apuradas no período
  const { data: commissions } = await admin
    .from('commissions')
    .select('tenant_id, commission_amount')
    .in('tenant_id', tenantIds)
    .gte('created_at', sinceDate)

  // 5. Busca profissionais ativos por tenant
  const { data: barbers } = await admin
    .from('profiles')
    .select('id, tenant_id, full_name, email, phone, role, is_active')
    .in('tenant_id', tenantIds)
    .eq('role', 'barber')
    .eq('is_active', true)

  // 6. Agrega métricas por filial
  const branchSummaries: BranchSummary[] = tenants.map((tenant) => {
    const branchApts = appointments?.filter((a) => a.tenant_id === tenant.id) || []
    const branchComms = commissions?.filter((c) => c.tenant_id === tenant.id) || []
    const branchBarbers = barbers?.filter((b) => b.tenant_id === tenant.id) || []

    const grossRevenue = branchApts.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0)
    const appointmentsCount = branchApts.length
    const averageTicket = appointmentsCount > 0 ? Number((grossRevenue / appointmentsCount).toFixed(2)) : 0
    const commissionExpense = branchComms.reduce((acc, curr) => acc + Number(curr.commission_amount || 0), 0)
    
    // Taxa de ocupação estimada (baseada em capacidade de 8 slots/dia por barbeiro)
    const capacitySlots = Math.max(1, branchBarbers.length * 8 * periodDays)
    const occupancyRate = Number(Math.min(100, (appointmentsCount / capacitySlots) * 100).toFixed(1))

    const addr = tenant.address as { city?: string } | null
    const city = addr?.city || 'Brasil'

    return {
      tenantId: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      city,
      grossRevenue,
      appointmentsCount,
      averageTicket,
      occupancyRate,
      commissionExpense,
      activeBarbersCount: branchBarbers.length,
    }
  })

  // 7. Busca schedules para identificar barbeiros móveis/volantes
  const { data: schedules } = await admin
    .from('barber_schedules')
    .select('tenant_id, barber_id, weekday')
    .in('tenant_id', tenantIds)
    .eq('is_active', true)

  const barberTenantMap = new Map<string, Set<string>>()
  const barberWeekdayMap = new Map<string, Map<string, number[]>>()

  schedules?.forEach((s) => {
    if (!barberTenantMap.has(s.barber_id)) {
      barberTenantMap.set(s.barber_id, new Set())
      barberWeekdayMap.set(s.barber_id, new Map())
    }
    barberTenantMap.get(s.barber_id)!.add(s.tenant_id)
    
    const weekMap = barberWeekdayMap.get(s.barber_id)!
    if (!weekMap.has(s.tenant_id)) {
      weekMap.set(s.tenant_id, [])
    }
    weekMap.get(s.tenant_id)!.push(s.weekday)
  })

  const roamingBarbers: RoamingBarber[] = []
  for (const [barberId, tenantSet] of barberTenantMap.entries()) {
    if (tenantSet.size > 1) {
      const barberProfile = barbers?.find((b) => b.id === barberId)
      if (barberProfile) {
        const branchesInfo = Array.from(tenantSet).map((tId) => {
          const tName = tenants.find((t) => t.id === tId)?.name || 'Filial'
          const days = barberWeekdayMap.get(barberId)?.get(tId) || []
          return {
            tenantId: tId,
            tenantName: tName,
            scheduledDays: days,
          }
        })

        roamingBarbers.push({
          barberId,
          name: barberProfile.full_name,
          email: barberProfile.email,
          phone: barberProfile.phone,
          branches: branchesInfo,
        })
      }
    }
  }

  // 8. Totais da rede
  const totalGrossRevenue = branchSummaries.reduce((acc, b) => acc + b.grossRevenue, 0)
  const totalAppointmentsCount = branchSummaries.reduce((acc, b) => acc + b.appointmentsCount, 0)
  const networkAverageTicket =
    totalAppointmentsCount > 0
      ? Number((totalGrossRevenue / totalAppointmentsCount).toFixed(2))
      : 0
  const avgOccupancy =
    branchSummaries.length > 0
      ? Number(
          (
            branchSummaries.reduce((acc, b) => acc + b.occupancyRate, 0) /
            branchSummaries.length
          ).toFixed(1),
        )
      : 0
  const totalCommissionExpense = branchSummaries.reduce((acc, b) => acc + b.commissionExpense, 0)

  const sortedByRevenue = [...branchSummaries].sort((a, b) => b.grossRevenue - a.grossRevenue)
  const topPerformingBranch = sortedByRevenue[0]?.name || 'Nenhuma'

  return {
    isMultiBranch: org.is_multi_branch,
    organizationName: org.name,
    branchesCount: tenants.length,
    totalGrossRevenue,
    totalAppointmentsCount,
    networkAverageTicket,
    networkOccupancyRate: avgOccupancy,
    totalCommissionExpense,
    topPerformingBranch,
    branches: branchSummaries,
    roamingBarbers,
  }
}
