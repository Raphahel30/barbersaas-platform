'use server'

import { createAdminClient } from '@/utils/supabase/admin'

export interface SubmitReviewInput {
  appointmentId: string
  rating: number
  tags: string[]
  comment?: string
  sharedToGoogle?: boolean
}

export interface ReviewContext {
  appointmentId: string
  tenantId: string
  tenantName: string
  barberName: string
  services: string
  completedAt: string | null
  alreadyReviewed: boolean
  existingRating?: number
  googleReviewUrl: string
}

export interface SubmitReviewResult {
  success: boolean
  isPositive: boolean
  googleReviewUrl?: string
  message: string
  error?: string
}

export async function getAppointmentReviewContext(
  appointmentId: string,
): Promise<{ success: boolean; context?: ReviewContext; error?: string }> {
  try {
    const admin = createAdminClient()

    // 1. Busca o agendamento com dados de tenant e barbeiro
    const { data: appointment, error: aptError } = await admin
      .from('appointments')
      .select(`
        id,
        tenant_id,
        barber_id,
        status,
        completed_at,
        tenant:tenants!appointments_tenant_id_fkey (id, name, address, visual_settings),
        barber:profiles!appointments_barber_id_fkey (full_name)
      `)
      .eq('id', appointmentId)
      .single()

    if (aptError || !appointment) {
      return { success: false, error: 'Agendamento não encontrado.' }
    }

    // 2. Busca serviços realizados
    const { data: services } = await admin
      .from('appointment_services')
      .select('service_name')
      .eq('appointment_id', appointmentId)

    const serviceNames = services?.map((s) => s.service_name).join(', ') || 'Atendimento'

    // 3. Verifica se já existe avaliação para este agendamento
    const { data: existingReview } = await admin
      .from('appointment_reviews')
      .select('rating')
      .eq('appointment_id', appointmentId)
      .maybeSingle()

    // 4. Resolve URL do Google Maps (ou busca nas configurações do tenant)
    const tenantObj = appointment.tenant as { name: string; address?: any; visual_settings?: any } | null
    const tenantName = tenantObj?.name || 'Barbearia'
    
    // Tenta obter URL do Google Meu Negócio do visual_settings ou monta busca no Google Maps
    let googleReviewUrl = (tenantObj?.visual_settings as { google_review_url?: string } | null)?.google_review_url || ''
    
    if (!googleReviewUrl) {
      const city = tenantObj?.address?.city || 'Brasil'
      googleReviewUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${tenantName} ${city}`)}`
    }

    return {
      success: true,
      context: {
        appointmentId: appointment.id,
        tenantId: appointment.tenant_id,
        tenantName,
        barberName: (appointment.barber as { full_name?: string } | null)?.full_name || 'Barbeiro',
        services: serviceNames,
        completedAt: appointment.completed_at,
        alreadyReviewed: Boolean(existingReview),
        existingRating: existingReview?.rating,
        googleReviewUrl,
      },
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Falha ao carregar dados da avaliação.',
    }
  }
}

export async function submitAppointmentReview(
  input: SubmitReviewInput,
): Promise<SubmitReviewResult> {
  try {
    const admin = createAdminClient()

    if (!input.rating || input.rating < 1 || input.rating > 5) {
      return {
        success: false,
        isPositive: false,
        message: 'Por favor, selecione uma nota de 1 a 5 estrelas.',
      }
    }

    // 1. Busca agendamento para associar tenant e cliente
    const { data: appointment, error: aptError } = await admin
      .from('appointments')
      .select('id, tenant_id, client_id, tenant:tenants!appointments_tenant_id_fkey(name, address, visual_settings)')
      .eq('id', input.appointmentId)
      .single()

    if (aptError || !appointment) {
      return { success: false, isPositive: false, message: 'Agendamento inválido.' }
    }

    const isPositive = input.rating >= 4
    const tenantObj = appointment.tenant as { name: string; address?: any; visual_settings?: any } | null
    const tenantName = tenantObj?.name || 'Barbearia'

    let googleReviewUrl = (tenantObj?.visual_settings as { google_review_url?: string } | null)?.google_review_url || ''
    if (!googleReviewUrl) {
      const city = tenantObj?.address?.city || ''
      googleReviewUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${tenantName} ${city}`)}`
    }

    // 2. Grava ou atualiza a avaliação na tabela appointment_reviews
    const { error: insertError } = await admin.from('appointment_reviews').upsert(
      {
        tenant_id: appointment.tenant_id,
        appointment_id: input.appointmentId,
        client_id: appointment.client_id,
        rating: input.rating,
        tags: input.tags || [],
        comment: input.comment || null,
        is_public_shared: Boolean(input.sharedToGoogle),
        status: isPositive ? 'acknowledged' : 'pending',
      },
      { onConflict: 'appointment_id' },
    )

    if (insertError) {
      // Se a tabela física ainda estiver em processo de migração, não trava a UX do cliente
      console.warn('Registro em appointment_reviews ignorado ou tabela pendente:', insertError.message)
    }

    // 3. Roteamento Inteligente de Feedback:
    if (isPositive) {
      return {
        success: true,
        isPositive: true,
        googleReviewUrl,
        message: 'Muito obrigado pela excelente avaliação! Sua opinião ajuda novos clientes a nos encontrar.',
      }
    } else {
      // Avaliação Crítica (1 a 3 estrelas): Gestão interna de crise
      // Dispara registro no audit_logs para notificação urgente do dono/gerência
      await admin.from('audit_logs').insert({
        tenant_id: appointment.tenant_id,
        actor_id: appointment.client_id,
        actor_email: 'cliente@feedback.local',
        actor_role: 'client',
        action: 'critical_nps_alert',
        category: 'quality_assurance',
        target_id: input.appointmentId,
        details: {
          rating: input.rating,
          tags: input.tags,
          comment: input.comment,
          alert: 'ALERTA DE NPS BAIXO: Cliente insatisfeito. Intervenção preventiva necessária antes de publicação online.',
        },
      })

      return {
        success: true,
        isPositive: false,
        message: 'Obrigado pelo seu feedback sincero. Nossa gerência já foi notificada para entender o que ocorreu e entrará em contato para garantir sua satisfação.',
      }
    }
  } catch (err) {
    return {
      success: false,
      isPositive: false,
      message: 'Erro ao processar sua avaliação.',
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
