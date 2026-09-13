import 'server-only'

import { notFound, redirect } from 'next/navigation'

import type { Database } from '@/types/database.types'
import { createClient } from '@/utils/supabase/server'

const SUPER_ADMIN_EMAIL = 'rafaelcassu@gmail.com'
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Profile = Database['public']['Tables']['profiles']['Row']

export type AuthorizedUser = {
  userId: string
  email: string
  profile: Profile
  user?: { id: string; email: string }
}

async function getVerifiedIdentity() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const subject = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  const email = typeof data?.claims?.email === 'string' ? data.claims.email.toLowerCase() : null

  if (error || !subject || !email) {
    throw new Error('Não autenticado. Por favor, realize o login.')
  }

  return { email, subject, supabase }
}

export async function requireAuthenticatedUser(): Promise<AuthorizedUser> {
  const { email, subject, supabase } = await getVerifiedIdentity()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', subject)
    .maybeSingle()

  if (error || !profile || !profile.is_active) {
    throw new Error('Perfil de usuário inativo ou não encontrado.')
  }

  return {
    userId: subject,
    email,
    profile,
    user: { id: subject, email },
  }
}

function assertTenantId(tenantId: string): void {
  if (!UUID_PATTERN.test(tenantId)) {
    throw new Error('Identificador de barbearia inválido.')
  }
}

export async function requireSuperAdmin(): Promise<{
  userId: string
  email: typeof SUPER_ADMIN_EMAIL
}> {
  const { email, subject } = await getVerifiedIdentity()

  if (email !== SUPER_ADMIN_EMAIL) {
    throw new Error('Acesso restrito ao Super Administrador da plataforma.')
  }

  return { userId: subject, email: SUPER_ADMIN_EMAIL }
}

export async function requireTenantOwner(tenantId: string): Promise<AuthorizedUser> {
  assertTenantId(tenantId)
  const authUser = await requireAuthenticatedUser()

  const isSuperAdmin = authUser.email === SUPER_ADMIN_EMAIL || authUser.profile.role === 'super_admin'
  const isOwner = authUser.profile.role === 'owner' && authUser.profile.tenant_id === tenantId

  if (!isSuperAdmin && !isOwner) {
    throw new Error('Acesso negado: Você não tem permissão de proprietário para gerenciar esta barbearia.')
  }

  return authUser
}

export async function requireOwner(tenantId: string): Promise<AuthorizedUser> {
  return requireTenantOwner(tenantId)
}

export async function requireTenantStaff(tenantId: string): Promise<AuthorizedUser> {
  assertTenantId(tenantId)
  const authUser = await requireAuthenticatedUser()

  const isSuperAdmin = authUser.email === SUPER_ADMIN_EMAIL || authUser.profile.role === 'super_admin'
  const isStaff =
    ['owner', 'barber', 'receptionist'].includes(authUser.profile.role) &&
    authUser.profile.tenant_id === tenantId

  if (!isSuperAdmin && !isStaff) {
    throw new Error('Acesso negado: Você não faz parte da equipe desta barbearia.')
  }

  return authUser
}

export async function requireBarber(tenantId: string): Promise<AuthorizedUser> {
  assertTenantId(tenantId)
  const authUser = await requireAuthenticatedUser()

  const isSuperAdmin = authUser.email === SUPER_ADMIN_EMAIL || authUser.profile.role === 'super_admin'
  const isBarber =
    (authUser.profile.role === 'barber' || authUser.profile.role === 'owner') &&
    authUser.profile.tenant_id === tenantId

  if (!isSuperAdmin && !isBarber) {
    throw new Error('Acesso negado: Ação permitida apenas para barbeiros vinculados a esta unidade.')
  }

  return authUser
}
