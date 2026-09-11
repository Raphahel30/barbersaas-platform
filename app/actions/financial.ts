'use server'

import { generateCashClosing, type CashClosingResult } from '@/lib/financial/closings'
import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type Period = Database['public']['Enums']['closing_period']

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const cents = (value: number) => Math.round(Number(value || 0) * 100)
const money = (value: number) => Number(value || 0) / 100

export type BarberFinancialSummary = {
  barberId: string
  fullName: string
  avatarUrl: string | null
  pixKey: string
  pixKeyType: string
  commissionPercent: number
  appointmentsCount: number
  servicesGross: number
  productsGross: number
  totalGross: number
  commissionEarned: number
  cashInHand: number
  netTransferAmount: number
  direction: 'owner_pays_barber' | 'barber_pays_owner' | 'settled'
  isClosed: boolean
}

export type FinancialOverviewData = {
  period: Period
  startDate: string
  endDate: string
  totals: {
    servicesGross: number
    productsGross: number
    grossRevenue: number
    commissionsDue: number
    cashInHand: number
    netTransferTotal: number
  }
  barbers: BarberFinancialSummary[]
  recentClosings: Array<{
    id: string
    barberId: string
    barberName: string
    period: Period
    periodStart: string
    periodEnd: string
    grossAmount: number
    commissionAmount: number
    cashInHand: number
    netTransferAmount: number
    closedAt: string
  }>
}

export async function createCashClosing(
  tenantId: string,
  barberId: string,
  period: Period,
  startDate: string,
  endDate: string,
) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (!userId) return { success: false as const, message: 'Autenticação necessária.' }

  const profile = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', userId)
    .single()

  if (profile.error || profile.data.tenant_id !== tenantId) {
    return { success: false as const, message: 'Operação não autorizada.' }
  }
  if (
    profile.data.role !== 'owner' &&
    !(profile.data.role === 'barber' && userId === barberId)
  ) {
    return { success: false as const, message: 'Operação não autorizada.' }
  }

  try {
    const result = await generateCashClosing(tenantId, barberId, period, startDate, endDate)
    return { success: true as const, data: result }
  } catch (error) {
    return {
      success: false as const,
      message: error instanceof Error ? error.message : 'Falha ao gerar fechamento.',
    }
  }
}

export async function closeCashForAllBarbers(
  tenantId: string,
  period: Period,
  startDate: string,
  endDate: string,
) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (!userId) return { success: false as const, message: 'Autenticação necessária.' }

  const profile = await supabase
    .from('profiles')
    .select('tenant_id, role')
    .eq('id', userId)
    .single()

  if (profile.error || profile.data.tenant_id !== tenantId || profile.data.role !== 'owner') {
    return { success: false as const, message: 'Apenas proprietários podem fechar o caixa da equipe.' }
  }

  const admin = createAdminClient()
  const { data: barbers, error } = await admin
    .from('profiles')
    .select('id, full_name')
    .eq('tenant_id', tenantId)
    .eq('role', 'barber')
    .eq('is_active', true)

  if (error || !barbers) {
    return { success: false as const, message: 'Erro ao listar profissionais.' }
  }

  const results: Record<string, CashClosingResult> = {}
  const errors: string[] = []

  for (const barber of barbers) {
    try {
      const res = await generateCashClosing(tenantId, barber.id, period, startDate, endDate)
      results[barber.id] = res
    } catch (err) {
      errors.push(`${barber.full_name}: ${err instanceof Error ? err.message : 'Erro desconhecido'}`)
    }
  }

  return {
    success: errors.length === 0,
    data: results,
    errors: errors.length > 0 ? errors : undefined,
  }
}

