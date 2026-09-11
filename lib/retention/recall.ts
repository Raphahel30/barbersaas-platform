import 'server-only'

import { createAdminClient } from '@/utils/supabase/admin'
import { createWhatsAppUrl } from '@/lib/services/whatsapp'

export interface InactiveClient {
  clientId: string
  clientName: string
  clientPhone: string
  lastAppointmentId: string
  lastVisitDate: string
  daysSinceLastVisit: number
  averageCycleDays: number
  daysOverdue: number
  lastBarberId: string
  lastBarberName: string
  lastServiceName: string
  suggestedMessage: string
  whatsappUrl: string
}

export interface RecallTemplateParams {
  clientName: string
  clientPhone: string
  daysSinceLastVisit: number
  tenantName: string
  barberName: string
  tenantBookingUrl: string
}

export interface BatchRecallResult {
  totalRequested: number
  sentAutomatically: number
  manualFallbackCount: number
  failedCount: number
  details: Array<{
    clientId: string
    clientName: string
    phone: string
    deliveredAutomatically: boolean
    whatsappUrl: string
    error?: string
  }>
}

/**
 * Normaliza o nome do cliente pegando apenas o primeiro nome para uma abordagem mais amigável.
 */
function getFirstName(fullName: string): string {
  if (!fullName) return 'amigo'
  return fullName.trim().split(' ')[0]
}

/**
 * Gera o texto persuasivo de reativação com as tags dinâmicas preenchidas.
 */
export function buildRecallMessage(params: RecallTemplateParams): string {
  const firstName = getFirstName(params.clientName)
  return (
    `Fala ${firstName}, tudo bem? Notamos que já faz ${params.daysSinceLastVisit} dias desde o seu último corte aqui na ${params.tenantName}. ` +
    `Seu barbeiro ${params.barberName} está com horários disponíveis para esta semana! ` +
    `Agende direto aqui: ${params.tenantBookingUrl}`
  )
}

/**
 * Calcula o ciclo médio de retorno em dias de um cliente com base no histórico de cortes concluídos.
 * Retorna 25 dias como padrão se o cliente tiver menos de 2 atendimentos.
 */
export async function calculateClientReturnCycle(
  clientId: string,
  tenantId: string,
): Promise<number> {
  const admin = createAdminClient()

  const { data: appointments, error } = await admin
    .from('appointments')
    .select('starts_at')
    .eq('client_id', clientId)
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .order('starts_at', { ascending: true })

  if (error || !appointments || appointments.length < 2) {
    return 25 // Ciclo médio de retorno padrão da indústria de barbearias
  }

  const intervals: number[] = []
  for (let i = 1; i < appointments.length; i++) {
    const prev = new Date(appointments[i - 1].starts_at).getTime()
    const curr = new Date(appointments[i].starts_at).getTime()
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24))
    if (diffDays > 0 && diffDays < 180) {
      intervals.push(diffDays)
    }
  }

  if (intervals.length === 0) return 25

  const sum = intervals.reduce((acc, val) => acc + val, 0)
  return Math.round(sum / intervals.length)
}

/**
 * Identifica clientes inativos cujo último corte ultrapassou o ciclo médio em +7 dias (ou customizável)
 * e que NÃO possuem nenhum agendamento futuro marcado na barbearia.
 */
