'use server'

import { createAdminClient } from '@/utils/supabase/admin'
import { requireTenantStaff } from '@/lib/auth/guards'

export type MonthlySubscriber = {
  id: string
  tenant_id: string
  client_name: string
  client_phone: string
  plan_name: string
  cuts_included: number
  cuts_remaining: number
  price_monthly: number
  status: 'active' | 'overdue' | 'cancelled'
  cycle_start_date: string
  cycle_end_date: string
  created_at: string
}

export type PublicMonthlySubscriber = Pick<MonthlySubscriber, 'plan_name' | 'cuts_remaining'>

export type MonthlySubscriberInput = {
  client_name?: string
  clientName?: string
  client_phone?: string
  clientPhone?: string
  plan_name?: string
  planName?: string
  cuts_included?: number
  cutsIncluded?: number
  price_monthly?: number
  priceMonthly?: number
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, '')
  if ((p.length === 12 || p.length === 13) && p.startsWith('55')) {
    p = p.slice(2)
  }
  return p
}

async function resolveTenantId(slugOrId: string): Promise<string> {
  // If it's a UUID, return as is
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId)) {
    return slugOrId
  }
  const admin = createAdminClient()
  const { data } = await admin
    .from('tenants')
    .select('id')
    .eq('slug', slugOrId)
    .maybeSingle()
  return data?.id || slugOrId
}

export async function getMonthlySubscribers(tenantSlugOrId: string): Promise<MonthlySubscriber[]> {
  try {
    const tenantId = await resolveTenantId(tenantSlugOrId)
    await requireTenantStaff(tenantId)

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('monthly_subscriptions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Erro ao buscar mensalistas:', error)
      return []
    }

    return (data || []).map((s) => ({
      id: s.id,
      tenant_id: s.tenant_id,
      client_name: s.client_name,
      client_phone: s.client_phone,
      plan_name: s.plan_name,
      cuts_included: Number(s.cuts_included || 4),
      cuts_remaining: Number(s.cuts_remaining ?? s.cuts_included ?? 4),
      price_monthly: Number(s.price_monthly || 0),
      status: (s.status as MonthlySubscriber['status']) || 'active',
      cycle_start_date: s.cycle_start_date,
      cycle_end_date: s.cycle_end_date,
      created_at: s.created_at,
    }))
  } catch (err) {
    console.error('getMonthlySubscribers guard error:', err)
    return []
  }
}

export async function createMonthlySubscriber(
  tenantSlugOrId: string,
  input: MonthlySubscriberInput,
): Promise<{ success: boolean; message: string; subscriber?: MonthlySubscriber }> {
  try {
    const tenantId = await resolveTenantId(tenantSlugOrId)
    await requireTenantStaff(tenantId)

    const admin = createAdminClient()
    const rawPhone = input.client_phone || input.clientPhone || ''
    const rawName = input.client_name || input.clientName || 'Cliente VIP'
    const rawPlan = input.plan_name || input.planName || 'Plano Mensal Tradicional'
    const cutsIncluded = input.cuts_included ?? input.cutsIncluded ?? 4
    const priceMonthly = input.price_monthly ?? input.priceMonthly ?? 0
    const cleanPhone = normalizePhone(rawPhone)

    if (!cleanPhone || cleanPhone.length < 10) {
      return { success: false, message: 'WhatsApp/Telefone inválido.' }
    }

    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000)

    const { data, error } = await admin
      .from('monthly_subscriptions')
      .insert({
        tenant_id: tenantId,
        client_name: rawName.trim(),
        client_phone: cleanPhone,
        plan_name: rawPlan.trim(),
        cuts_included: cutsIncluded,
        cuts_remaining: cutsIncluded,
        price_monthly: priceMonthly,
        status: 'active',
        cycle_start_date: startDate.toISOString().slice(0, 10),
        cycle_end_date: endDate.toISOString().slice(0, 10),
      })
      .select('*')
      .single()

    if (error) {
      console.error('Erro ao criar mensalista:', error)
      return { success: false, message: 'Não foi possível cadastrar o mensalista.' }
    }

    return {
      success: true,
      message: 'Assinante cadastrado com sucesso!',
      subscriber: {
        id: data.id,
        tenant_id: data.tenant_id,
        client_name: data.client_name,
        client_phone: data.client_phone,
        plan_name: data.plan_name,
        cuts_included: Number(data.cuts_included),
        cuts_remaining: Number(data.cuts_remaining),
        price_monthly: Number(data.price_monthly),
        status: data.status as MonthlySubscriber['status'],
        cycle_start_date: data.cycle_start_date,
        cycle_end_date: data.cycle_end_date,
        created_at: data.created_at,
      },
    }
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro de autorização.' }
  }
}

