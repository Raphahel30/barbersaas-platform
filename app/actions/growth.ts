'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { generateTenantReferralLink, generateClientReferralLink } from '@/lib/growth/referrals'

export interface TenantReferralSummary {
  referralLink: string
  totalInvited: number
  totalConverted: number
  totalCreditsEarned: number
}

export interface ClientReferralSummary {
  referralLink: string
  totalFriendsInvited: number
  totalFriendsCompleted: number
}

export async function getTenantReferralInfo(tenantId: string): Promise<TenantReferralSummary> {
  const admin = createAdminClient()

  const { data: tenant } = await admin
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .maybeSingle()

  const slug = tenant?.slug || 'barbearia'
  const referralLink = generateTenantReferralLink(slug)

  const { data: referrals } = await admin
    .from('tenant_referrals')
    .select('status, reward_amount')
    .eq('referrer_tenant_id', tenantId)

  const items = referrals ?? []
  const totalInvited = items.length
  const totalConverted = items.filter((r) => r.status === 'converted' || r.status === 'rewarded').length
  const totalCreditsEarned = items
    .filter((r) => r.status === 'rewarded')
    .reduce((acc, curr) => acc + Number(curr.reward_amount || 0), 0)

  return {
    referralLink,
    totalInvited,
    totalConverted,
    totalCreditsEarned,
  }
}

export async function getClientReferralInfo(tenantId: string, clientId: string): Promise<ClientReferralSummary> {
  const admin = createAdminClient()

  const { data: tenant } = await admin
    .from('tenants')
    .select('slug')
    .eq('id', tenantId)
    .maybeSingle()

  const slug = tenant?.slug || 'barbearia'
  const referralLink = generateClientReferralLink(slug, clientId)

  const { data: referrals } = await admin
    .from('client_referrals')
    .select('status')
    .eq('tenant_id', tenantId)
    .eq('referrer_client_id', clientId)

  const items = referrals ?? []
  const totalFriendsInvited = items.length
  const totalFriendsCompleted = items.filter((r) => r.status === 'rewarded').length

  return {
    referralLink,
    totalFriendsInvited,
    totalFriendsCompleted,
  }
}