export async function identifyInactiveClients(
  tenantId: string,
  bufferDays: number = 7,
): Promise<InactiveClient[]> {
  const admin = createAdminClient()
  const now = new Date()

  // 1. Busca dados do tenant para montar a URL e nome da barbearia
  const { data: tenant, error: tenantError } = await admin
    .from('tenants')
    .select('name, slug, custom_domain')
    .eq('id', tenantId)
    .single()

  if (tenantError || !tenant) {
    throw new Error('Barbearia não encontrada para cálculo de recall.')
  }

  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'barbersaas.com.br'
  const bookingUrl = tenant.custom_domain
    ? `https://${tenant.custom_domain}`
    : `https://${tenant.slug}.${appDomain}`

  // 2. Busca todos os agendamentos concluídos com dados de cliente e barbeiro
  const { data: completedAppointments, error: aptError } = await admin
    .from('appointments')
    .select(`
      id,
      client_id,
      guest_name,
      guest_phone,
      starts_at,
      barber_id,
      barber:profiles!appointments_barber_id_fkey (id, full_name),
      client:profiles!appointments_client_id_fkey (id, full_name, phone)
    `)
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .order('starts_at', { ascending: false })

  if (aptError || !completedAppointments || completedAppointments.length === 0) {
    return []
  }

  // 3. Busca agendamentos futuros ou pendentes (para filtrar clientes com agendamento ativo)
  const { data: activeAppointments, error: activeError } = await admin
    .from('appointments')
    .select('client_id, guest_phone')
    .eq('tenant_id', tenantId)
    .in('status', ['confirmed', 'scheduled', 'hold'])
    .gte('starts_at', now.toISOString())

  if (activeError) {
    throw new Error('Falha ao verificar agendamentos futuros da barbearia.')
  }

  const activeClientIds = new Set<string>()
  const activePhones = new Set<string>()

  activeAppointments?.forEach((a) => {
    if (a.client_id) activeClientIds.add(a.client_id)
    if (a.guest_phone) activePhones.add(a.guest_phone.replace(/\D/g, ''))
  })

  // 4. Agrupa por cliente, pegando o agendamento concluído mais recente
  const clientMap = new Map<string, typeof completedAppointments[0]>()

  for (const apt of completedAppointments) {
    const key = apt.client_id || (apt.guest_phone ? apt.guest_phone.replace(/\D/g, '') : null)
    if (!key) continue

    // Se o cliente já tem horário futuro marcado, não é inativo
    if (apt.client_id && activeClientIds.has(apt.client_id)) continue
    if (apt.guest_phone && activePhones.has(apt.guest_phone.replace(/\D/g, ''))) continue

    if (!clientMap.has(key)) {
      clientMap.set(key, apt)
    }
  }

  const inactiveList: InactiveClient[] = []

  // 5. Analisa cada cliente para verificar se estourou o ciclo médio + buffer
  for (const [key, apt] of clientMap.entries()) {
    const clientName = (apt.client as { full_name?: string } | null)?.full_name || apt.guest_name || 'Cliente'
    const clientPhone = (apt.client as { phone?: string } | null)?.phone || apt.guest_phone || ''

    if (!clientPhone) continue // Sem telefone não é possível disparar recall via WhatsApp

    const lastVisitDate = new Date(apt.starts_at)
    const daysSince = Math.floor((now.getTime() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24))

    // Calcula o ciclo médio (ou fallback de 25 dias)
    const avgCycle = apt.client_id
      ? await calculateClientReturnCycle(apt.client_id, tenantId)
      : 25

    const thresholdDays = avgCycle + bufferDays

    // Se o cliente já passou da data esperada de retorno
    if (daysSince >= thresholdDays) {
      const barberName = (apt.barber as { full_name?: string } | null)?.full_name || 'Nosso barbeiro'

      // Busca o último serviço executado para enriquecer o contexto
      const { data: srvData } = await admin
        .from('appointment_services')
        .select('service_name')
        .eq('appointment_id', apt.id)
        .limit(1)

      const lastServiceName = srvData?.[0]?.service_name || 'Corte & Barba'

      const suggestedMessage = buildRecallMessage({
        clientName,
        clientPhone,
        daysSinceLastVisit: daysSince,
        tenantName: tenant.name,
        barberName,
        tenantBookingUrl: bookingUrl,
      })

      let whatsappUrl = ''
      try {
        whatsappUrl = createWhatsAppUrl(clientPhone, suggestedMessage)
      } catch {
        whatsappUrl = `https://wa.me/?text=${encodeURIComponent(suggestedMessage)}`
      }

      inactiveList.push({
        clientId: apt.client_id || key,
        clientName,
        clientPhone,
        lastAppointmentId: apt.id,
        lastVisitDate: apt.starts_at,
        daysSinceLastVisit: daysSince,
        averageCycleDays: avgCycle,
        daysOverdue: daysSince - avgCycle,
        lastBarberId: apt.barber_id,
        lastBarberName: barberName,
        lastServiceName,
        suggestedMessage,
        whatsappUrl,
      })
    }
  }

  // Ordena pelos mais urgentes (maior tempo de atraso relativo)
  return inactiveList.sort((a, b) => b.daysOverdue - a.daysOverdue)
}