export async function renewMonthlyCycle(
  subscriptionId: string,
  cutsIncluded?: number,
  _tenantSlug?: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const admin = createAdminClient()

    const { data: sub, error: fetchError } = await admin
      .from('monthly_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .single()

    if (fetchError || !sub) {
      return { success: false, message: 'Assinatura não encontrada.' }
    }

    await requireTenantStaff(sub.tenant_id)

    const startDate = new Date()
    const endDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000)
    const cuts = cutsIncluded || sub.cuts_included || 4

    const { error: updateError } = await admin
      .from('monthly_subscriptions')
      .update({
        cuts_remaining: cuts,
        status: 'active',
        cycle_start_date: startDate.toISOString().slice(0, 10),
        cycle_end_date: endDate.toISOString().slice(0, 10),
      })
      .eq('id', subscriptionId)

    if (updateError) {
      return { success: false, message: 'Falha ao renovar ciclo do assinante.' }
    }

    return { success: true, message: 'Ciclo mensal renovado com sucesso! Saldo de cortes restaurado.' }
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro de autorização.' }
  }
}

export async function pauseOrCancelSubscription(
  subscriptionId: string,
  newStatus: 'active' | 'overdue' | 'cancelled',
  _tenantSlug?: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const admin = createAdminClient()

    const { data: sub, error: fetchError } = await admin
      .from('monthly_subscriptions')
      .select('tenant_id')
      .eq('id', subscriptionId)
      .single()

    if (fetchError || !sub) {
      return { success: false, message: 'Assinatura não encontrada.' }
    }

    await requireTenantStaff(sub.tenant_id)

    const { error } = await admin
      .from('monthly_subscriptions')
      .update({ status: newStatus })
      .eq('id', subscriptionId)

    const labels = {
      active: 'Assinatura ativada com sucesso!',
      overdue: 'Assinatura marcada como inadimplente.',
      cancelled: 'Assinatura cancelada com sucesso.',
    }

    return { success: true, message: labels[newStatus] || `Assinatura atualizada para "${newStatus}".` }
  } catch (err: any) {
    return { success: false, message: err.message || 'Erro de autorização.' }
  }
}

export async function checkSubscriberStatus(
  tenantSlugOrId: string,
  clientPhone: string,
): Promise<{
  isSubscriber: boolean
  hasCutsRemaining: boolean
  subscription: PublicMonthlySubscriber | null
}> {
  const admin = createAdminClient()
  const tenantId = await resolveTenantId(tenantSlugOrId)
  const cleanPhone = normalizePhone(clientPhone)

  if (!cleanPhone) {
    return { isSubscriber: false, hasCutsRemaining: false, subscription: null }
  }

  const today = new Date().toISOString().slice(0, 10)

  const { data } = await admin
    .from('monthly_subscriptions')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('client_phone', cleanPhone)
    .eq('status', 'active')
    .gte('cycle_end_date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) {
    return { isSubscriber: false, hasCutsRemaining: false, subscription: null }
  }

  const sub: PublicMonthlySubscriber = {
    plan_name: data.plan_name,
    cuts_remaining: Number(data.cuts_remaining || 0),
  }

  return {
    isSubscriber: true,
    hasCutsRemaining: sub.cuts_remaining > 0,
    subscription: sub,
  }
}

export async function consumeSubscriberCut(
  subscriptionId: string,
  tenantSlug: string,
): Promise<{ success: boolean; message: string; cutsRemaining?: number }> {
  const admin = createAdminClient()
  const tenantId = await resolveTenantId(tenantSlug)
  await requireTenantStaff(tenantId)
  const { data: sub } = await admin
    .from('monthly_subscriptions')
    .select('tenant_id')
    .eq('id', subscriptionId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (!sub) return { success: false, message: 'Assinatura não encontrada.' }

  const { data, error } = await (admin.rpc as any)('consume_monthly_subscription_cut', {
    p_subscription_id: subscriptionId,
    p_tenant_id: tenantId,
  })
  const nextCuts = typeof data === 'number' ? data : null
  if (error || nextCuts === null) {
    return { success: false, message: 'Assinatura inativa, vencida ou sem cortes restantes.' }
  }

  return {
    success: true,
    message: `Corte debitado com sucesso! Restam ${nextCuts} cortes no ciclo atual.`,
    cutsRemaining: nextCuts,
  }
}
