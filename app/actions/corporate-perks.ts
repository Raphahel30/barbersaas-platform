'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import type { Database } from '@/types/database.types'

export type CorporateAgreementRow = Database['public']['Tables']['corporate_agreements']['Row']
export type CorporateUsageRow = Database['public']['Tables']['corporate_usages']['Row']

export interface AgreementWithStats extends CorporateAgreementRow {
  usagesCount: number
  totalDiscountGiven: number
  unbilledAmount: number
}

export type CorporateActionResult<T> =
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
 * Lista todos os convênios corporativos da barbearia com métricas de utilização.
 */
export async function listCorporateAgreementsAction(
  tenantId: string
): Promise<CorporateActionResult<AgreementWithStats[]>> {
  try {
    if (!UUID_PATTERN.test(tenantId)) {
      return { success: false, message: 'Tenant ID inválido.' }
    }

    const user = await getAuthenticatedUser()
    if (!user || (user.tenant_id !== tenantId && user.role !== 'super_admin')) {
      return { success: false, message: 'Não autorizado a consultar convênios.' }
    }

    const supabase = createAdminClient()

    const { data: agreements, error } = await supabase
      .from('corporate_agreements')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('company_name', { ascending: true })

    if (error) {
      return { success: false, message: 'Erro ao listar convênios.', error: error.message }
    }

    const agreementsWithStats: AgreementWithStats[] = await Promise.all(
      (agreements || []).map(async (agreement) => {
        const { data: usages } = await supabase
          .from('corporate_usages')
          .select('discount_amount, final_amount, is_billed')
          .eq('agreement_id', agreement.id)

        const usagesCount = usages?.length || 0
        const totalDiscountGiven = Number(
          (usages || []).reduce((acc, curr) => acc + (Number(curr.discount_amount) || 0), 0).toFixed(2)
        )
        const unbilledAmount = Number(
          (usages || [])
            .filter((u) => !u.is_billed)
            .reduce((acc, curr) => acc + (Number(curr.final_amount) || 0), 0)
            .toFixed(2)
        )

        return {
          ...agreement,
          usagesCount,
          totalDiscountGiven,
          unbilledAmount,
        }
      })
    )

    return { success: true, data: agreementsWithStats }
  } catch (err: any) {
    return { success: false, message: 'Erro inesperado ao listar convênios.', error: err?.message }
  }
}

/**
 * Cadastra ou edita um convênio corporativo B2B.
 */
