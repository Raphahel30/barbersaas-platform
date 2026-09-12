'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'
import type { Json } from '@/types/database.types'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type OnboardingWizardInput = {
  // Passo 1: Identidade
  barbershopName: string
  slug: string
  city: string
  state: string
  whatsapp: string
  // Passo 2: Operação Rápida
  services: Array<{
    id: string
    name: string
    price: number
    durationMinutes: number
    selected: boolean
  }>
  openingTime: string
  closingTime: string
  // Passo 3: Recebimento e Credenciais
  pixKeyType: string
  pixKey: string
  ownerName: string
  document?: string
  email: string
  password: string
}

export async function createQuickBarbershop(data: OnboardingWizardInput): Promise<{
  success: boolean
  message: string
  tenantSlug?: string
}> {
  const admin = createAdminClient()

  // 1. Validações
  const cleanSlug = data.slug.trim().toLowerCase()
  if (!cleanSlug || !SLUG_PATTERN.test(cleanSlug)) {
    return { success: false, message: 'URL/Slug inválido. Use apenas letras minúsculas, números e hífens.' }
  }

  const cleanEmail = data.email.trim().toLowerCase()
  if (!EMAIL_PATTERN.test(cleanEmail)) {
    return { success: false, message: 'E-mail inválido.' }
  }

  if (data.password.length < 6) {
    return { success: false, message: 'A senha deve conter no mínimo 6 caracteres.' }
  }

  let organizationId: string | null = null
  let tenantId: string | null = null

  try {
    // 2. Verificar duplicidade de Slug
    const { data: existingTenant } = await admin
      .from('tenants')
      .select('id')
      .eq('slug', cleanSlug)
      .maybeSingle()

    if (existingTenant) {
      return { success: false, message: 'Esta URL já está em uso por outra barbearia. Escolha outro slug.' }
    }

    // 3. Buscar Plano Padrão (Starter / Solo)
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
        full_name: data.ownerName,
        role: 'tenant_admin',
      },
    })

    if (userError) {
      // Se usuário já existir, tentar autenticar ou associar
      const { data: existingUsers } = await admin.auth.admin.listUsers()
      const match = existingUsers.users.find((u) => u.email === cleanEmail)
      if (match) {
        userId = match.id
      } else {
        return { success: false, message: userError?.message || 'Falha ao criar usuário.' }
      }
    } else {
      userId = userData.user.id
    }

    // 5. Criar Organização
    const rawDoc = data.document?.replace(/\D/g, '') || data.pixKey.replace(/\D/g, '')
    const docNumber = rawDoc && rawDoc.length >= 11 ? rawDoc : '00000000000'

    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({
        name: data.barbershopName,
        document: docNumber,
        email: cleanEmail,
        phone: data.whatsapp.replace(/\D/g, '') || '11999999999',
      })
      .select('id')
      .single()

    if (orgError) throw orgError
    organizationId = org.id

    // 6. Criar Tenant
    const addressData: Json = {
      city: data.city,
      state: data.state || 'SP',
    }

    const gatewayCredentials: Json = {
      pix_key: data.pixKey,
      pix_key_type: data.pixKeyType,
    }

    const { data: tenant, error: tenantError } = await admin
      .from('tenants')
      .insert({
        organization_id: organizationId,
        plan_id: planId,
        name: data.barbershopName,
        slug: cleanSlug,
        status: 'trial',
        address: addressData,
        gateway_credentials: gatewayCredentials,
      })
      .select('id')
      .single()

    if (tenantError) throw tenantError
    tenantId = tenant.id

    // 7. Criar Tenant Settings
    await admin.from('tenant_settings').insert({
      tenant_id: tenantId,
      notify_barber_on_booking: true,
      closing_buffer_minutes: 10,
    })

    // 8. Criar Perfil de Proprietário
    await admin.from('profiles').upsert({
      id: userId,
      tenant_id: tenantId,
      role: 'owner',
      full_name: data.ownerName || data.barbershopName,
      email: cleanEmail,
      phone: data.whatsapp,
      is_active: true,
    })

    // 9. Inserir Serviços Selecionados
    const selectedServices = data.services.filter((s) => s.selected)
    if (selectedServices.length > 0) {
      const servicesToInsert = selectedServices.map((s) => ({
        tenant_id: tenantId!,
        name: s.name,
        price: Number(s.price),
        duration_minutes: s.durationMinutes || 35,
        reservation_fee: Math.round(Number(s.price) * 0.3), // 30% de sinal padrão
        is_active: true,
      }))
      await admin.from('services').insert(servicesToInsert)
    }

    // 10. Iniciar Sessão no cliente Next.js com as credenciais
    const supabase = await createClient()
    await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: data.password,
    })

    return {
      success: true,
      message: 'Barbearia criada com sucesso!',
      tenantSlug: cleanSlug,
    }
  } catch (error) {
    console.error('Erro no onboarding simplificado:', error)
    // Rollback em caso de falha crítica
    if (tenantId) await admin.from('tenants').delete().eq('id', tenantId)
    if (organizationId) await admin.from('organizations').delete().eq('id', organizationId)
    return {
      success: false,
      message: 'Houve uma falha ao cadastrar a barbearia. Verifique os dados e tente novamente.',
    }
  }
}
