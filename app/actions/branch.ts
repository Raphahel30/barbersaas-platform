'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { getConsolidatedNetworkMetrics, ConsolidatedNetworkResult } from '@/lib/branch/consolidation'

export async function getBranchNetworkAction(
  explicitOrgId?: string,
): Promise<{ success: boolean; data?: ConsolidatedNetworkResult; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let organizationId = explicitOrgId

    if (!organizationId) {
      if (!user) {
        // Fallback em ambiente local / homologação: busca primeira organização multi-branch
        const admin = createAdminClient()
        const { data: firstOrg } = await admin
          .from('organizations')
          .select('id')
          .limit(1)
          .single()
        organizationId = firstOrg?.id
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single()

        if (profile?.tenant_id) {
          const { data: tenant } = await supabase
            .from('tenants')
            .select('organization_id')
            .eq('id', profile.tenant_id)
            .single()

          organizationId = tenant?.organization_id
        }
      }
    }

    if (!organizationId) {
      return { success: false, error: 'Organização não encontrada.' }
    }

    const metrics = await getConsolidatedNetworkMetrics(organizationId, 30)
    return { success: true, data: metrics }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao buscar métricas da rede.',
    }
  }
}
