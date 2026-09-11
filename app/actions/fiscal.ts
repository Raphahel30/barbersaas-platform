'use server'

import {
  getMonthlyFiscalConsolidation,
  generateCashClosingRPP,
  exportFiscalReportCsv,
  type MonthlyFiscalReport,
  type PartnerRPPDocument,
} from '@/lib/fiscal/salao-parceiro'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

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

export type FiscalActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string }

/**
 * Recupera o relatório contábil consolidado do mês para a barbearia.
 */
export async function getMonthlyFiscalReport(
  tenantId: string,
  month: number,
  year: number,
): Promise<FiscalActionResult<MonthlyFiscalReport>> {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'ID da barbearia inválido.' }
  }

  const user = await getAuthenticatedUser()
  if (!user || user.tenant_id !== tenantId || !['owner', 'super_admin'].includes(user.role)) {
    return { success: false, message: 'Acesso negado aos relatórios fiscais.' }
  }

  try {
    const report = await getMonthlyFiscalConsolidation(tenantId, month, year)
    return { success: true, data: report }
  } catch (error) {
    console.error('Erro ao gerar relatório fiscal:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao processar relatório fiscal.',
    }
  }
}

/**
 * Emite o Recibo de Pagamento a Profissional Parceiro (RPP) formalizado.
 */
export async function generatePartnerRPP(
  cashClosingId: string,
): Promise<FiscalActionResult<PartnerRPPDocument>> {
  if (!UUID_PATTERN.test(cashClosingId)) {
    return { success: false, message: 'ID de fechamento inválido.' }
  }

  const user = await getAuthenticatedUser()
  if (!user) {
    return { success: false, message: 'Usuário não autenticado.' }
  }

  try {
    const rpp = await generateCashClosingRPP(cashClosingId)

    // Barbeiro pode visualizar apenas seu próprio RPP; proprietário visualiza de qualquer barbeiro
    if (user.role === 'barber' && user.id !== rpp.partner.id) {
      return { success: false, message: 'Não autorizado a acessar este recibo.' }
    }

    return { success: true, data: rpp }
  } catch (error) {
    console.error('Erro ao emitir RPP:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao gerar recibo de profissional.',
    }
  }
}

/**
 * Atualiza os dados fiscais e cadastrais do profissional parceiro (CNPJ MEI, Razão Social, Contrato).
 */
export async function updatePartnerFiscalProfile(
  barberId: string,
  data: {
    taxDocument: string
    legalName: string
    contractSignedAt?: string | null
  },
): Promise<FiscalActionResult<{ updated: boolean }>> {
  if (!UUID_PATTERN.test(barberId)) {
    return { success: false, message: 'ID de barbeiro inválido.' }
  }

  const user = await getAuthenticatedUser()
  if (!user || !['owner', 'super_admin'].includes(user.role)) {
    return { success: false, message: 'Apenas proprietários podem gerenciar dados fiscais.' }
  }

  const cleanDoc = data.taxDocument.replace(/\D/g, '')
  if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
    return { success: false, message: 'Documento fiscal deve ser um CPF (11 dígitos) ou CNPJ do MEI (14 dígitos).' }
  }

  const admin = createAdminClient()
  const updateRes = await admin
    .from('profiles')
    .update({
      tax_document: cleanDoc,
      legal_name: data.legalName.trim() || null,
      partner_contract_signed_at: data.contractSignedAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', barberId)
    .eq('tenant_id', user.tenant_id!)

  if (updateRes.error) {
    return { success: false, message: `Erro ao salvar dados fiscais: ${updateRes.error.message}` }
  }

  return { success: true, data: { updated: true } }
}

/**
 * Exporta a planilha contábil em CSV formatado com UTF-8 BOM para o contador.
 */
export async function exportMonthlyFiscalReportCsv(
  tenantId: string,
  month: number,
  year: number,
): Promise<FiscalActionResult<{ csvContent: string; filename: string }>> {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'ID de barbearia inválido.' }
  }

  const user = await getAuthenticatedUser()
  if (!user || user.tenant_id !== tenantId || !['owner', 'super_admin'].includes(user.role)) {
    return { success: false, message: 'Acesso negado à exportação contábil.' }
  }

  try {
    const report = await getMonthlyFiscalConsolidation(tenantId, month, year)
    const csvContent = exportFiscalReportCsv(report)
    const filename = `relatorio-fiscal-salao-parceiro-${year}-${String(month).padStart(2, '0')}.csv`

    return { success: true, data: { csvContent, filename } }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erro ao exportar planilha contábil.',
    }
  }
}

/**
 * Lista todos os fechamentos de caixa da barbearia para emissão de RPPs.
 */
export async function listCashClosingsForRPP(
  tenantId: string,
): Promise<FiscalActionResult<Array<{
  id: string
  barberId: string
  barberName: string
  period: string
  periodStart: string
  periodEnd: string
  grossAmount: number
  commissionAmount: number
  netTransferAmount: number
  closedAt: string | null
}>>> {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'ID de barbearia inválido.' }
  }

  const user = await getAuthenticatedUser()
  if (!user || user.tenant_id !== tenantId) {
    return { success: false, message: 'Acesso negado.' }
  }

  const admin = createAdminClient()
  let query = admin
    .from('cash_closings')
    .select('id, barber_id, period, period_start, period_end, gross_amount, commission_amount, net_transfer_amount, closed_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (user.role === 'barber') {
    query = query.eq('barber_id', user.id)
  }

  const [closingsRes, barbersRes] = await Promise.all([
    query,
    admin.from('profiles').select('id, full_name').eq('tenant_id', tenantId),
  ])

  if (closingsRes.error) {
    return { success: false, message: 'Erro ao buscar fechamentos de caixa.' }
  }

  const barberNameMap = new Map((barbersRes.data ?? []).map((b) => [b.id, b.full_name]))

  const list = (closingsRes.data ?? []).map((c) => ({
    id: c.id,
    barberId: c.barber_id,
    barberName: barberNameMap.get(c.barber_id) ?? 'Profissional',
    period: c.period,
    periodStart: c.period_start,
    periodEnd: c.period_end,
    grossAmount: c.gross_amount ?? 0,
    commissionAmount: c.commission_amount ?? 0,
    netTransferAmount: c.net_transfer_amount ?? 0,
    closedAt: c.closed_at,
  }))

  return { success: true, data: list }
}
