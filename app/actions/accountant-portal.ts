'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { generateAccountantMonthlyPackage } from '@/lib/fiscal/export-package'
import { randomUUID } from 'crypto'

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

export type AccountantAccessDetails = {
  id: string
  tokenUuid: string
  tenantId: string
  tenantName: string
  accountantName: string
  hasPin: boolean
  expiresAt: string | null
  isActive: boolean
  url: string
}

/**
 * Cria um novo Magic Link para o escritório de contabilidade
 */
export async function createAccountantAccessAction(input: {
  accountantName: string
  securityPin?: string
  expiresInDays?: number
}): Promise<{ success: boolean; data?: AccountantAccessDetails; error?: string }> {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Não autorizado ou tenant não identificado.' }
    }

    const supabase = createAdminClient()
    const token = randomUUID()

    const expiresAt = input.expiresInDays
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null

    const pin = input.securityPin?.trim() ? input.securityPin.trim() : null

    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', user.tenant_id)
      .single()

    const { data, error } = await supabase
      .from('tenant_accountant_access')
      .insert({
        tenant_id: user.tenant_id,
        token,
        name: input.accountantName,
        pin_code: pin,
        expires_at: expiresAt,
        is_active: true,
      })
      .select()
      .single()

    if (error || !data) {
      return { success: false, error: error?.message || 'Erro ao gerar acesso contábil' }
    }

    return {
      success: true,
      data: {
        id: data.id,
        tokenUuid: data.token,
        tenantId: data.tenant_id,
        tenantName: tenant?.name || 'Barbearia',
        accountantName: data.name,
        hasPin: !!data.pin_code,
        expiresAt: data.expires_at,
        isActive: data.is_active,
        url: `/contador/${data.token}`,
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado' }
  }
}

/**
 * Lista todos os links de contador configurados para o tenant
 */
export async function listAccountantAccessAction(): Promise<{
  success: boolean
  data?: AccountantAccessDetails[]
  error?: string
}> {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Não autorizado.' }
    }

    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('tenant_accountant_access')
      .select(`
        id,
        token,
        tenant_id,
        name,
        pin_code,
        expires_at,
        is_active,
        created_at,
        tenant:tenants(name)
      `)
      .eq('tenant_id', user.tenant_id)
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      data: (data || []).map((d: any) => ({
        id: d.id,
        tokenUuid: d.token,
        tenantId: d.tenant_id,
        tenantName: d.tenant?.name || 'Barbearia',
        accountantName: d.name,
        hasPin: !!d.pin_code,
        expiresAt: d.expires_at,
        isActive: d.is_active,
        url: `/contador/${d.token}`,
      })),
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado' }
  }
}

/**
 * Revoga ou reativa um Magic Link de contador
 */
export async function toggleAccountantAccessAction(
  accessId: string,
  active: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getAuthenticatedUser()
    if (!user || !user.tenant_id) {
      return { success: false, error: 'Não autorizado.' }
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('tenant_accountant_access')
      .update({ is_active: active })
      .eq('id', accessId)
      .eq('tenant_id', user.tenant_id)

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado' }
  }
}

/**
 * Validação pública do Token pelo Contador (Sem necessidade de login)
 */
export async function verifyAccountantPublicAccessAction(token: string): Promise<{
  success: boolean
  data?: {
    tenantName: string
    tenantDocument: string
    accountantName: string
    hasPin: boolean
    isExpired: boolean
  }
  error?: string
}> {
  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('tenant_accountant_access')
      .select(`
        id,
        tenant_id,
        name,
        pin_code,
        expires_at,
        is_active,
        tenant:tenants(name)
      `)
      .eq('token', token)
      .single()

    if (error || !data) {
      return { success: false, error: 'Link contábil inválido ou não encontrado.' }
    }

    if (!data.is_active) {
      return { success: false, error: 'Este link de acesso contábil foi revogado pelo proprietário da barbearia.' }
    }

    const isExpired = data.expires_at ? new Date(data.expires_at) < new Date() : false
    if (isExpired) {
      return { success: false, error: 'Este link de acesso contábil expirou. Solicite um novo link à barbearia.' }
    }

    const tenantInfo = data.tenant as any

    return {
      success: true,
      data: {
        tenantName: tenantInfo?.name || 'Barbearia',
        tenantDocument: '',
        accountantName: data.name,
        hasPin: !!data.pin_code,
        isExpired: false,
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Erro inesperado' }
  }
}

/**
 * Download em 1 clique do Pacote Fiscal Mensal (.ZIP) e dados de resumo
 */
export async function downloadAccountantMonthlyPackageAction(input: {
  tokenUuid: string
  pin?: string
  month: number
  year: number
}): Promise<{
  success: boolean
  data?: {
    zipBase64: string
    filename: string
    reportSummary: {
      periodLabel: string
      grossRevenue: number
      totalPartnerQuota: number
      taxableSalonBase: number
      partnersCount: number
    }
  }
  error?: string
}> {
  try {
    const supabase = createAdminClient()

    const { data: access, error } = await supabase
      .from('tenant_accountant_access')
      .select('id, tenant_id, pin_code, expires_at, is_active')
      .eq('token', input.tokenUuid)
      .single()

    if (error || !access || !access.is_active) {
      return { success: false, error: 'Acesso contábil não autorizado ou revogado.' }
    }

    if (access.expires_at && new Date(access.expires_at) < new Date()) {
      return { success: false, error: 'Acesso contábil expirado.' }
    }

    if (access.pin_code) {
      if (!input.pin || input.pin.trim() !== access.pin_code.trim()) {
        return { success: false, error: 'PIN de segurança incorreto.' }
      }
    }

    // Gerar pacote ZIP
    const { zipBuffer, filename, report } = await generateAccountantMonthlyPackage(
      access.tenant_id,
      input.month,
      input.year
    )

    return {
      success: true,
      data: {
        zipBase64: zipBuffer.toString('base64'),
        filename,
        reportSummary: {
          periodLabel: report.periodLabel,
          grossRevenue: report.grossRevenue,
          totalPartnerQuota: report.totalPartnerQuota,
          taxableSalonBase: report.taxableSalonBase,
          partnersCount: report.partnersSummary.length,
        },
      },
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Falha ao compilar pacote contábil' }
  }
}
