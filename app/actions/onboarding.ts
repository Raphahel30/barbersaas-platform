'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import { recordAuditLog } from '@/lib/logs/audit'
import { defaultVisualSettings, type TenantVisualSettings } from '@/lib/whitelabel/settings'
import type { Database, Json } from '@/types/database.types'

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type QuickOnboardingInput = {
  // Bloco 1: Dono da Barbearia
  ownerName: string
  document: string // CPF ou CNPJ
  whatsapp: string
  email: string
  password: string

  // Bloco 2: A Barbearia
  barbershopName: string
  slug: string

  // Bloco 3: Localização
  cep: string
  street: string
  number: string
  neighborhood: string
  city: string
  state: string
}

export type OnboardingResult = {
  success: boolean
  message: string
  redirectUrl?: string
  tenantSlug?: string
}

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

export async function processQuickOnboarding(
  data: QuickOnboardingInput
): Promise<OnboardingResult> {
  const admin = createAdminClient()

  // 1. Validações básicas de formato
  const cleanOwnerName = data.ownerName.trim()
  if (!cleanOwnerName) {
    return { success: false, message: 'Informe seu nome completo.' }
  }

  const cleanEmail = data.email.trim().toLowerCase()
  if (!EMAIL_REGEX.test(cleanEmail)) {
    return { success: false, message: 'Por favor, informe um e-mail válido.' }
  }

  if (data.password.length < 6) {
    return { success: false, message: 'A senha deve ter pelo menos 6 caracteres.' }
  }

  const cleanBarbershopName = data.barbershopName.trim()
  if (!cleanBarbershopName) {
    return { success: false, message: 'Informe o nome da barbearia.' }
  }

  const cleanSlug = data.slug
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (!cleanSlug || !SLUG_REGEX.test(cleanSlug)) {
    return {
      success: false,
      message: 'Slug/URL inválido. Use apenas letras minúsculas, números e hífens.',
    }
  }

  const cleanDoc = data.document.replace(/\D/g, '') || '00000000000'
  const cleanPhone = data.whatsapp.replace(/\D/g, '') || '11999999999'

  let organizationId: string | null = null
  let tenantId: string | null = null

  try {
    // 2. Verificar duplicidade de slug
    const { data: existingSlug } = await admin
      .from('tenants')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle()

    if (existingSlug) {
      return {
        success: false,
        message: `O link "${cleanSlug}" já está em uso por outra barbearia. Escolha outro slug.`,
      }
    }

    // 3. Obter plano padrão (Starter / Solo)
    const { data: plans } = await admin
      .from('plans')
      .select('id')
      .order('monthly_price', { ascending: true })
      .limit(1)

    const planId = plans && plans.length > 0 ? plans[0].id : null

    // 4. Criar ou Obter Usuário no Auth
    let userId: string

    const { data: userData, error: userError } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: cleanOwnerName,
        role: 'owner',
      },
    })

    if (userError) {
      // Caso o usuário já exista no Auth, tentar associar
      const { data: existingUsers } = await admin.auth.admin.listUsers()
      const match = existingUsers.users.find((u) => u.email === cleanEmail)
      if (match) {
        userId = match.id
      } else {
        return { success: false, message: `Falha ao criar conta: ${userError.message}` }
      }
    } else {
      userId = userData.user.id
    }

    // 5. Criar Organização
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({
        name: cleanBarbershopName,
        document: cleanDoc,
        email: cleanEmail,
        phone: cleanPhone,
        is_multi_branch: false,
      })
      .select('id')
      .single()

    if (orgError) throw orgError
    organizationId = org.id

    // 6. Criar Tenant com dados cadastrais e endereço
    const addressJson: Json = {
      street: data.street.trim(),
      number: data.number.trim(),
      neighborhood: data.neighborhood.trim(),
      city: data.city.trim(),
      state: data.state.trim().toUpperCase(),
      cep: data.cep.replace(/\D/g, ''),
    }

    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .insert({
        organization_id: organizationId,
        plan_id: planId,
        name: cleanBarbershopName,
        slug: cleanSlug,
        status: 'trial',
        document_number: cleanDoc,
        owner_name: cleanOwnerName,
        address_street: data.street.trim(),
        address_number: data.number.trim(),
        address_neighborhood: data.neighborhood.trim(),
        address_city: data.city.trim(),
        address_state: data.state.trim().toUpperCase(),
        address_cep: data.cep.replace(/\D/g, ''),
        address: addressJson,
      })
      .select('id')
      .single()

    if (tenantError) throw tenantError
    tenantId = tenant.id

    // 7. Criar Tenant Settings padrão
    await admin.from('tenant_settings').insert({
      tenant_id: tenantId,
      notify_barber_on_booking: true,
      closing_buffer_minutes: 10,
    })

    // 8. Vincular Usuário como Proprietário (role: 'owner') em Profiles
    await admin.from('profiles').upsert({
      id: userId,
      tenant_id: tenantId,
      role: 'owner',
      full_name: cleanOwnerName,
      email: cleanEmail,
      phone: cleanPhone,
      tax_document: cleanDoc,
      is_active: true,
    })

    // 9. Criar Configuração Inicial em tenant_site_config
    await admin.from('tenant_site_config').insert({
      tenant_id: tenantId,
      headline_title: `Bem-vindo à ${cleanBarbershopName}`,
      headline_subtitle: 'Agende seu corte e barba online em menos de 1 minuto sem complicação.',
      about_text: `A ${cleanBarbershopName} oferece serviços de alta precisão em cortes masculinos, barboterapia e tratamentos de alta performance. Agende seu horário com nossos profissionais qualificados.`,
      font_family: 'font-sans',
      bg_texture: 'clean_dark',
      primary_color: '#D97706',
      background_color: '#09090b',
      card_color: '#18181b',
      gallery_photos: [
        'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=80',
      ],
      amenities: ['Cerveja Gelada', 'Wi-Fi Grátis', 'Ar-Condicionado', 'Mesa de Sinuca'],
      sections_visibility: {
        hero: true,
        services: true,
        barbers: true,
        gallery: true,
        about: true,
        amenities: true,
        location: true,
      },
    })

    // 10. Criar serviços iniciais sugeridos
    await admin.from('services').insert([
      {
        tenant_id: tenantId,
        name: 'Corte Masculino Degradê',
        duration_minutes: 35,
        price: 45,
        reservation_fee: 15,
        is_active: true,
      },
      {
        tenant_id: tenantId,
        name: 'Barba Terapia com Toalha Quente',
        duration_minutes: 30,
        price: 35,
        reservation_fee: 10,
        is_active: true,
      },
      {
        tenant_id: tenantId,
        name: 'Combo Cabelo + Barba VIP',
        duration_minutes: 60,
        price: 75,
        reservation_fee: 25,
        is_active: true,
      },
    ])

    // 11. Autenticar sessão no cliente
    const supabase = await createClient()
    await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: data.password,
    })

    const targetRedirectUrl = `/${cleanSlug}/admin/personalizar`

    return {
      success: true,
      message: 'Barbearia criada com sucesso! Redirecionando...',
      tenantSlug: cleanSlug,
      redirectUrl: targetRedirectUrl,
    }
  } catch (err: any) {
    console.error('Erro no onboarding simplificado:', err)
    if (tenantId) await admin.from('tenants').delete().eq('id', tenantId)
    if (organizationId) await admin.from('organizations').delete().eq('id', organizationId)
    return {
      success: false,
      message: err.message || 'Houve uma falha ao cadastrar a barbearia. Tente novamente.',
    }
  }
}

/**
 * Resgata o estado atual de onboarding do tenant (Dashboard Helper).
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
 * Salva as configurações completas do onboarding (Dashboard Helper).
 */
export async function saveOnboarding(
  tenantId: string,
  payload: OnboardingPayload
): Promise<{ success: boolean; message: string; slug?: string }> {
  try {
    const supabase = await createClient()
    const { data: claimsData } = await supabase.auth.getClaims()
    const userId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
    const userEmail = typeof claimsData?.claims?.email === 'string' ? claimsData.claims.email : 'system@barbersaas.com'

    const admin = createAdminClient()

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
