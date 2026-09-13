'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { DEFAULT_SITE_CONFIG, type TenantSiteConfigData } from '@/lib/builder/defaults'

export async function getTenantSiteConfig(tenantIdOrSlug: string): Promise<{
  success: boolean
  config?: TenantSiteConfigData
  tenant?: {
    id: string
    name: string
    slug: string
    address_street?: string | null
    address_number?: string | null
    address_neighborhood?: string | null
    address_city?: string | null
    address_state?: string | null
    address_cep?: string | null
    phone?: string | null
  }
  error?: string
}> {
  const admin = createAdminClient()

  try {
    // 1. Obter tenant por ID ou Slug
    let query = admin.from('tenants').select('id, name, slug, address_street, address_number, address_neighborhood, address_city, address_state, address_cep, gateway_credentials')
    
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tenantIdOrSlug)
    if (isUuid) {
      query = query.eq('id', tenantIdOrSlug)
    } else {
      query = query.eq('slug', tenantIdOrSlug)
    }

    const { data: tenant, error: tenantErr } = await query.maybeSingle()
    if (tenantErr || !tenant) {
      return { success: false, error: 'Barbearia não encontrada' }
    }

    // 2. Obter configuração do site
    const { data: siteConfig, error: configErr } = await admin
      .from('tenant_site_config')
      .select('*')
      .eq('tenant_id', tenant.id)
      .maybeSingle()

    if (configErr) {
      console.error('Erro ao buscar tenant_site_config:', configErr)
    }

    let config: TenantSiteConfigData

    if (siteConfig) {
      config = {
        id: siteConfig.id,
        tenant_id: siteConfig.tenant_id,
        logo_url: siteConfig.logo_url,
        banner_url: siteConfig.banner_url || DEFAULT_SITE_CONFIG.banner_url,
        headline_title: siteConfig.headline_title || DEFAULT_SITE_CONFIG.headline_title,
        headline_subtitle: siteConfig.headline_subtitle || DEFAULT_SITE_CONFIG.headline_subtitle,
        about_text: siteConfig.about_text || DEFAULT_SITE_CONFIG.about_text,
        font_family: siteConfig.font_family || DEFAULT_SITE_CONFIG.font_family,
        bg_texture: siteConfig.bg_texture || DEFAULT_SITE_CONFIG.bg_texture,
        primary_color: siteConfig.primary_color || DEFAULT_SITE_CONFIG.primary_color,
        background_color: siteConfig.background_color || DEFAULT_SITE_CONFIG.background_color,
        card_color: siteConfig.card_color || DEFAULT_SITE_CONFIG.card_color,
        gallery_photos: Array.isArray(siteConfig.gallery_photos) ? (siteConfig.gallery_photos as string[]) : DEFAULT_SITE_CONFIG.gallery_photos,
        amenities: Array.isArray(siteConfig.amenities) ? (siteConfig.amenities as string[]) : DEFAULT_SITE_CONFIG.amenities,
        sections_visibility: siteConfig.sections_visibility && typeof siteConfig.sections_visibility === 'object'
          ? (siteConfig.sections_visibility as any)
          : DEFAULT_SITE_CONFIG.sections_visibility,
        updated_at: siteConfig.updated_at,
      }
    } else {
      config = {
        ...DEFAULT_SITE_CONFIG,
        tenant_id: tenant.id,
      }
    }

    return {
      success: true,
      config,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        address_street: tenant.address_street,
        address_number: tenant.address_number,
        address_neighborhood: tenant.address_neighborhood,
        address_city: tenant.address_city,
        address_state: tenant.address_state,
        address_cep: tenant.address_cep,
      }
    }
  } catch (err: any) {
    console.error('getTenantSiteConfig error:', err)
    return { success: false, error: err.message || 'Erro inesperado' }
  }
}

export async function saveTenantSiteConfig(
  tenantId: string,
  configData: Partial<TenantSiteConfigData>
): Promise<{ success: boolean; message: string }> {
  const admin = createAdminClient()

  try {
    const supabase = await createClient()
    const { data: claimsData } = await supabase.auth.getClaims()
    const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
    
    if (userId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id, role')
        .eq('id', userId)
        .maybeSingle()

      if (profile && profile.role !== 'super_admin' && profile.tenant_id !== tenantId) {
        return {
          success: false,
          message: 'Acesso não autorizado. Você só pode personalizar a sua própria barbearia.',
        }
      }
    }

    const payload = {
      tenant_id: tenantId,
      logo_url: configData.logo_url ?? null,
      banner_url: configData.banner_url ?? DEFAULT_SITE_CONFIG.banner_url,
      headline_title: configData.headline_title ?? DEFAULT_SITE_CONFIG.headline_title,
      headline_subtitle: configData.headline_subtitle ?? DEFAULT_SITE_CONFIG.headline_subtitle,
      about_text: configData.about_text ?? DEFAULT_SITE_CONFIG.about_text,
      font_family: configData.font_family ?? DEFAULT_SITE_CONFIG.font_family,
      bg_texture: configData.bg_texture ?? DEFAULT_SITE_CONFIG.bg_texture,
      primary_color: configData.primary_color ?? DEFAULT_SITE_CONFIG.primary_color,
      background_color: configData.background_color ?? DEFAULT_SITE_CONFIG.background_color,
      card_color: configData.card_color ?? DEFAULT_SITE_CONFIG.card_color,
      gallery_photos: configData.gallery_photos ?? DEFAULT_SITE_CONFIG.gallery_photos,
      amenities: configData.amenities ?? DEFAULT_SITE_CONFIG.amenities,
      sections_visibility: configData.sections_visibility ?? DEFAULT_SITE_CONFIG.sections_visibility,
      updated_at: new Date().toISOString(),
    }

    const { error } = await admin
      .from('tenant_site_config')
      .upsert(payload, { onConflict: 'tenant_id' })

    if (error) {
      console.error('Erro ao salvar tenant_site_config:', error)
      return { success: false, message: 'Falha ao salvar as configurações visuais do site.' }
    }

    // Revalidate storefront cache
    const { data: tenant } = await admin.from('tenants').select('slug').eq('id', tenantId).maybeSingle()
    if (tenant?.slug) {
      revalidatePath(`/${tenant.slug}`)
    }
    revalidatePath('/dashboard/builder')

    return { success: true, message: 'Configurações do site salvas e publicadas com sucesso!' }
  } catch (err: any) {
    console.error('saveTenantSiteConfig exception:', err)
    return { success: false, message: err.message || 'Erro ao salvar personalizações.' }
  }
}
