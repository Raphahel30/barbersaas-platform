'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { recordAuditLog } from '@/lib/logs/audit'
import { defaultVisualSettings, type TenantVisualSettings } from '@/lib/whitelabel/settings'
import type { Database, Json } from '@/types/database.types'

export interface InitialServiceInput {
  name: string
  duration_minutes: number
  price: number
  reservation_fee: number
}

export interface OnboardingPayload {
  name: string
  logoUrl?: string
  phone?: string
  address: {
    street: string
    number: string
    neighborhood: string
    city: string
    state: string
    postalCode?: string
  }
  primaryColor?: string
  openingHoursText?: string
  barberName?: string
  services: InitialServiceInput[]
  activeGateway: Database['public']['Enums']['gateway_provider'] | null
  zeroReservationFee: boolean
}

/**
 * Resgata o estado atual de onboarding do tenant.
 */
export async function getOnboardingState(tenantId: string) {
  const admin = createAdminClient()

  const [tenantRes, servicesRes, barbersRes] = await Promise.all([
    admin
      .from('tenants')
      .select('id, name, slug, address, visual_settings, active_gateway, status')
      .eq('id', tenantId)
      .maybeSingle(),
    admin
      .from('services')
      .select('id, name, duration_minutes, price, reservation_fee, is_active')
      .eq('tenant_id', tenantId),
    admin
      .from('profiles')
      .select('id, full_name, role, is_active')
      .eq('tenant_id', tenantId)
      .eq('role', 'barber'),
  ])

  const tenant = tenantRes.data
  const services = servicesRes.data ?? []
  const barbers = barbersRes.data ?? []

  const visual = (tenant?.visual_settings as Partial<TenantVisualSettings>) || {}
  const isCompleted = Boolean(visual.onboardingCompleted && services.length >= 1)

  return {
    tenant,
    services,
    barbers,
    isCompleted,
    defaultVisual: { ...defaultVisualSettings, ...visual },
  }
}

/**
 * Salva as configurações completas do onboarding e marca como finalizado.
 */
export async function saveOnboarding(
  tenantId: string,
  payload: OnboardingPayload,
): Promise<{ success: boolean; message: string; slug?: string }> {
  try {
    const supabase = await createClient()
    const { data: claimsData } = await supabase.auth.getClaims()
    const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
    const userEmail = typeof claimsData?.claims?.email === 'string' ? claimsData.claims.email : 'system@barbersaas.com'

    const admin = createAdminClient()

    // 1. Resgatar tenant atual
    const { data: currentTenant, error: fetchErr } = await admin
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .maybeSingle()

    if (fetchErr || !currentTenant) {
      return { success: false, message: 'Barbearia não encontrada para atualização.' }
    }

    const currentVisual = (currentTenant.visual_settings as Partial<TenantVisualSettings>) || {}
    const updatedVisual: TenantVisualSettings = {
      ...defaultVisualSettings,
      ...currentVisual,
      logoUrl: payload.logoUrl || currentVisual.logoUrl || '',
      phone: payload.phone || currentVisual.phone || '',
      primaryColor: payload.primaryColor || currentVisual.primaryColor || '#f59e0b',
      openingHoursText: payload.openingHoursText || currentVisual.openingHoursText || 'Seg a Sáb: 09h às 20h',
      onboardingCompleted: true,
    }

    // 2. Atualizar dados cadastrais do tenant
    const { error: updateTenantErr } = await admin
      .from('tenants')
      .update({
        name: payload.name.trim() || currentTenant.name,
        address: payload.address as Json,
        visual_settings: updatedVisual as Json,
        active_gateway: payload.zeroReservationFee ? null : payload.activeGateway,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)

    if (updateTenantErr) {
      return { success: false, message: `Erro ao salvar barbearia: ${updateTenantErr.message}` }
    }

    // 3. Cadastrar ou garantir serviços iniciais
    if (payload.services && payload.services.length > 0) {
      for (const s of payload.services) {
        if (!s.name.trim()) continue
        await admin.from('services').insert({
          tenant_id: tenantId,
          name: s.name.trim(),
          duration_minutes: s.duration_minutes || 30,
          cleanup_minutes: 5,
          price: s.price || 0,
          reservation_fee: payload.zeroReservationFee ? 0 : (s.reservation_fee || 0),
          is_active: true,
        })
      }
    }

    // 4. Cadastrar primeiro barbeiro se fornecido
    if (payload.barberName && payload.barberName.trim()) {
      const barberName = payload.barberName.trim()
      // Verifica se já tem barbeiro com este nome
      const { data: existingBarber } = await admin
        .from('profiles')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('full_name', barberName)
        .maybeSingle()

      if (!existingBarber && userId) {
        // Atualiza o perfil atual do dono ou cria registro
        await admin
          .from('profiles')
          .update({
            full_name: barberName,
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId)
      }
    }

    // 5. Registrar log de auditoria
    await recordAuditLog({
      tenantId,
      actorId: userId,
      actorEmail: userEmail,
      actorRole: 'owner',
      action: 'onboarding_completed',
      category: 'system',
      targetId: tenantId,
      details: {
        tenantName: payload.name,
        servicesCount: payload.services?.length ?? 0,
        activeGateway: payload.activeGateway,
        zeroReservationFee: payload.zeroReservationFee,
      },
    })

    return {
      success: true,
      message: 'Configuração concluída com sucesso! Sua barbearia está pronta.',
      slug: currentTenant.slug,
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Falha inesperada ao concluir onboarding.',
    }
  }
}
