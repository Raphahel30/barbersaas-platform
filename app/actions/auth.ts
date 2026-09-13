'use server'

import { createClient as createAdminSupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

import type { Database, Json } from '@/types/database.types'
import { createClient } from '@/utils/supabase/server'

const SUPER_ADMIN_EMAIL = 'rafaelcassu@gmail.com'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export type AuthActionState = {
  success: boolean
  message: string
  redirectTo?: string
  fieldErrors?: Record<string, string>
}

function getRequiredString(formData: FormData, field: string): string {
  const value = formData.get(field)
  return typeof value === 'string' ? value.trim() : ''
}

function getOptionalString(formData: FormData, field: string): string | null {
  const value = getRequiredString(formData, field)
  return value.length > 0 ? value : null
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function normalizeBrazilianPhone(value: string): string | null {
  const digits = digitsOnly(value)
  const localNumber = digits.startsWith('55') ? digits.slice(2) : digits

  if (localNumber.length !== 10 && localNumber.length !== 11) return null
  if (localNumber[2] === '0' || localNumber.startsWith('0')) return null

  return `55${localNumber}`
}

function allDigitsAreEqual(value: string): boolean {
  return /^([0-9])\1+$/.test(value)
}

function isValidCpf(cpf: string): boolean {
  if (cpf.length !== 11 || allDigitsAreEqual(cpf)) return false

  const calculateDigit = (length: number): number => {
    let sum = 0
    for (let index = 0; index < length; index += 1) {
      sum += Number(cpf[index]) * (length + 1 - index)
    }
    const remainder = (sum * 10) % 11
    return remainder === 10 ? 0 : remainder
  }

  return calculateDigit(9) === Number(cpf[9]) && calculateDigit(10) === Number(cpf[10])
}

function isValidCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || allDigitsAreEqual(cnpj)) return false

  const calculateDigit = (baseLength: number): number => {
    const weights = baseLength === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const sum = weights.reduce(
      (total, weight, index) => total + Number(cnpj[index]) * weight,
      0,
    )
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  return calculateDigit(12) === Number(cnpj[12]) && calculateDigit(13) === Number(cnpj[13])
}

function isValidDocument(document: string): boolean {
  return document.length === 11 ? isValidCpf(document) : isValidCnpj(document)
}

function isStrongPassword(password: string): boolean {
  return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password)
}

function isValidBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value) && date <= new Date()
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase administrative environment variables are missing')
  }

  return createAdminSupabaseClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

function getEmailRedirectUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) throw new Error('Missing NEXT_PUBLIC_APP_URL')
  return new URL('/auth/callback', appUrl).toString()
}

function databaseErrorMessage(error: { code?: string; message: string }): string {
  if (error.code === '23505') return 'Já existe um cadastro com os dados informados.'
  return 'Não foi possível concluir o cadastro. Tente novamente.'
}

