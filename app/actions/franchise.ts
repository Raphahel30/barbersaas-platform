'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import type { Database } from '@/types/database.types'
import {
  getFranchiseNetworkPerformance,
  processMonthlyFranchiseSettlements,
  generateAsaasFranchiseInvoice,
  type NetworkDashboardData,
  type FranchiseContractRow,
  type FranchiseSettlementRow,
} from '@/lib/franchise/royalties'

export type FranchiseActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string; error?: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

async function getAuthenticatedUserOrganization(): Promise<{
  userId: string
  organizationId: string
  tenantId: string | null
  role: string
} | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  if (!userId) return null

  const profile = await supabase
    .from('profiles')
    .select('id, tenant_id, role')
    .eq('id', userId)
    .maybeSingle()

  if (!profile.data) return null

  const tenantId = profile.data.tenant_id
  if (!tenantId) return null

  const { data: tenant } = await supabase
    .from('tenants')
    .select('organization_id')
    .eq('id', tenantId)
    .single()

  if (!tenant) return null

  return {
    userId: profile.data.id,
    organizationId: tenant.organization_id,
    tenantId,
    role: profile.data.role,
  }
}

/**
 * Retorna todos os dados consolidados do painel do Franqueador:
 * métricas de rede, ranking de filiais e status de apurações mensais.
 */
export async function getFranchiseDashboardAction(
  month: number = new Date().getMonth() + 1,
  year: number = new Date().getFullYear()
): Promise<
  FranchiseActionResult<{
    dashboard: NetworkDashboardData
    contracts: FranchiseContractRow[]
    branches: Array<{ id: string; name: string }>
  }>
> {
  try {
    const auth = await getAuthenticatedUserOrganization()
    if (!auth || !['owner', 'super_admin'].includes(auth.role)) {
      return { success: false, message: 'Acesso restrito ao painel da franqueadora.' }
    }

    const supabase = createAdminClient()

    const [dashboard, contractsRes, branchesRes] = await Promise.all([
      getFranchiseNetworkPerformance(auth.organizationId, month, year),
      supabase
        .from('franchise_contracts')
        .select('*')
        .eq('organization_id', auth.organizationId)
        .order('created_at', { ascending: false }),
      supabase
        .from('tenants')
        .select('id, name')
        .eq('organization_id', auth.organizationId)
        .order('name', { ascending: true }),
    ])

    return {
      success: true,
      data: {
        dashboard,
        contracts: contractsRes.data || [],
        branches: branchesRes.data || [],
      },
    }
  } catch (err: any) {
    return { success: false, message: 'Erro ao carregar dados da franquia.', error: err?.message }
  }
}

/**
 * Dispara o fechamento contábil e apuração de Royalties & FPP do mês para todas as unidades.
 */
export async function runFranchiseSettlementAction(
  month: number,
  year: number
): Promise<FranchiseActionResult<FranchiseSettlementRow[]>> {
  try {
    const auth = await getAuthenticatedUserOrganization()
    if (!auth || !['owner', 'super_admin'].includes(auth.role)) {
      return { success: false, message: 'Não autorizado a rodar apuração de franquias.' }
    }

    const settlements = await processMonthlyFranchiseSettlements(auth.organizationId, month, year)

    return { success: true, data: settlements }
  } catch (err: any) {
    return { success: false, message: 'Erro ao processar fechamento de franquia.', error: err?.message }
  }
}

/**
 * Gera a cobrança Asaas (Pix/Boleto) contra a filial franqueada para o fechamento selecionado.
 */
export async function issueFranchiseInvoiceAction(
  settlementId: string
): Promise<FranchiseActionResult<{ paymentId: string; invoiceUrl: string }>> {
  try {
    if (!UUID_PATTERN.test(settlementId)) {
      return { success: false, message: 'ID de apuração inválido.' }
    }

    const auth = await getAuthenticatedUserOrganization()
    if (!auth || !['owner', 'super_admin'].includes(auth.role)) {
      return { success: false, message: 'Apenas a franqueadora pode emitir faturas de royalties.' }
    }

    const result = await generateAsaasFranchiseInvoice(settlementId)

    return { success: true, data: result }
  } catch (err: any) {
    return { success: false, message: 'Falha ao emitir fatura Asaas.', error: err?.message }
  }
}

/**
 * Salva ou atualiza os termos do contrato de franquia de uma filial específica.
 */
export async function upsertFranchiseContractAction(
  tenantId: string,
  royaltiesPercentage: number,
  marketingFundPercentage: number,
  fixedMonthlyFee: number,
  dueDay: number
): Promise<FranchiseActionResult<FranchiseContractRow>> {
  try {
    if (!UUID_PATTERN.test(tenantId)) {
      return { success: false, message: 'Tenant ID inválido.' }
    }

    const auth = await getAuthenticatedUserOrganization()
    if (!auth || !['owner', 'super_admin'].includes(auth.role)) {
      return { success: false, message: 'Apenas a franqueadora pode alterar contratos.' }
    }

    const supabase = createAdminClient()

    const { data: existing } = await supabase
      .from('franchise_contracts')
      .select('id')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    let saved: FranchiseContractRow | null = null

    if (existing) {
      const { data, error } = await supabase
        .from('franchise_contracts')
        .update({
          royalties_percentage: royaltiesPercentage,
          marketing_fund_percentage: marketingFundPercentage,
          fixed_monthly_fee: fixedMonthlyFee,
          due_day: dueDay,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single()

      if (error) return { success: false, message: 'Erro ao atualizar contrato.', error: error.message }
      saved = data
    } else {
      const { data, error } = await supabase
        .from('franchise_contracts')
        .insert({
          organization_id: auth.organizationId,
          tenant_id: tenantId,
          royalties_percentage: royaltiesPercentage,
          marketing_fund_percentage: marketingFundPercentage,
          fixed_monthly_fee: fixedMonthlyFee,
          due_day: dueDay,
          is_active: true,
        })
        .select()
        .single()

      if (error) return { success: false, message: 'Erro ao criar contrato.', error: error.message }
      saved = data
    }

    return { success: true, data: saved! }
  } catch (err: any) {
    return { success: false, message: 'Erro ao salvar contrato de franquia.', error: err?.message }
  }
}
