'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'

export interface CommissionTier {
  id: string
  name: string
  minCuts: number
  maxCuts: number | null
  commissionPercent: number
  badge: string
}

export interface BarberGoalProgress {
  barberId: string
  barberName: string
  currentMonthName: string
  completedCuts: number
  currentGrossRevenue: number
  currentCommissionPercent: number
  currentCommissionEarned: number
  currentTier: CommissionTier
  nextTier: CommissionTier | null
  cutsRemainingForNextTier: number
  progressPercentToNextTier: number
  projectedExtraEarningsNextTier: number
  allTiers: CommissionTier[]
}

const DEFAULT_TIERS: CommissionTier[] = [
  {
    id: 'tier-bronze',
    name: 'Faixa Base',
    minCuts: 0,
    maxCuts: 70,
    commissionPercent: 50,
    badge: '🥉 Bronze',
  },
  {
    id: 'tier-silver',
    name: 'Faixa Performance',
    minCuts: 71,
    maxCuts: 120,
    commissionPercent: 55,
    badge: '🥈 Prata',
  },
  {
    id: 'tier-gold',
    name: 'Faixa Master',
    minCuts: 121,
    maxCuts: null,
    commissionPercent: 60,
    badge: '🥇 Ouro VIP',
  },
]

export async function getBarberGoalProgressAction(
  explicitBarberId?: string,
  explicitTenantId?: string,
): Promise<{ success: boolean; data?: BarberGoalProgress; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let barberId = explicitBarberId
    let tenantId = explicitTenantId

    if (!barberId && user) {
      barberId = user.id
    }

    if (!tenantId && barberId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, full_name')
        .eq('id', barberId)
        .maybeSingle()

      tenantId = profile?.tenant_id || undefined
    }

    const admin = createAdminClient()

    // Fallback para primeiro barbeiro e tenant se não autenticado (ambiente demo/preview)
    if (!barberId || !tenantId) {
      const { data: firstBarber } = await admin
        .from('profiles')
        .select('id, tenant_id, full_name')
        .eq('role', 'barber')
        .limit(1)
        .single()

      if (firstBarber) {
        barberId = firstBarber.id
        tenantId = firstBarber.tenant_id || undefined
      }
    }

    if (!barberId || !tenantId) {
      return { success: false, error: 'Barbeiro ou tenant não identificados.' }
    }

    // 1. Busca perfil do barbeiro
    const { data: barberProfile, error: barberError } = await admin
      .from('profiles')
      .select('id, full_name, commission_percent')
      .eq('id', barberId)
      .single()

    if (barberError || !barberProfile) {
      return { success: false, error: 'Perfil do profissional não encontrado.' }
    }

    // 2. Define o primeiro e último dia do mês atual
    const now = new Date()
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59)).toISOString()

    const monthNames = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ]
    const currentMonthName = monthNames[now.getMonth()]

    // 3. Busca agendamentos concluídos do barbeiro neste mês
    const { data: appointments, error: aptError } = await admin
      .from('appointments')
      .select('id, total_amount, status, starts_at')
      .eq('barber_id', barberId)
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('starts_at', startOfMonth)
      .lte('starts_at', endOfMonth)

    const completedCuts = appointments?.length || 0
    const currentGrossRevenue = appointments?.reduce((acc, a) => acc + Number(a.total_amount || 0), 0) || 0

    // 4. Configuração de Faixas de Comissão
    const tiers = DEFAULT_TIERS

    // 5. Determina a faixa atual conquistada
    let currentTier = tiers[0]
    for (const t of tiers) {
      if (completedCuts >= t.minCuts) {
        if (t.maxCuts === null || completedCuts <= t.maxCuts) {
          currentTier = t
        } else if (completedCuts > t.maxCuts) {
          currentTier = t
        }
      }
    }

    // 6. Determina a próxima faixa
    const currentIndex = tiers.findIndex((t) => t.id === currentTier.id)
    const nextTier = currentIndex < tiers.length - 1 ? tiers[currentIndex + 1] : null

    let cutsRemaining = 0
    let progressPercent = 100
    let projectedExtra = 0

    if (nextTier) {
      cutsRemaining = Math.max(0, nextTier.minCuts - completedCuts)
      const tierRange = nextTier.minCuts - currentTier.minCuts
      const cutsInCurrentTier = completedCuts - currentTier.minCuts
      progressPercent = Math.min(100, Math.max(0, Math.round((cutsInCurrentTier / tierRange) * 100)))

      // Cálculo de ganho extra projetado (diferença de percentual sobre o faturamento médio)
      const avgPricePerCut = completedCuts > 0 ? currentGrossRevenue / completedCuts : 60
      const extraPercent = nextTier.commissionPercent - currentTier.commissionPercent
      projectedExtra = Number(((currentGrossRevenue * extraPercent) / 100).toFixed(2))
    }

    const currentCommissionPercent = currentTier.commissionPercent
    const currentCommissionEarned = Number(((currentGrossRevenue * currentCommissionPercent) / 100).toFixed(2))

    return {
      success: true,
      data: {
        barberId,
        barberName: barberProfile.full_name,
        currentMonthName,
        completedCuts,
        currentGrossRevenue,
        currentCommissionPercent,
        currentCommissionEarned,
        currentTier,
        nextTier,
        cutsRemainingForNextTier: cutsRemaining,
        progressPercentToNextTier: progressPercent,
        projectedExtraEarningsNextTier: projectedExtra,
        allTiers: tiers,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao apurar metas de comissão.',
    }
  }
}
