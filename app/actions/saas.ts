'use server'

import { requireSuperAdmin } from '@/lib/auth/guards'
import { defaultLandingContent, type LandingContent } from '@/lib/saas/landing'
import type { Database, Json } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

export type { LandingContent }

/**
 * Obtém o conteúdo da Landing Page do SaaS com fallback robusto.
 */
export async function getLandingContent(): Promise<LandingContent> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('system_settings')
    .select('landing_content')
    .eq('id', true)
    .maybeSingle()

  if (!data?.landing_content || typeof data.landing_content !== 'object' || Array.isArray(data.landing_content)) {
    return defaultLandingContent
  }

  const saved = data.landing_content as Partial<LandingContent>

  return {
    hero: { ...defaultLandingContent.hero, ...saved.hero },
    socialProof: { ...defaultLandingContent.socialProof, ...saved.socialProof },
    modules: { ...defaultLandingContent.modules, ...saved.modules },
    testimonials: { ...defaultLandingContent.testimonials, ...saved.testimonials },
    faq: { ...defaultLandingContent.faq, ...saved.faq },
  }
}

/**
 * Salva as alterações da Landing Page no Painel Master (exclusivo para o Super Admin).
 */
export async function updateLandingContent(content: LandingContent): Promise<{ success: boolean; message: string }> {
  await requireSuperAdmin()

  const admin = createAdminClient()
  const { error } = await admin
    .from('system_settings')
    .update({
      landing_content: content as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', true)

  if (error) {
    return { success: false, message: 'Não foi possível salvar as configurações da Landing Page.' }
  }

  return { success: true, message: 'Landing Page atualizada com sucesso!' }
}

/**
 * Obtém as métricas consolidadas do CRM Master para rafaelcassu@gmail.com.
 */
export async function getMasterCrmStats() {
  await requireSuperAdmin()

  const admin = createAdminClient()

  const [tenantsResult, organizationsResult, clientsResult, plansResult] = await Promise.all([
    admin
      .from('tenants')
      .select('id, name, slug, status, custom_domain, past_due_since, created_at, organization_id, plans(name, monthly_price)'),
    admin.from('organizations').select('id, is_multi_branch'),
    admin.from('profiles').select('id').eq('role', 'client'),
    admin.from('plans').select('id, name, monthly_price, max_barbers, is_active').order('monthly_price', { ascending: true }),
  ])

  const tenants = tenantsResult.data ?? []
  const organizations = organizationsResult.data ?? []
  const clientsCount = clientsResult.data?.length ?? 0
  const plans = plansResult.data ?? []

  const totalTenants = tenants.length
  const activeTenants = tenants.filter((t) => t.status === 'active').length
  const trialTenants = tenants.filter((t) => t.status === 'trial').length
  const pastDueTenants = tenants.filter((t) => t.status === 'past_due').length
  const suspendedTenants = tenants.filter((t) => t.status === 'suspended').length
  const multiBranchCount = organizations.filter((o) => o.is_multi_branch).length

  return {
    metrics: {
      totalTenants,
      activeTenants,
      trialTenants,
      pastDueTenants,
      suspendedTenants,
      multiBranchCount,
      totalClients: clientsCount,
    },
    tenants,
    plans,
  }
}

/**
 * Obtém os planos ativos cadastrados para a tabela de preços e formulário de onboarding.
 */
export async function getPublicPlans() {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('plans')
    .select('id, name, max_barbers, monthly_price, is_active')
    .eq('is_active', true)
    .order('monthly_price', { ascending: true })

  if (error || !data || data.length === 0) {
    // Planos de contingência caso a tabela ainda não tenha sido populada
    return [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Barbeiro Solo', max_barbers: 1, monthly_price: 49.9, is_active: true },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Barbearia Prime', max_barbers: 5, monthly_price: 99.9, is_active: true },
      { id: '33333333-3333-4333-8333-333333333333', name: 'Rede / Multi-Filiais', max_barbers: 20, monthly_price: 199.9, is_active: true },
    ]
  }

  return data
}
