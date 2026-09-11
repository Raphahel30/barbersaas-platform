'use server'

import { requireSuperAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/utils/supabase/admin'
import { getMasterAuditLogs, type AuditLogItem } from '@/lib/logs/audit'

export interface MasterAnalyticsData {
  financial: {
    mrr: number
    gmvTotal: number
    gmvThisMonth: number
    averageTicket: number
  }
  tenantsDistribution: {
    total: number
    active: number
    trial: number
    pastDue: number
    suspended: number
    cancelled: number
  }
  operations: {
    totalAppointmentsMonth: number
    completedMonth: number
    noShowCountMonth: number
    noShowRatePercent: number
    totalActiveBarbers: number
    totalClients: number
  }
  planDistribution: Array<{
    planName: string
    monthlyPrice: number
    tenantsCount: number
    totalMrr: number
  }>
  recentAuditLogs: AuditLogItem[]
}

export async function getMasterAnalytics(): Promise<MasterAnalyticsData> {
  await requireSuperAdmin()

  const admin = createAdminClient()
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()

  const [
    tenantsRes,
    plansRes,
    apptsCompletedRes,
    apptsMonthRes,
    counterSalesRes,
    barbersRes,
    clientsRes,
    auditLogs,
  ] = await Promise.all([
    admin
      .from('tenants')
      .select('id, name, slug, status, plan_id, created_at, plans(id, name, monthly_price)'),
    admin
      .from('plans')
      .select('id, name, monthly_price'),
    admin
      .from('appointments')
      .select('total_amount, status, created_at')
      .eq('status', 'completed'),
    admin
      .from('appointments')
      .select('id, status, total_amount, starts_at')
      .gte('starts_at', startOfMonth),
    admin
      .from('counter_sales')
      .select('total_amount, sold_at'),
    admin
      .from('profiles')
      .select('id')
      .eq('role', 'barber')
      .eq('is_active', true),
    admin
      .from('profiles')
      .select('id')
      .eq('role', 'client'),
    getMasterAuditLogs(20),
  ])

  const tenants = tenantsRes.data ?? []
  const plans = plansRes.data ?? []
  const completedAppts = apptsCompletedRes.data ?? []
  const monthAppts = apptsMonthRes.data ?? []
  const counterSales = counterSalesRes.data ?? []
  const barbersCount = barbersRes.data?.length ?? 0
  const clientsCount = clientsRes.data?.length ?? 0

  // 1. Cálculo do MRR (Receita Mensal Recorrente)
  let mrr = 0
  const tenantsDistribution = {
    total: tenants.length,
    active: 0,
    trial: 0,
    pastDue: 0,
    suspended: 0,
    cancelled: 0,
  }

  const planMap: Record<string, { planName: string; monthlyPrice: number; count: number }> = {}
  for (const p of plans) {
    planMap[p.id] = {
      planName: p.name,
      monthlyPrice: Number(p.monthly_price),
      count: 0,
    }
  }

  for (const t of tenants) {
    if (t.status === 'active') tenantsDistribution.active++
    else if (t.status === 'trial') tenantsDistribution.trial++
    else if (t.status === 'past_due') tenantsDistribution.pastDue++
    else if (t.status === 'suspended') tenantsDistribution.suspended++
    else if (t.status === 'cancelled') tenantsDistribution.cancelled++

    // Assinaturas ativas ou em tolerância geram expectativa de MRR
    if ((t.status === 'active' || t.status === 'past_due') && t.plan_id && planMap[t.plan_id]) {
      const plan = planMap[t.plan_id]
      mrr += plan.monthlyPrice
      plan.count++
    }
  }

  const planDistribution = Object.values(planMap).map((p) => ({
    planName: p.planName,
    monthlyPrice: p.monthlyPrice,
    tenantsCount: p.count,
    totalMrr: p.count * p.monthlyPrice,
  }))

  // 2. Cálculo do GMV Global (Volume transacionado pelas barbearias)
  const gmvApptsAll = completedAppts.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0)
  const gmvCounterSalesAll = counterSales.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0)
  const gmvTotal = gmvApptsAll + gmvCounterSalesAll

  const gmvThisMonthAppts = monthAppts
    .filter((a) => a.status === 'completed')
    .reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0)
  const gmvThisMonthSales = counterSales
    .filter((s) => s.sold_at >= startOfMonth)
    .reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0)
  const gmvThisMonth = gmvThisMonthAppts + gmvThisMonthSales

  const averageTicket = completedAppts.length > 0
    ? Math.round((gmvApptsAll / completedAppts.length) * 100) / 100
    : 0

  // 3. Indicadores Operacionais
  const totalAppointmentsMonth = monthAppts.length
  const completedMonth = monthAppts.filter((a) => a.status === 'completed').length
  const noShowCountMonth = monthAppts.filter((a) => a.status === 'no_show').length

  const evaluatedAppts = completedMonth + noShowCountMonth
  const noShowRatePercent = evaluatedAppts > 0
    ? Math.round((noShowCountMonth / evaluatedAppts) * 1000) / 10
    : 0

  return {
    financial: {
      mrr: Math.round(mrr * 100) / 100,
      gmvTotal: Math.round(gmvTotal * 100) / 100,
      gmvThisMonth: Math.round(gmvThisMonth * 100) / 100,
      averageTicket,
    },
    tenantsDistribution,
    operations: {
      totalAppointmentsMonth,
      completedMonth,
      noShowCountMonth,
      noShowRatePercent,
      totalActiveBarbers: barbersCount,
      totalClients: clientsCount,
    },
    planDistribution,
    recentAuditLogs: auditLogs,
  }
}