export async function signUpOwner(formData: FormData): Promise<AuthActionState> {
  const organizationName = getRequiredString(formData, 'organizationName')
  const tenantName = getRequiredString(formData, 'tenantName')
  const ownerName = getRequiredString(formData, 'fullName')
  const email = normalizeEmail(getRequiredString(formData, 'email'))
  const document = digitsOnly(getRequiredString(formData, 'document'))
  const phone = normalizeBrazilianPhone(getRequiredString(formData, 'phone'))
  const password = getRequiredString(formData, 'password')
  const planId = getRequiredString(formData, 'planId')
  const slug = getRequiredString(formData, 'slug').toLowerCase()
  const customDomainValue = getOptionalString(formData, 'customDomain')
  const customDomain = customDomainValue?.toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '') ?? null
  const captchaToken = getOptionalString(formData, 'captchaToken')
  const fieldErrors: Record<string, string> = {}

  if (organizationName.length < 2) fieldErrors.organizationName = 'Informe a razão social ou nome da organização.'
  if (tenantName.length < 2) fieldErrors.tenantName = 'Informe o nome da barbearia.'
  if (ownerName.length < 2) fieldErrors.fullName = 'Informe o nome completo.'
  if (!EMAIL_PATTERN.test(email)) fieldErrors.email = 'Informe um e-mail válido.'
  if (!isValidDocument(document)) fieldErrors.document = 'Informe um CPF ou CNPJ válido.'
  if (!phone) fieldErrors.phone = 'Informe um WhatsApp brasileiro válido com DDD.'
  if (!isStrongPassword(password)) fieldErrors.password = 'Use ao menos 8 caracteres, com maiúscula, minúscula e número.'
  if (!UUID_PATTERN.test(planId)) fieldErrors.planId = 'Selecione um plano válido.'
  if (!SLUG_PATTERN.test(slug)) fieldErrors.slug = 'Use apenas letras minúsculas, números e hífens.'
  if (customDomain && (!customDomain.includes('.') || customDomain.includes('/') || customDomain.includes(':'))) {
    fieldErrors.customDomain = 'Informe somente o domínio, sem protocolo, porta ou caminho.'
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, message: 'Revise os campos destacados.', fieldErrors }
  }

  let admin
  let emailRedirectTo: string
  try {
    admin = createAdminClient()
    emailRedirectTo = getEmailRedirectUrl()
  } catch {
    return { success: false, message: 'O serviço de cadastro está indisponível.' }
  }

  const [planResult, documentResult, organizationEmailResult, organizationPhoneResult, profileEmailResult, slugResult, domainResult] = await Promise.all([
    admin.from('plans').select('id').eq('id', planId).eq('is_active', true).maybeSingle(),
    admin.from('organizations').select('id').eq('document', document).maybeSingle(),
    admin.from('organizations').select('id').eq('email', email).maybeSingle(),
    admin.from('organizations').select('id').eq('phone', phone!).maybeSingle(),
    admin.from('profiles').select('id').eq('email', email).maybeSingle(),
    admin.from('tenants').select('id').eq('slug', slug).maybeSingle(),
    customDomain
      ? admin.from('tenants').select('id').eq('custom_domain', customDomain).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const lookupError = [planResult, documentResult, organizationEmailResult, organizationPhoneResult, profileEmailResult, slugResult, domainResult]
    .find((result) => result.error)?.error
  if (lookupError) return { success: false, message: 'Não foi possível validar os dados do cadastro.' }
  if (!planResult.data) fieldErrors.planId = 'O plano selecionado não está disponível.'
  if (documentResult.data) fieldErrors.document = 'Este CPF ou CNPJ já está cadastrado.'
  if (organizationEmailResult.data || profileEmailResult.data) fieldErrors.email = 'Este e-mail já está cadastrado.'
  if (organizationPhoneResult.data) fieldErrors.phone = 'Este telefone já está cadastrado.'
  if (slugResult.data) fieldErrors.slug = 'Este endereço já está em uso.'
  if (domainResult.data) fieldErrors.customDomain = 'Este domínio já está em uso.'
  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, message: 'Já existe um cadastro com os dados informados.', fieldErrors }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken: captchaToken ?? undefined,
      data: { display_name: ownerName },
      emailRedirectTo,
    },
  })

  if (authError || !authData.user || authData.user.identities?.length === 0) {
    return { success: false, message: authError?.message ?? 'Este e-mail já possui uma conta.' }
  }

  const userId = authData.user.id
  let organizationId: string | null = null
  let tenantId: string | null = null

  try {
    const organizationInsert = await admin
      .from('organizations')
      .insert({ name: organizationName, document, email, phone: phone! })
      .select('id')
      .single()
    if (organizationInsert.error) throw organizationInsert.error
    organizationId = organizationInsert.data.id

    const address: Json = {
      line1: getOptionalString(formData, 'addressLine'),
      city: getOptionalString(formData, 'city'),
      state: getOptionalString(formData, 'state'),
      postal_code: digitsOnly(getRequiredString(formData, 'postalCode')) || null,
    }
    const tenantInsert = await admin
      .from('tenants')
      .insert({ organization_id: organizationId, plan_id: planId, name: tenantName, slug, custom_domain: customDomain, status: 'trial', address })
      .select('id')
      .single()
    if (tenantInsert.error) throw tenantInsert.error
    tenantId = tenantInsert.data.id

    const settingsInsert = await admin.from('tenant_settings').insert({ tenant_id: tenantId })
    if (settingsInsert.error) throw settingsInsert.error

    const profileInsert = await admin.from('profiles').insert({
      id: userId,
      tenant_id: tenantId,
      role: 'owner',
      full_name: ownerName,
      email,
      phone,
    })
    if (profileInsert.error) throw profileInsert.error
  } catch (error) {
    if (tenantId) await admin.from('tenants').delete().eq('id', tenantId)
    if (organizationId) await admin.from('organizations').delete().eq('id', organizationId)
    await admin.auth.admin.deleteUser(userId)
    const typedError = error as { code?: string; message: string }
    return { success: false, message: databaseErrorMessage(typedError) }
  }

  return {
    success: true,
    message: authData.session
      ? 'Cadastro concluído com sucesso.'
      : 'Cadastro concluído. Confirme seu e-mail para entrar.',
  }
}

