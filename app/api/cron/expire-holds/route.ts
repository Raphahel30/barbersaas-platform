import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { expireUnclaimedWaitlistOffers } from '@/lib/booking/waitlist'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const nowIso = new Date().toISOString()

    // 1. Busca agendamentos em 'hold' que já ultrapassaram o tempo limite
    const { data: expiredHolds, error: selectError } = await admin
      .from('appointments')
      .select('id, tenant_id, guest_phone, notes, hold_expires_at')
      .eq('status', 'hold')
      .lte('hold_expires_at', nowIso)

    if (selectError) {
      return NextResponse.json(
        { error: 'Falha ao buscar agendamentos expirados.', details: selectError.message },
        { status: 500 },
      )
    }

    // 1.1 Expira ofertas de lista de espera com mais de 10 minutos sem confirmação
    let waitlistExpiredCount = 0
    try {
      const wlRes = await expireUnclaimedWaitlistOffers()
      waitlistExpiredCount = wlRes.expiredCount
    } catch (wlErr) {
      console.error('[Cron Expire Holds] Erro ao expirar lista de espera:', wlErr)
    }

    if (!expiredHolds || expiredHolds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum hold provisório expirado no momento.',
        expiredCount: 0,
        waitlistExpiredCount,
        timestamp: nowIso,
      })
    }

    const expiredIds = expiredHolds.map((h) => h.id)

    // 2. Estorno atômico de cortes para mensalistas com hold não confirmado
    for (const hold of expiredHolds) {
      const isMonthly = hold.notes?.includes('[MENSALISTA VIP]')
      if (isMonthly && hold.guest_phone) {
        const cleanPhone = hold.guest_phone.replace(/\D/g, '')
        try {
          const { data: sub } = await admin
            .from('monthly_subscriptions')
            .select('id, cuts_remaining')
            .eq('tenant_id', hold.tenant_id)
            .ilike('client_phone', `%${cleanPhone.slice(-8)}%`)
            .eq('status', 'active')
            .limit(1)
            .maybeSingle()

          if (sub) {
            await admin
              .from('monthly_subscriptions')
              .update({
                cuts_remaining: (sub.cuts_remaining || 0) + 1,
              })
              .eq('id', sub.id)
          }
        } catch (subErr) {
          console.error('[Cron Expire Holds] Erro ao estornar corte de mensalista:', subErr)
        }
      }
    }

    // 3. Atualiza status para 'cancelled', liberando o slot imediatamente para o motor de busca
    const { error: updateError } = await admin
      .from('appointments')
      .update({
        status: 'cancelled',
        cancelled_by: 'super_admin',
        cancellation_reason: 'Hold provisório de 5 minutos expirado sem confirmação de pagamento Pix.',
        cancelled_at: nowIso,
        updated_at: nowIso,
      })
      .in('id', expiredIds)

    if (updateError) {
      return NextResponse.json(
        { error: 'Falha ao cancelar agendamentos expirados.', details: updateError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: `${expiredIds.length} hold(s) provisório(s) expirado(s) e liberado(s) com sucesso.`,
      expiredCount: expiredIds.length,
      expiredAppointmentIds: expiredIds,
      timestamp: nowIso,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Erro interno ao processar expiração de holds.',
        details: err instanceof Error ? err.message : 'Erro desconhecido',
      },
      { status: 500 },
    )
  }
}
