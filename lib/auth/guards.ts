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
}

async function getVerifiedIdentity() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const subject = typeof data?.claims?.sub === 'string' ? data.claims.sub : null
  const email = typeof data?.claims?.email === 'string' ? data.claims.email.toLowerCase() : null

  if (error || !subject || !email) redirect('/login')

  return { email, subject, supabase }
}

async function getActiveProfile(): Promise<AuthorizedUser> {
  const { email, subject, supabase } = await getVerifiedIdentity()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', subject)
    .maybeSingle()

  if (error || !profile || !profile.is_active) redirect('/login')

  return { email, userId: subject, profile }
}

function assertTenantId(tenantId: string): void {
  if (!UUID_PATTERN.test(tenantId)) notFound()
}

export async function requireSuperAdmin(): Promise<{
  userId: string
  email: typeof SUPER_ADMIN_EMAIL
}> {
  const { email, subject } = await getVerifiedIdentity()

  if (email !== SUPER_ADMIN_EMAIL) notFound()

  return { userId: subject, email: SUPER_ADMIN_EMAIL }
}

export async function requireOwner(tenantId: string): Promise<AuthorizedUser> {
  assertTenantId(tenantId)
  const authorizedUser = await getActiveProfile()

  if (
    authorizedUser.profile.role !== 'owner' ||
    authorizedUser.profile.tenant_id !== tenantId
  ) {
    notFound()
  }

  return authorizedUser
}

export async function requireBarber(tenantId: string): Promise<AuthorizedUser> {
  assertTenantId(tenantId)
  const authorizedUser = await getActiveProfile()

  if (
    authorizedUser.profile.role !== 'barber' ||
    authorizedUser.profile.tenant_id !== tenantId
  ) {
    notFound()
  }

  return authorizedUser
}
