'use server'

import { createClient } from '@/utils/supabase/server'
import { identifyInactiveClients, dispatchRecallBatch, InactiveClient, BatchRecallResult } from '@/lib/retention/recall'

export async function getInactiveClientsAction(
  explicitTenantId?: string,
): Promise<{ success: boolean; data: InactiveClient[]; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let tenantId = explicitTenantId

    if (!tenantId) {
      if (!user) return { success: false, data: [], error: 'Não autenticado' }
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single()

      tenantId = profile?.tenant_id || undefined
    }

    if (!tenantId) {
      // Fallback para primeiro tenant ativo se em dev ou homologação
      const { data: firstTenant } = await supabase
        .from('tenants')
        .select('id')
        .limit(1)
        .single()
      tenantId = firstTenant?.id
    }

    if (!tenantId) {
      return { success: false, data: [], error: 'Tenant não identificado' }
    }

    const inactives = await identifyInactiveClients(tenantId, 7)
    return { success: true, data: inactives }
  } catch (err) {
    return {
      success: false,
      data: [],
      error: err instanceof Error ? err.message : 'Falha ao recuperar clientes inativos',
    }
  }
}

export async function dispatchRecallBatchAction(
  clientIds: string[],
  explicitTenantId?: string,
): Promise<{ success: boolean; result?: BatchRecallResult; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let tenantId = explicitTenantId

    if (!tenantId) {
      if (!user) return { success: false, error: 'Não autenticado' }
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single()

      tenantId = profile?.tenant_id || undefined
    }

    if (!tenantId) {
      const { data: firstTenant } = await supabase
        .from('tenants')
        .select('id')
        .limit(1)
        .single()
      tenantId = firstTenant?.id
    }

    if (!tenantId) {
      return { success: false, error: 'Tenant não identificado' }
    }

    const res = await dispatchRecallBatch(tenantId, clientIds)
    return { success: true, result: res }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao processar recall',
    }
  }
}
