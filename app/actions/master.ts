'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { requireSuperAdmin } from '@/lib/auth/guards'
import { createAdminClient } from '@/utils/supabase/admin'
import { recordAuditLog } from '@/lib/logs/audit'

export type MasterTenant = {
  id: string
  name: string
  slug: string
  status: 'trial' | 'active' | 'past_due' | 'suspended'
  custom_domain: string | null
  created_at: string
  owner_name: string
  owner_email: string
  owner_phone: string
  plan_id: string | null
  plan_name: string
  monthly_price: number
}

export type MasterMetrics = {
  mrr: number
  activeTenants: number
  totalTenants: number
  trialTenants: number
  suspendedTenants: number
  monthlyGmv: number
  asaasBalance: number
}

export async function getMasterAdminData(): Promise<{
  metrics: MasterMetrics
  tenants: MasterTenant[]
  plans: Array<{ id: string; name: string; monthly_price: number }>
}> {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const [tenantsRes, plansRes, appointmentsRes, profilesRes] = await Promise.all([
    admin
      .from('tenants')
      .select('id, name, slug, status, custom_domain, plan_id, created_at, organization_id, plans(id, name, monthly_price)'),
    admin.from('plans').select('id, name, monthly_price').eq('is_active', true),
    admin
      .from('appointments')
      .select('total_amount, status, created_at')
      .eq('status', 'completed'),
    admin
      .from('profiles')
      .select('id, full_name, email, phone, tenant_id, role')
      .eq('role', 'owner'),
  ])

  const rawTenants = tenantsRes.data ?? []
  const plans = plansRes.data ?? []
  const owners = profilesRes.data ?? []
  const completedAppointments = appointmentsRes.data ?? []

  // Calcular métricas
  let mrr = 0
  let activeTenants = 0
  let trialTenants = 0
  let suspendedTenants = 0

  const tenants: MasterTenant[] = rawTenants.map((t) => {
    const planInfo = Array.isArray(t.plans) ? t.plans[0] : t.plans
    const planName = planInfo?.name || 'Plano Personalizado'
    const monthlyPrice = Number(planInfo?.monthly_price || 0)

    // MRR calculado exclusivamente a partir de assinaturas ativas pagantes (excluindo trial)
    if (t.status === 'active') {
      activeTenants += 1
      mrr += monthlyPrice
    } else if (t.status === 'trial') {
      trialTenants += 1
    } else if (t.status === 'suspended') {
      suspendedTenants += 1
    }

    const owner = owners.find((o) => o.tenant_id === t.id)

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: (t.status as 'trial' | 'active' | 'past_due' | 'suspended') || 'trial',
      custom_domain: t.custom_domain,
      created_at: t.created_at,
      owner_name: owner?.full_name || 'Administrador',
      owner_email: owner?.email || 'contato@barbearia.com',
      owner_phone: owner?.phone || '(11) 99999-9999',
      plan_id: t.plan_id,
      plan_name: planName,
      monthly_price: monthlyPrice,
    }
  })

  // GMV do mês corrente
  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const monthlyGmv = completedAppointments
    .filter((a) => new Date(a.created_at) >= currentMonthStart)
    .reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0)

  // Saldo real Asaas (consulta direta à API GET /v3/finance/balance)
  let asaasBalance = 0
  try {
    const apiKey = process.env.ASAAS_API_KEY || process.env.ASAAS_ACCESS_TOKEN
    const asaasUrl = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3'
    if (apiKey) {
      const res = await fetch(`${asaasUrl}/finance/balance`, {
        headers: {
          access_token: apiKey,
          'Content-Type': 'application/json',
        },
        next: { revalidate: 60 },
      })
      if (res.ok) {
        const balanceData = await res.json()
        asaasBalance = Number(balanceData.totalBalance || balanceData.balance || 0)
      }
    }
  } catch (err) {
    console.error('Erro ao consultar saldo real Asaas:', err)
  }

  return {
    metrics: {
      mrr: Math.round(mrr),
      activeTenants,
      totalTenants: rawTenants.length,
      trialTenants,
      suspendedTenants,
      monthlyGmv: Math.round(monthlyGmv),
      asaasBalance: Math.round(asaasBalance * 100) / 100,
    },
    tenants,
    plans,
  }
}

export async function toggleTenantStatus(
  tenantId: string,
  newStatus: 'active' | 'suspended'
): Promise<{ success: boolean; message: string }> {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('tenants')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId)

  if (error) {
    return { success: false, message: 'Falha ao atualizar o status da barbearia.' }
  }

  revalidatePath('/master-admin')
  return {
    success: true,
    message: `Barbearia ${newStatus === 'active' ? 'ativada' : 'suspensa'} com sucesso.`,
  }
}

export async function updateTenantPlan(
  tenantId: string,
  planId: string
): Promise<{ success: boolean; message: string }> {
  await requireSuperAdmin()
  const admin = createAdminClient()

  const { error } = await admin
    .from('tenants')
    .update({
      plan_id: planId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenantId)

  if (error) {
    return { success: false, message: 'Falha ao atualizar o plano da barbearia.' }
  }

  revalidatePath('/master-admin')
  return { success: true, message: 'Plano da barbearia atualizado com sucesso.' }
}

/**
 * Sessão de impersonação segura de tenant com registro em audit_logs e cookie auditado.
 */
export async function impersonateTenantAction(
  tenantId: string
): Promise<{ success: boolean; redirectUrl?: string; message?: string }> {
  const superAdmin = await requireSuperAdmin()
  const admin = createAdminClient()

  const { data: tenant, error } = await admin
    .from('tenants')
    .select('id, name, slug')
    .eq('id', tenantId)
    .single()

  if (error || !tenant) {
    return { success: false, message: 'Barbearia não encontrada.' }
  }

  // 1. Registro em audit_logs
  await recordAuditLog({
    tenantId: tenant.id,
    actorId: superAdmin.userId,
    actorEmail: superAdmin.email,
    actorRole: 'super_admin',
    action: 'impersonate_tenant',
    category: 'security',
    targetId: tenant.id,
    details: {
      impersonated_tenant_slug: tenant.slug,
      impersonated_tenant_name: tenant.name,
      timestamp: new Date().toISOString(),
    },
  })

  // 2. Cookie de impersonate auditado
  const cookieStore = await cookies()
  cookieStore.set('impersonate_tenant_id', tenant.id, {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 2, // 2 horas
  })

  return {
    success: true,
    redirectUrl: `/${tenant.slug}/admin`,
    message: `Acessando painel de ${tenant.name} com perfil auditado de suporte.`,
  }
}