/**
 * Disparo automático de recall em lote respeitando delay anti-ban (se Evolution API estiver ativa).
 */
export async function dispatchRecallBatch(
  tenantId: string,
  clientIds: string[],
): Promise<BatchRecallResult> {
  const admin = createAdminClient()

  // 1. Verifica se Evolution API está ativa no tenant
  const { data: settings, error: settingsError } = await admin
    .from('tenant_settings')
    .select('evolution_api_enabled, evolution_api_url, evolution_api_key, evolution_instance')
    .eq('tenant_id', tenantId)
    .single()

  if (settingsError || !settings) {
    throw new Error('Configurações da barbearia não encontradas.')
  }

  // 2. Obtém a lista atualizada de inativos
  const allInactive = await identifyInactiveClients(tenantId)
  const targetClients = allInactive.filter((c) => clientIds.includes(c.clientId))

  const results: BatchRecallResult['details'] = []
  let sentCount = 0
  let manualCount = 0
  let failCount = 0

  const canUseEvolution =
    settings.evolution_api_enabled &&
    Boolean(settings.evolution_api_url) &&
    Boolean(settings.evolution_api_key) &&
    Boolean(settings.evolution_instance)

  for (const client of targetClients) {
    if (canUseEvolution) {
      try {
        const baseUrl = new URL(settings.evolution_api_url!)
        const endpoint = new URL(
          `/message/sendText/${encodeURIComponent(settings.evolution_instance!)}`,
          baseUrl,
        )

        const digits = client.clientPhone.replace(/\D/g, '')
        const normalizedNumber = digits.startsWith('55') ? digits : `55${digits}`

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            apikey: settings.evolution_api_key!,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            number: normalizedNumber,
            text: client.suggestedMessage,
          }),
          cache: 'no-store',
          signal: AbortSignal.timeout(8000),
        })

        if (response.ok) {
          sentCount++
          results.push({
            clientId: client.clientId,
            clientName: client.clientName,
            phone: client.clientPhone,
            deliveredAutomatically: true,
            whatsappUrl: client.whatsappUrl,
          })
        } else {
          manualCount++
          results.push({
            clientId: client.clientId,
            clientName: client.clientName,
            phone: client.clientPhone,
            deliveredAutomatically: false,
            whatsappUrl: client.whatsappUrl,
            error: `Evolution API HTTP ${response.status}`,
          })
        }

        // Delay anti-ban de 1.8 segundos entre disparos consecutivos
        await new Promise((resolve) => setTimeout(resolve, 1800))
      } catch (err) {
        manualCount++
        results.push({
          clientId: client.clientId,
          clientName: client.clientName,
          phone: client.clientPhone,
          deliveredAutomatically: false,
          whatsappUrl: client.whatsappUrl,
          error: err instanceof Error ? err.message : 'Falha no disparo automático',
        })
      }
    } else {
      // Fallback para envio manual wa.me
      manualCount++
      results.push({
        clientId: client.clientId,
        clientName: client.clientName,
        phone: client.clientPhone,
        deliveredAutomatically: false,
        whatsappUrl: client.whatsappUrl,
      })
    }
  }

  return {
    totalRequested: targetClients.length,
    sentAutomatically: sentCount,
    manualFallbackCount: manualCount,
    failedCount: failCount,
    details: results,
  }
}