export async function getFinancialOverview(
  tenantId: string,
  period: Period,
  startDate: string,
  endDate: string,
): Promise<{ success: boolean; data?: FinancialOverviewData; message?: string }> {
  if (!UUID_PATTERN.test(tenantId) || !DATE_PATTERN.test(startDate) || !DATE_PATTERN.test(endDate)) {
    return { success: false, message: 'Parâmetros inválidos.' }
  }

  const admin = createAdminClient()

  // 1. Carrega barbeiros ativos da barbearia
  const { data: barbers, error: barbersError } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url, phone, email, commission_percent')
    .eq('tenant_id', tenantId)
    .eq('role', 'barber')
    .eq('is_active', true)
    .order('full_name', { ascending: true })

  if (barbersError || !barbers) {
    return { success: false, message: 'Falha ao buscar profissionais da barbearia.' }
  }

  const from = `${startDate}T00:00:00.000Z`
  const toDate = new Date(`${endDate}T00:00:00.000Z`)
  toDate.setUTCDate(toDate.getUTCDate() + 1)
  const to = toDate.toISOString()

  // 2. Busca atendimentos concluídos, vendas de produtos e comissões no período
  const [apptsRes, salesRes, commsRes, closingsRes] = await Promise.all([
    admin
      .from('appointments')
      .select('id, barber_id, total_amount, cash_received_by_barber')
      .eq('tenant_id', tenantId)
      .eq('status', 'completed')
      .gte('completed_at', from)
      .lt('completed_at', to),
    admin
      .from('product_sales')
      .select('id, barber_id, total_amount')
      .eq('tenant_id', tenantId)
      .gte('sold_at', from)
      .lt('sold_at', to),
    admin
      .from('commissions')
      .select('id, barber_id, commission_amount, status')
      .eq('tenant_id', tenantId)
      .gte('created_at', from)
      .lt('created_at', to),
    admin
      .from('cash_closings')
      .select('id, barber_id, period, period_start, period_end, gross_amount, commission_amount, cash_in_hand, net_transfer_amount, closed_at')
      .eq('tenant_id', tenantId)
      .order('closed_at', { ascending: false })
      .limit(20),
  ])

  const appointments = apptsRes.data ?? []
  const sales = salesRes.data ?? []
  const commissions = commsRes.data ?? []
  const recentClosingsRows = closingsRes.data ?? []

  // Mapeia nomes dos barbeiros para o histórico
  const barberMap = new Map(barbers.map((b) => [b.id, b.full_name]))

  let grandServicesCents = 0
  let grandProductsCents = 0
  let grandCommissionsCents = 0
  let grandCashCents = 0

  const barberSummaries: BarberFinancialSummary[] = barbers.map((b) => {
    const bAppts = appointments.filter((a) => a.barber_id === b.id)
    const bSales = sales.filter((s) => s.barber_id === b.id)
    const bComms = commissions.filter((c) => c.barber_id === b.id)

    const servCents = bAppts.reduce((acc, a) => acc + cents(a.total_amount), 0)
    const prodCents = bSales.reduce((acc, s) => acc + cents(s.total_amount), 0)
    const commCents = bComms.reduce((acc, c) => acc + cents(c.commission_amount), 0)
    const cashCents = bAppts.reduce((acc, a) => acc + cents(a.cash_received_by_barber), 0)
    const net = commCents - cashCents

    grandServicesCents += servCents
    grandProductsCents += prodCents
    grandCommissionsCents += commCents
    grandCashCents += cashCents

    const alreadyClosed = recentClosingsRows.some(
      (c) =>
        c.barber_id === b.id &&
        c.period === period &&
        c.period_start === startDate &&
        c.period_end === endDate,
    )

    // Pix key fallback: celular ou email
    const pixKey = b.phone || b.email
    const pixKeyType = b.phone ? 'Telefone' : 'E-mail'

    return {
      barberId: b.id,
      fullName: b.full_name,
      avatarUrl: b.avatar_url,
      pixKey,
      pixKeyType,
      commissionPercent: b.commission_percent,
      appointmentsCount: bAppts.length,
      servicesGross: money(servCents),
      productsGross: money(prodCents),
      totalGross: money(servCents + prodCents),
      commissionEarned: money(commCents),
      cashInHand: money(cashCents),
      netTransferAmount: money(net),
      direction: net > 0 ? 'owner_pays_barber' : net < 0 ? 'barber_pays_owner' : 'settled',
      isClosed: alreadyClosed,
    }
  })

  const netGrand = grandCommissionsCents - grandCashCents

  const recentClosings = recentClosingsRows.map((row) => ({
    id: row.id,
    barberId: row.barber_id,
    barberName: barberMap.get(row.barber_id) || 'Profissional',
    period: row.period,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    grossAmount: Number(row.gross_amount),
    commissionAmount: Number(row.commission_amount),
    cashInHand: Number(row.cash_in_hand),
    netTransferAmount: Number(row.net_transfer_amount),
    closedAt: row.closed_at || '',
  }))

  return {
    success: true,
    data: {
      period,
      startDate,
      endDate,
      totals: {
        servicesGross: money(grandServicesCents),
        productsGross: money(grandProductsCents),
        grossRevenue: money(grandServicesCents + grandProductsCents),
        commissionsDue: money(grandCommissionsCents),
        cashInHand: money(grandCashCents),
        netTransferTotal: money(netGrand),
      },
      barbers: barberSummaries,
      recentClosings,
    },
  }
}
