import { createAdminClient } from '@/utils/supabase/admin'
import type { Database } from '@/types/database.types'

export type ShiftType = 'morning' | 'afternoon' | 'night' | 'any'

export interface WaitlistRegistrationInput {
  tenantId: string
  clientId?: string | null
  guestName?: string | null
  guestPhone?: string | null
  barberId?: string | null
  requestedDate: string // YYYY-MM-DD
  preferredShift?: ShiftType
  serviceIds: string[]
}

export interface WaitlistCandidate {
  id: string
  tenantId: string
  clientId: string | null
  guestName: string | null
  guestPhone: string | null
  barberId: string | null
  requestedDate: string
  preferredShift: ShiftType
  serviceIds: string[]
  status: 'waiting' | 'notified' | 'claimed' | 'expired'
  claimToken: string | null
  notifiedAt: string | null
  expiresAt: string | null
  createdAt: string
}

export interface AutoFillResult {
  triggered: boolean
  notifiedCandidateId?: string
  clientPhone?: string
  claimToken?: string
  expiresAt?: string
  message?: string
}

/**
 * Determina o turno com base no horário (horário local / data)
 * Manhã: 00:00 - 11:59
 * Tarde: 12:00 - 17:59
 * Noite: 18:00 - 23:59
 */
export function getShiftFromDate(date: Date): 'morning' | 'afternoon' | 'night' {
  const hours = date.getHours()
  if (hours < 12) return 'morning'
  if (hours < 18) return 'afternoon'
  return 'night'
}

/**
 * Verifica se um horário de início de slot é compatível com o turno preferido do cliente
 */
export function isShiftCompatible(slotStartIso: string, preferredShift: ShiftType): boolean {
  if (preferredShift === 'any') return true
  const date = new Date(slotStartIso)
  return getShiftFromDate(date) === preferredShift
}

/**
 * Disparado quando um agendamento é cancelado ou marcado como no-show.
 * Localiza o primeiro cliente compatível da fila de espera e concede um hold exclusivo de 10 minutos.
 */
