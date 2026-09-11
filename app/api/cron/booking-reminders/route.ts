import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizedCron } from '@/lib/cron/auth'
import { dispatchAppointmentNotifications } from '@/lib/services/whatsapp'
import { createAdminClient } from '@/utils/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const now = new Date()

    // Janela de lembrete: 3h30m (210 min) a 4h00m (240 min) no futuro
    const windowStart = new Date(now.getTime() + 210 * 60_000).toISOString()
    const windowEnd = new Date(now.getTime() + 240 * 60_000).toISOString()

    // 1. Busca agendamentos confirmados ou agendados na janela de 4 horas
    const { data: upcomingAppointments, error: selectError } = await admin
      .from('appointments')
      .select('id, tenant_id, client_id, starts_at, guest_name, guest_phone, notes, status')
      .in('status', ['confirmed', 'scheduled'])
      .gte('starts_at', windowStart)
      .lte('starts_at', windowEnd)

    if (selectError) {
      return NextResponse.json(
        { error: 'Falha ao buscar agendamentos na janela de lembretes.', details: selectError.message },
        { status: 500 },
      )
    }

    if (!upcomingAppointments || upcomingAppointments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhum agendamento na janela de lembrete preventivo (3h30 a 4h00).',
        notifiedCount: 0,
        timestamp: now.toISOString(),
      })
    }

    // Filtra os que já receberam lembrete (marcador [LEMBRETE_ENVIADO] nas notas)
    const toNotify = upcomingAppointments.filter(
      (a) => !a.notes || !a.notes.includes('[LEMBRETE_ENVIADO]'),
    )

    if (toNotify.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Todos os agendamentos da janela já foram notificados anteriormente.',
        notifiedCount: 0,
        timestamp: now.toISOString(),
      })
    }

    const results: Array<{
      appointmentId: string
      status: string
      manualUrls?: string[]
      error?: string
    }> = []

    for (const appt of toNotify) {
      try {
        const dispatchResult = await dispatchAppointmentNotifications(
          appt.tenant_id,
          appt.id,
          'reminder',
        )

        // Marca que o lembrete foi processado para evitar duplicidade
        const updatedNotes = appt.notes
          ? `${appt.notes}\n[LEMBRETE_ENVIADO: ${new Date().toISOString()}]`
          : `[LEMBRETE_ENVIADO: ${new Date().toISOString()}]`

        await admin
          .from('appointments')
          .update({
            notes: updatedNotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', appt.id)

        results.push({
          appointmentId: appt.id,
          status: 'dispatched',
          manualUrls: dispatchResult.map((d) => d.manualUrl),
        })
      } catch (err) {
        results.push({
          appointmentId: appt.id,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Falha ao enviar notificação',
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: `${results.filter((r) => r.status === 'dispatched').length} lembrete(s) processado(s).`,
      notifiedCount: results.filter((r) => r.status === 'dispatched').length,
      details: results,
      timestamp: now.toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: 'Erro interno ao processar lembretes preventivos.',
        details: err instanceof Error ? err.message : 'Erro desconhecido',
      },
      { status: 500 },
    )
  }
}
