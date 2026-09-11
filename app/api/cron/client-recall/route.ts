import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { createAdminClient } from '@/utils/supabase/admin'
import { identifyInactiveClients, dispatchRecallBatch } from '@/lib/retention/recall'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const now = new Date()

    // 1. Busca todos os tenants ativos com suas configurações
    const { data: tenants, error: tenantsError } = await admin
      .from('tenants')
      .select('id, name, status')
      .eq('status', 'active')

    if (tenantsError || !tenants) {
      return NextResponse.json(
        { error: 'Falha ao buscar barbearias ativas para recall.', details: tenantsError?.message },
        { status: 500 },
      )
    }

    const summary: Array<{
      tenantId: string
      tenantName: string
      inactiveCount: number
      autoDispatched: number
    }> = []

    for (const tenant of tenants) {
      try {
        const inactives = await identifyInactiveClients(tenant.id, 7)
        
        // Verifica se o tenant possui Evolution API configurada
        const { data: settings } = await admin
          .from('tenant_settings')
          .select('evolution_api_enabled')
          .eq('tenant_id', tenant.id)
          .single()

        let autoDispatchedCount = 0

        // Se o tenant tiver até 15 inativos e Evolution habilitada, processa recall
        if (settings?.evolution_api_enabled && inactives.length > 0) {
          const topBatch = inactives.slice(0, 10).map((c) => c.clientId)
          const batchResult = await dispatchRecallBatch(tenant.id, topBatch)
          autoDispatchedCount = batchResult.sentAutomatically
        }

        summary.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          inactiveCount: inactives.length,
          autoDispatched: autoDispatchedCount,
        })
      } catch (err) {
        summary.push({
          tenantId: tenant.id,
          tenantName: tenant.name,
          inactiveCount: 0,
          autoDispatched: 0,
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Varredura de recall de clientes inativos concluída.',
      tenantsScanned: tenants.length,
      summary,
      timestamp: now.toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Erro inesperado no cron de recall.', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