export async function triggerAutoFillForSlot(
  tenantId: string,
  barberId: string,
  startsAt: string,
  endsAt: string,
  options?: { appBaseUrl?: string }
): Promise<AutoFillResult> {
  const admin = createAdminClient()
  const slotDate = startsAt.slice(0, 10) // YYYY-MM-DD
  const slotTime = new Date(startsAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  // 1. Busca dados da barbearia e barbeiro para compor a mensagem
  const [tenantRes, barberRes] = await Promise.all([
    admin.from('tenants').select('name, slug').eq('id', tenantId).maybeSingle(),
    admin.from('profiles').select('full_name').eq('id', barberId).maybeSingle(),
  ])

  const tenantName = tenantRes.data?.name || 'Barbearia'
  const barberName = barberRes.data?.full_name || 'Profissional'

  // 2. Busca todos os candidatos na fila 'waiting' para este tenant e data
  const { data: queue, error: queueErr } = await admin
    .from('waitlist')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('requested_date', slotDate)
    .eq('status', 'waiting')
    .order('created_at', { ascending: true })

  if (queueErr || !queue || queue.length === 0) {
    return { triggered: false, message: 'Nenhum cliente na lista de espera para este dia.' }
  }

  // 3. Encontra o primeiro candidato compatível (barbeiro específico ou qualquer barbeiro, e turno compatível)
  const candidate = queue.find((entry) => {
    // Se o cliente escolheu um barbeiro específico, deve ser o mesmo
    if (entry.barber_id && entry.barber_id !== barberId) {
      return false
    }
    // Verifica turno
    const shift = (entry.preferred_shift as ShiftType) || 'any'
    return isShiftCompatible(startsAt, shift)
  })

  if (!candidate) {
    return { triggered: false, message: 'Nenhum cliente da fila compatível com este turno e barbeiro.' }
  }

  // 4. Gera claim token e validade exclusiva de 10 minutos
  const claimToken = crypto.randomUUID()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString() // 10 minutos
  const notifiedAt = now.toISOString()

  const { error: updateErr } = await admin
    .from('waitlist')
    .update({
      status: 'notified',
      claim_token: claimToken,
      notified_at: notifiedAt,
      expires_at: expiresAt,
    })
    .eq('id', candidate.id)
    .eq('status', 'waiting')

  if (updateErr) {
    return { triggered: false, message: 'Conflito ao reservar vaga para o candidato.' }
  }

  // 5. Monta link de reivindicação imediata
  const baseUrl = options?.appBaseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://barbersaas.com'
  const claimLink = `${baseUrl}/${tenantRes.data?.slug || tenantId}/espera/reivindicar?token=${claimToken}`

  const messageText = `Vaga aberta na ${tenantName}! O horário ${slotTime} com ${barberName} acabou de liberar. Você tem 10 minutos para garantir essa vaga: ${claimLink}`

  const targetPhone = candidate.guest_phone

  // 6. Envia WhatsApp caso a Evolution API esteja configurada no tenant
  if (targetPhone) {
    try {
      const { data: settings } = await admin
        .from('tenant_settings')
        .select('evolution_api_enabled, evolution_api_url, evolution_api_key, evolution_instance')
        .eq('tenant_id', tenantId)
        .maybeSingle()

      if (
        settings?.evolution_api_enabled &&
        settings.evolution_api_url &&
        settings.evolution_api_key &&
        settings.evolution_instance
      ) {
        const cleanPhone = targetPhone.replace(/\D/g, '')
        const normalizedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`

        await fetch(
          `${settings.evolution_api_url}/message/sendText/${encodeURIComponent(settings.evolution_instance)}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              apikey: settings.evolution_api_key,
            },
            body: JSON.stringify({
              number: normalizedPhone,
              text: messageText,
            }),
          }
        )
      }
    } catch (msgErr) {
      console.error('[Waitlist] Falha ao enviar WhatsApp para cliente da espera:', msgErr)
    }
  }

  return {
    triggered: true,
    notifiedCandidateId: candidate.id,
    clientPhone: targetPhone || undefined,
    claimToken,
    expiresAt,
    message: messageText,
  }
}

/**
 * Expira ofertas de lista de espera que ultrapassaram os 10 minutos e passa para o próximo da fila.
 */
export async function expireUnclaimedWaitlistOffers(
  tenantId?: string
): Promise<{ expiredCount: number; reallocatedCount: number }> {
  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  let query = admin
    .from('waitlist')
    .select('*')
    .eq('status', 'notified')
    .lt('expires_at', nowIso)

  if (tenantId) {
    query = query.eq('tenant_id', tenantId)
  }

  const { data: expiredOffers, error } = await query

  if (error || !expiredOffers || expiredOffers.length === 0) {
    return { expiredCount: 0, reallocatedCount: 0 }
  }

  let expiredCount = 0
  let reallocatedCount = 0

  for (const offer of expiredOffers) {
    // Marca como expirado
    const { error: expErr } = await admin
      .from('waitlist')
      .update({ status: 'expired' })
      .eq('id', offer.id)
      .eq('status', 'notified')

    if (!expErr) {
      expiredCount++
      // Tenta realocar para o próximo da fila no mesmo dia/barbeiro
      if (offer.barber_id) {
        // Horário estimado a partir de requested_date às 09:00 caso o slot não esteja gravado
        const simulatedStartsAt = `${offer.requested_date}T10:00:00.000Z`
        const simulatedEndsAt = `${offer.requested_date}T10:45:00.000Z`
        const reallocResult = await triggerAutoFillForSlot(
          offer.tenant_id,
          offer.barber_id,
          simulatedStartsAt,
          simulatedEndsAt
        )
        if (reallocResult.triggered) {
          reallocatedCount++
        }
      }
    }
  }

  return { expiredCount, reallocatedCount }
}
