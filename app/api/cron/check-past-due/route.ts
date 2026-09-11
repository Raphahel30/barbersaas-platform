import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()

    // 1. Carrega o prazo de carência configurado em system_settings (padrão 5 dias)
    const { data: settings } = await admin
      .from('system_settings')
      .select('grace_period_days')
      .eq('id', true)
      .maybeSingle()

    const graceDays = Number(settings?.grace_period_days ?? 5)

    // Data de corte: agora menos graceDays
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - graceDays)
    const cutoffIso = cutoffDate.toISOString()

    // 2. Busca tenants com status 'past_due' que excederam o prazo de carência
    const { data: overdueTenants, error: selectError } = await admin
      .from('tenants')
      .select('id, name, slug, past_due_since')
      .eq('status', 'past_due')
      .lte('past_due_since', cutoffIso)

    if (selectError) {
      return NextResponse.json(
        { error: 'Falha ao consultar barbearias inadimplentes.', details: selectError.message },
        { status: 500 },
      )
    }

    if (!overdueTenants || overdueTenants.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma barbearia com carência estourada no momento.',
        gracePeriodDays: graceDays,
        suspendedCount: 0,
        timestamp: new Date().toISOString(),
      })
    }

    const tenantIds = overdueTenants.map((t) => t.id)
    const nowIso = new Date().toISOString()

    // 3. Atualiza o status dos tenants para 'suspended'
    const { error: updateError } = await admin
      .from('tenants')
      .update({
        status: 'suspended',
        updated_at: nowIso,
      })
      .in('id', tenantIds)

    if (updateError) {
      return NextResponse.json(
        { error: 'Falha ao suspender barbearias inadimplentes.', details: updateError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: `${tenantIds.length} barbearia(s) suspensa(s) por excesso de carência (${graceDays} dias).`,
      gracePeriodDays: graceDays,
      suspendedCount: tenantIds.length,
      suspendedTenants: overdueTenants,
      timestamp: nowIso,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Erro interno ao processar suspensão de barbearias.',
        details: err instanceof Error ? err.message : 'Erro desconhecido',
      },
      { status: 500 },
    )
  }
}
