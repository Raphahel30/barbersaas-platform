'use server'

import { requireOwner } from '@/lib/auth/guards'
import { defaultVisualSettings, type TenantVisualSettings } from '@/lib/whitelabel/settings'
import type { Database, Json } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

export type { TenantVisualSettings }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function getTenantVisualSettings(tenantId: string) {
  if (!UUID_PATTERN.test(tenantId)) {
    throw new Error('Identificador de barbearia inválido.')
  }

  const admin = createAdminClient()
  const { data: tenant, error } = await admin
    .from('tenants')
    .select('id, name, slug, custom_domain, address, visual_settings, organization_id, organizations(name, is_multi_branch)')
    .eq('id', tenantId)
    .single()

  if (error || !tenant) {
    throw new Error('Barbearia não encontrada.')
  }

  const saved = (tenant.visual_settings && typeof tenant.visual_settings === 'object' && !Array.isArray(tenant.visual_settings))
    ? (tenant.visual_settings as Partial<TenantVisualSettings>)
    : {}

  const visualSettings: TenantVisualSettings = {
    ...defaultVisualSettings,
    ...saved,
  }

  const isMultiBranch = Boolean((tenant.organizations as { is_multi_branch?: boolean } | null)?.is_multi_branch)

  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      customDomain: tenant.custom_domain,
      address: tenant.address,
      organizationId: tenant.organization_id,
      isMultiBranch,
    },
    visualSettings,
  }
}

export async function updateTenantVisualSettings(
  tenantId: string,
  settings: Partial<TenantVisualSettings>,
) {
  if (!UUID_PATTERN.test(tenantId)) {
    return { success: false, message: 'Barbearia inválida.' }
  }

  await requireOwner(tenantId)

  const admin = createAdminClient()
  const current = await admin.from('tenants').select('visual_settings').eq('id', tenantId).single()
  if (current.error) {
    return { success: false, message: 'Não foi possível carregar as configurações atuais.' }
  }

  const currentSettings = (current.data?.visual_settings && typeof current.data.visual_settings === 'object')
    ? (current.data.visual_settings as Record<string, unknown>)
    : {}

  const merged = {
    ...defaultVisualSettings,
    ...currentSettings,
    ...settings,
  }

  const { error: updateError } = await admin
    .from('tenants')
    .update({
      visual_settings: merged as unknown as Json,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId)

  if (updateError) {
    return { success: false, message: 'Falha ao salvar a personalização visual.' }
  }

  return { success: true, message: 'Identidade visual atualizada com sucesso!' }
}

export async function getTenantBranches(tenantId: string) {
  if (!UUID_PATTERN.test(tenantId)) return []

  const admin = createAdminClient()
  const tenantRes = await admin.from('tenants').select('organization_id').eq('id', tenantId).single()
  if (tenantRes.error || !tenantRes.data?.organization_id) return []

  const { data } = await admin
    .from('tenants')
    .select('id, name, slug, address, status')
    .eq('organization_id', tenantRes.data.organization_id)
    .in('status', ['trial', 'active'])
    .order('name', { ascending: true })

  return data ?? []
}