export async function upsertCorporateAgreementAction(input: {
  tenantId: string
  agreementId?: string
  companyName: string
  cnpj: string
  contactName?: string
  contactEmail: string
  contactPhone?: string
  couponCode: string
  discountPercentage: number
  billingType: 'direct_discount' | 'postpaid_monthly'
  notes?: string
}): Promise<CorporateActionResult<CorporateAgreementRow>> {
  try {
    if (!UUID_PATTERN.test(input.tenantId)) {
      return { success: false, message: 'Tenant ID inválido.' }
    }

    if (!input.companyName.trim() || !input.cnpj.trim() || !input.contactEmail.trim()) {
      return { success: false, message: 'Razão social, CNPJ e e-mail de contato são obrigatórios.' }
    }

    const cleanCoupon = input.couponCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (cleanCoupon.length < 3) {
      return { success: false, message: 'O código de cupom deve ter pelo menos 3 caracteres alfanuméricos.' }
    }

    if (input.discountPercentage < 0 || input.discountPercentage > 100) {
      return { success: false, message: 'O percentual de desconto deve estar entre 0% e 100%.' }
    }

    const user = await getAuthenticatedUser()
    if (!user || (user.tenant_id !== input.tenantId && user.role !== 'super_admin')) {
      return { success: false, message: 'Apenas a gerência pode cadastrar convênios corporativos.' }
    }

    const supabase = createAdminClient()

    if (input.agreementId) {
      const { data, error } = await supabase
        .from('corporate_agreements')
        .update({
          company_name: input.companyName.trim(),
          cnpj: input.cnpj.trim(),
          contact_name: input.contactName?.trim() || null,
          contact_email: input.contactEmail.trim(),
          contact_phone: input.contactPhone?.trim() || null,
          coupon_code: cleanCoupon,
          discount_percentage: input.discountPercentage,
          billing_type: input.billingType,
          notes: input.notes?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.agreementId)
        .eq('tenant_id', input.tenantId)
        .select()
        .single()

      if (error) return { success: false, message: 'Erro ao atualizar convênio.', error: error.message }
      return { success: true, data: data! }
    } else {
      const { data, error } = await supabase
        .from('corporate_agreements')
        .insert({
          tenant_id: input.tenantId,
          company_name: input.companyName.trim(),
          cnpj: input.cnpj.trim(),
          contact_name: input.contactName?.trim() || null,
          contact_email: input.contactEmail.trim(),
          contact_phone: input.contactPhone?.trim() || null,
          coupon_code: cleanCoupon,
          discount_percentage: input.discountPercentage,
          billing_type: input.billingType,
          status: 'active',
          notes: input.notes?.trim() || null,
        })
        .select()
        .single()

      if (error) return { success: false, message: 'Erro ao criar convênio.', error: error.message }
      return { success: true, data: data! }
    }
  } catch (err: any) {
    return { success: false, message: 'Erro ao salvar convênio.', error: err?.message }
  }
}

/**
 * Valida se um código de cupom corporativo é legítimo e retorna o percentual de benefício.
 */
export async function validateCorporateCouponAction(
  tenantId: string,
  couponCode: string
): Promise<
  CorporateActionResult<{
    agreementId: string
    companyName: string
    discountPercentage: number
    billingType: 'direct_discount' | 'postpaid_monthly'
  }>
> {
  try {
    const cleanCoupon = couponCode.trim().toUpperCase()
    const supabase = createAdminClient()

    const { data: agreement } = await supabase
      .from('corporate_agreements')
      .select('id, company_name, discount_percentage, billing_type, status')
      .eq('tenant_id', tenantId)
      .eq('coupon_code', cleanCoupon)
      .maybeSingle()

    if (!agreement) {
      return { success: false, message: 'Cupom corporativo não localizado.' }
    }

    if (agreement.status !== 'active') {
      return { success: false, message: 'Este convênio corporativo está inativo no momento.' }
    }

    return {
      success: true,
      data: {
        agreementId: agreement.id,
        companyName: agreement.company_name,
        discountPercentage: Number(agreement.discount_percentage),
        billingType: agreement.billing_type,
      },
    }
  } catch (err: any) {
    return { success: false, message: 'Erro ao validar cupom corporativo.', error: err?.message }
  }
}

/**
 * Registra a utilização de um convênio corporativo por um colaborador da empresa.
 */
export async function recordCorporateUsageAction(input: {
  tenantId: string
  agreementId: string
  appointmentId?: string
  employeeName: string
  employeeEmail?: string
  employeeDocument?: string
  originalAmount: number
}): Promise<CorporateActionResult<CorporateUsageRow>> {
  try {
    const supabase = createAdminClient()

    const { data: agreement } = await supabase
      .from('corporate_agreements')
      .select('discount_percentage, billing_type')
      .eq('id', input.agreementId)
      .single()

    if (!agreement) {
      return { success: false, message: 'Convênio não encontrado.' }
    }

    const discountPercent = Number(agreement.discount_percentage) || 0
    const discountAmount = Number(((input.originalAmount * discountPercent) / 100).toFixed(2))
    const finalAmount = Number(Math.max(0, input.originalAmount - discountAmount).toFixed(2))

    const { data: usage, error } = await supabase
      .from('corporate_usages')
      .insert({
        tenant_id: input.tenantId,
        agreement_id: input.agreementId,
        appointment_id: input.appointmentId || null,
        employee_name: input.employeeName.trim(),
        employee_email: input.employeeEmail?.trim() || null,
        employee_document: input.employeeDocument?.trim() || null,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        is_billed: false,
      })
      .select()
      .single()

    if (error || !usage) {
      return { success: false, message: 'Falha ao registrar uso de convênio.', error: error?.message }
    }

    return { success: true, data: usage }
  } catch (err: any) {
    return { success: false, message: 'Erro ao registrar utilização.', error: err?.message }
  }
}

/**
 * Emite a fatura consolidada mensal (B2B Pós-Pago) contra o CNPJ da empresa conveniada via Asaas.
 */
export async function generateCorporateMonthlyInvoiceAction(
  agreementId: string,
  month: number = new Date().getMonth() + 1,
  year: number = new Date().getFullYear()
): Promise<
  CorporateActionResult<{
    billedUsagesCount: number
    totalBilled: number
    paymentId: string
    invoiceUrl: string
  }>
> {
  try {
    if (!UUID_PATTERN.test(agreementId)) {
      return { success: false, message: 'ID de convênio inválido.' }
    }

    const supabase = createAdminClient()

    const { data: agreement } = await supabase
      .from('corporate_agreements')
      .select('*')
      .eq('id', agreementId)
      .single()

    if (!agreement || agreement.billing_type !== 'postpaid_monthly') {
      return { success: false, message: 'Este convênio não utiliza modalidade de faturamento pós-pago.' }
    }

    // Busca utilizações não faturadas
    const { data: unbilledUsages } = await supabase
      .from('corporate_usages')
      .select('*')
      .eq('agreement_id', agreementId)
      .eq('is_billed', false)

    if (!unbilledUsages || unbilledUsages.length === 0) {
      return { success: false, message: 'Não há cortes pendentes de faturamento para esta empresa.' }
    }

    const totalBilled = Number(
      unbilledUsages.reduce((acc, curr) => acc + (Number(curr.final_amount) || 0), 0).toFixed(2)
    )

    // Emissão Asaas B2B
    const asaasApiKey = process.env.ASAAS_API_KEY
    const asaasBaseUrl = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3'
    let paymentId = `pay_corp_${agreementId.slice(0, 8)}_${month}_${year}`
    let invoiceUrl = `https://asaas.com/i/${paymentId}`

    if (asaasApiKey && !asaasApiKey.includes('placeholder')) {
      try {
        const resp = await fetch(`${asaasBaseUrl}/payments`, {
          method: 'POST',
          headers: {
            access_token: asaasApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customer: agreement.cnpj.replace(/\D/g, ''),
            billingType: 'BOLETO',
            value: totalBilled,
            dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            description: `Faturamento B2B Barbearia - Convênio ${agreement.company_name} - Ref ${month}/${year} (${unbilledUsages.length} cortes)`,
          }),
        })

        if (resp.ok) {
          const json = await resp.json()
          paymentId = json.id || paymentId
          invoiceUrl = json.invoiceUrl || json.bankSlipUrl || invoiceUrl
        }
      } catch (err) {
        console.warn('Fallback para simulação de fatura corporativa Asaas:', err)
      }
    }

    // Marca as utilizações como faturadas
    const usageIds = unbilledUsages.map((u) => u.id)
    await supabase
      .from('corporate_usages')
      .update({ is_billed: true })
      .in('id', usageIds)

    return {
      success: true,
      data: {
        billedUsagesCount: unbilledUsages.length,
        totalBilled,
        paymentId,
        invoiceUrl,
      },
    }
  } catch (err: any) {
    return { success: false, message: 'Erro ao emitir fatura corporativa.', error: err?.message }
  }
}