export async function signUpClient(formData: FormData): Promise<AuthActionState> {
  const tenantId = getRequiredString(formData, 'tenantId')
  const fullName = getRequiredString(formData, 'fullName')
  const email = normalizeEmail(getRequiredString(formData, 'email'))
  const phone = normalizeBrazilianPhone(getRequiredString(formData, 'phone'))
  const password = getRequiredString(formData, 'password')
  const birthDate = getRequiredString(formData, 'birthDate')
  const captchaToken = getOptionalString(formData, 'captchaToken')
  const fieldErrors: Record<string, string> = {}

  if (!UUID_PATTERN.test(tenantId)) fieldErrors.tenantId = 'Barbearia inválida.'
  if (fullName.length < 2) fieldErrors.fullName = 'Informe o nome completo.'
  if (!EMAIL_PATTERN.test(email)) fieldErrors.email = 'Informe um e-mail válido.'
  if (!phone) fieldErrors.phone = 'Informe um WhatsApp brasileiro válido com DDD.'
  if (!isStrongPassword(password)) fieldErrors.password = 'Use ao menos 8 caracteres, com maiúscula, minúscula e número.'
  if (!isValidBirthDate(birthDate)) fieldErrors.birthDate = 'Informe uma data de nascimento válida.'
  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, message: 'Revise os campos destacados.', fieldErrors }
  }

  let admin
  let emailRedirectTo: string
  try {
    admin = createAdminClient()
    emailRedirectTo = getEmailRedirectUrl()
  } catch {
    return { success: false, message: 'O serviço de cadastro está indisponível.' }
  }

  const [tenantResult, emailResult, phoneResult] = await Promise.all([
    admin.from('tenants').select('id,status').eq('id', tenantId).maybeSingle(),
    admin.from('profiles').select('id').eq('email', email).maybeSingle(),
    admin.from('profiles').select('id').eq('tenant_id', tenantId).eq('phone', phone!).maybeSingle(),
  ])
  if (tenantResult.error || emailResult.error || phoneResult.error) {
    return { success: false, message: 'Não foi possível validar os dados do cadastro.' }
  }
  if (!tenantResult.data || ['suspended', 'cancelled'].includes(tenantResult.data.status)) {
    return { success: false, message: 'Esta barbearia não aceita novos cadastros no momento.' }
  }
  if (emailResult.data) fieldErrors.email = 'Este e-mail já está cadastrado.'
  if (phoneResult.data) fieldErrors.phone = 'Este WhatsApp já está cadastrado nesta barbearia.'
  if (Object.keys(fieldErrors).length > 0) {
    return { success: false, message: 'Já existe um cadastro com os dados informados.', fieldErrors }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      captchaToken: captchaToken ?? undefined,
      data: { display_name: fullName },
      emailRedirectTo,
    },
  })
  if (authError || !authData.user || authData.user.identities?.length === 0) {
    return { success: false, message: authError?.message ?? 'Este e-mail já possui uma conta.' }
  }

  const profileInsert = await admin.from('profiles').insert({
    id: authData.user.id,
    tenant_id: tenantId,
    role: 'client',
    full_name: fullName,
    email,
    phone,
    birth_date: birthDate,
  })
  if (profileInsert.error) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return { success: false, message: databaseErrorMessage(profileInsert.error) }
  }

  return {
    success: true,
    message: authData.session
      ? 'Cadastro concluído com sucesso.'
      : 'Cadastro concluído. Confirme seu e-mail para entrar.',
  }
}

export async function signIn(formData: FormData): Promise<AuthActionState> {
  const email = normalizeEmail(getRequiredString(formData, 'email'))
  const password = getRequiredString(formData, 'password')

  if (!EMAIL_PATTERN.test(email) || password.length === 0) {
    return { success: false, message: 'Informe e-mail e senha válidos.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    return { success: false, message: 'E-mail ou senha incorretos.' }
  }

  // Se for o Super Admin do sistema
  if (data.user.email?.toLowerCase() === SUPER_ADMIN_EMAIL || data.user.user_metadata?.role === 'super_admin') {
    return {
      success: true,
      message: 'Autenticado com sucesso como Super Admin.',
      redirectTo: '/master-admin',
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role,is_active,tenant_id,tenants(slug)')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileError || !profile || !profile.is_active) {
    // Fallback para caso o e-mail seja do super admin
    if (data.user.email?.toLowerCase() === SUPER_ADMIN_EMAIL) {
      return {
        success: true,
        message: 'Autenticado com sucesso.',
        redirectTo: '/master-admin',
      }
    }
    await supabase.auth.signOut({ scope: 'local' })
    return { success: false, message: 'Conta sem perfil ativo. Entre em contato com o suporte.' }
  }

  if (profile.role === 'super_admin') {
    return {
      success: true,
      message: 'Autenticado com sucesso.',
      redirectTo: '/master-admin',
    }
  }

  const tenantSlug = (profile.tenants as { slug?: string } | null)?.slug

  switch (profile.role) {
    case 'owner':
      return {
        success: true,
        message: 'Autenticado com sucesso.',
        redirectTo: tenantSlug ? `/${tenantSlug}/admin` : '/dashboard',
      }
    case 'barber':
      return {
        success: true,
        message: 'Autenticado com sucesso.',
        redirectTo: tenantSlug ? `/${tenantSlug}/admin` : '/barber/agenda',
      }
    case 'client':
      return {
        success: true,
        message: 'Autenticado com sucesso.',
        redirectTo: tenantSlug ? `/${tenantSlug}/cliente` : '/meu-perfil',
      }
    default:
      return {
        success: true,
        message: 'Autenticado com sucesso.',
        redirectTo: '/dashboard',
      }
  }
}

export async function signOut(): Promise<never> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) await supabase.auth.signOut({ scope: 'local' })
  redirect('/login')
}
