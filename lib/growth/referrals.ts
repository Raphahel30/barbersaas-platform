import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'
import { awardFidelityStamp } from '@/lib/retention/fidelity'
import { recordAuditLog } from '@/lib/logs/audit'

/**
 * Gera o link de indicação B2B (Barbeiro Indica Barbeiro).
 */
export function generateTenantReferralLink(tenantSlug: string, baseUrl?: string): string {
  const root = baseUrl || process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'barbersaas.com.br'
  const protocol = root.startsWith('localhost') ? 'http' : 'https'
  return `${protocol}://${root}/onboarding?ref=${tenantSlug}`
}

/**
 * Gera o link de indicação B2C (Cliente Indica Amigo).
 */
export function generateClientReferralLink(tenantSlug: string, clientId: string, baseUrl?: string): string {
  const root = baseUrl || process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'barbersaas.com.br'
  const protocol = root.startsWith('localhost') ? 'http' : 'https'
  return `${protocol}://${tenantSlug}.${root}?ref_client=${clientId}`
}

/**
 * Registra o vínculo de indicação B2B no momento do onboarding do novo tenant.
 */
export async function trackTenantReferral(referrerSlug: string, newTenantId: string): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data: referrer } = await admin
      .from('tenants')
      .select('id')
      .eq('slug', referrerSlug.trim())
      .maybeSingle()

    if (!referrer || referrer.id === newTenantId) return false

    const { error } = await admin.from('tenant_referrals').insert({
      referrer_tenant_id: referrer.id,
      referred_tenant_id: newTenantId,
      referral_code: referrerSlug.trim(),
      status: 'converted',
      reward_amount: 30.00,
      created_at: new Date().toISOString(),
    })

    return !error
  } catch {
    return false
  }
}

/**
 * Recompensa o tenant indicador quando a mensalidade do indicado for quitada via Asaas.
 */
export async function rewardTenantReferralOnPayment(referredTenantId: string): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data: referral } = await admin
      .from('tenant_referrals')
      .select('id, referrer_tenant_id, reward_amount, status')
      .eq('referred_tenant_id', referredTenantId)
      .eq('status', 'converted')
      .maybeSingle()

    if (!referral) return false

    // Atualiza status para rewarded
    await admin
      .from('tenant_referrals')
      .update({
        status: 'rewarded',
        rewarded_at: new Date().toISOString(),
      })
      .eq('id', referral.id)

    await recordAuditLog({
      tenantId: referral.referrer_tenant_id,
      actorEmail: 'system@barbersaas.com',
      actorRole: 'super_admin',
      action: 'tenant_referral_rewarded',
      category: 'financial',
      details: {
        referredTenantId,
        rewardAmount: referral.reward_amount,
      },
    })

    return true
  } catch {
    return false
  }
}

/**
 * Registra o vínculo de indicação B2C quando um visitante acessa pelo link de um amigo.
 */
export async function trackClientReferral(
  tenantId: string,
  referrerClientId: string,
  newClientId?: string | null,
  newPhone?: string | null,
): Promise<boolean> {
  try {
    const admin = createAdminClient()

    // Evita auto-indicação
    if (referrerClientId === newClientId) return false

    const { error } = await admin.from('client_referrals').insert({
      tenant_id: tenantId,
      referrer_client_id: referrerClientId,
      referred_client_id: newClientId || null,
      referred_phone: newPhone || null,
      status: 'pending',
      reward_type: 'fidelity_stamp',
      created_at: new Date().toISOString(),
    })

    return !error
  } catch {
    return false
  }
}

/**
 * Bonifica o cliente indicador quando o indicado conclui o primeiro atendimento na barbearia.
 */
export async function rewardClientReferralOnCompletedAppointment(
  tenantId: string,
  appointmentId: string,
  clientId: string,
): Promise<{ rewarded: boolean; message?: string }> {
  try {
    const admin = createAdminClient()

    // Localiza indicação pendente para este cliente
    const { data: referral } = await admin
      .from('client_referrals')
      .select('id, referrer_client_id, reward_type, status')
      .eq('tenant_id', tenantId)
      .eq('referred_client_id', clientId)
      .eq('status', 'pending')
      .maybeSingle()

    if (!referral) return { rewarded: false }

    // Concede o benefício ao indicador (1 selo de fidelidade ou crédito de corte)
    if (referral.reward_type === 'fidelity_stamp') {
      await awardFidelityStamp(tenantId, referral.referrer_client_id, appointmentId)
    } else {
      // Concede crédito em carteira
      await admin.from('client_credits').insert({
        tenant_id: tenantId,
        client_id: referral.referrer_client_id,
        appointment_id: appointmentId,
        type: 'fidelity',
        amount: 15.00,
        expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 dias
        created_at: new Date().toISOString(),
      })
    }

    // Marca como recompensada
    await admin
      .from('client_referrals')
      .update({
        status: 'rewarded',
        rewarded_at: new Date().toISOString(),
      })
      .eq('id', referral.id)

    return { rewarded: true, message: 'Amigo indicado completou o atendimento! Selo/crédito creditado com sucesso.' }
  } catch (err) {
    return { rewarded: false, message: 'Falha ao processar recompensa de indicação.' }
  }
}
