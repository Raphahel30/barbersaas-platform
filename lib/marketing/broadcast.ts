import 'server-only'

import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type CampaignSegment =
  | 'vip'
  | 'inactive_45d'
  | 'beard_clients'
  | 'birthdays'
  | 'barber_specific'
  | 'all'

export type SegmentedRecipient = {
  clientId: string
  name: string
  phone: string
  lastVisitDate?: string
  totalVisits: number
  segmentMatched: string
}

/**
 * Algoritmo Spintax para variações de texto randômicas.
 * Substitui padrões como "{Olá|Fala|E aí}" para impedir detecção de spam pelo WhatsApp.
 */
export function parseSpintax(text: string): string {
  // Faz match apenas de blocos {opção1|opção2} que contenham o caractere pipe "|"
  const spintaxRegex = /\{([^{}]*\|[^{}]*)\}/g
  let result = text

  while (spintaxRegex.test(result)) {
    result = result.replace(spintaxRegex, (_match, group: string) => {
      const options = group.split('|')
      const chosen = options[Math.floor(Math.random() * options.length)]
      return chosen.trim()
    })
  }

  return result
}

/**
 * Renderiza o template de mensagem aplicando Spintax e substituindo variáveis do cliente.
 */
export function renderCampaignMessage(
  template: string,
  variables: {
    clientName: string
    tenantName: string
    bookingUrl?: string
    barberName?: string
  },
): string {
  const spintaxed = parseSpintax(template)
  const firstName = variables.clientName.split(' ')[0] || 'Amigo'

  return spintaxed
    .replace(/\{nome\}/gi, variables.clientName)
    .replace(/\{primeiro_nome\}/gi, firstName)
    .replace(/\{barbearia\}/gi, variables.tenantName)
    .replace(/\{link_agendamento\}/gi, variables.bookingUrl || 'https://barbersaas.com.br')
    .replace(/\{ultimo_barbeiro\}/gi, variables.barberName || 'Nossa Equipe')
    .trim()
}

/**
 * Calcula o atraso humanizado (Jitter) para disparos automatizados.
 * Retorna intervalo entre 30s e 90s, com pausa de 5 minutos a cada bloco de 20 envios.
 */
export function calculateAntiBanDelay(sentCountInBatch: number): {
  delaySeconds: number
  delayMs: number
  isBatchPause: boolean
} {
  if (sentCountInBatch > 0 && sentCountInBatch % 20 === 0) {
    const delaySeconds = 300
    return { delaySeconds, delayMs: delaySeconds * 1000, isBatchPause: true } // Pausa de 5 minutos a cada 20 envios
  }

  // Jitter randômico de 30 a 90 segundos
  const randomDelay = Math.floor(Math.random() * (90 - 30 + 1)) + 30
  return { delaySeconds: randomDelay, delayMs: randomDelay * 1000, isBatchPause: false }
}

/**
 * Consulta e segmenta clientes da barbearia com base nas regras de RFM e histórico.
 */
export async function querySegmentRecipients(
  tenantId: string,
  segment: CampaignSegment,
  targetBarberId?: string,
): Promise<SegmentedRecipient[]> {
  if (!UUID_REGEX.test(tenantId)) throw new Error('ID de barbearia inválido')

  const admin = createAdminClient()

  // Buscar todos os clientes da barbearia com telefone
  const clientsRes = await admin
    .from('profiles')
    .select('id, full_name, phone, birth_date, created_at')
    .eq('tenant_id', tenantId)
    .eq('role', 'client')
    .not('phone', 'is', null)

  if (clientsRes.error) {
    throw new Error(`Erro ao buscar clientes: ${clientsRes.error.message}`)
  }

  const clients = (clientsRes.data ?? []).filter(
    (c) => c.phone && c.phone.replace(/\D/g, '').length >= 10
  )

  if (clients.length === 0) return []

  const now = Date.now()
  const currentMonth = new Date().getMonth() + 1 // 1-12

  // Buscar atendimentos concluídos para cálculo de RFM
  const appointmentsRes = await admin
    .from('appointments')
    .select('id, client_id, barber_id, completed_at, status')
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .not('client_id', 'is', null)

  const appointments = appointmentsRes.data ?? []

  // Mapa de histórico por cliente
  const clientHistory = new Map<string, {
    totalVisits: number
    lastVisitDate: string
    barbersUsed: Set<string>
  }>()

  for (const appt of appointments) {
    if (!appt.client_id) continue
    const curr = clientHistory.get(appt.client_id) ?? {
      totalVisits: 0,
      lastVisitDate: appt.completed_at || '',
      barbersUsed: new Set<string>(),
    }

    curr.totalVisits += 1
    if (appt.completed_at && (!curr.lastVisitDate || appt.completed_at > curr.lastVisitDate)) {
      curr.lastVisitDate = appt.completed_at
    }
    if (appt.barber_id) curr.barbersUsed.add(appt.barber_id)

    clientHistory.set(appt.client_id, curr)
  }

  // Filtragem conforme o segmento
  const matchedRecipients: SegmentedRecipient[] = []

  for (const client of clients) {
    const history = clientHistory.get(client.id)
    const totalVisits = history?.totalVisits ?? 0
    const lastVisit = history?.lastVisitDate

    let match = false
    let segmentLabel = ''

    if (segment === 'all') {
      match = true
      segmentLabel = 'Todos os Clientes'
    } else if (segment === 'vip') {
      // Clientes com mais de 4 atendimentos (Alta Frequência)
      if (totalVisits >= 4) {
        match = true
        segmentLabel = 'VIP / Alta Frequência'
      }
    } else if (segment === 'inactive_45d') {
      // Clientes com mais de 45 dias sem visitar
      if (lastVisit) {
        const daysSince = Math.floor((now - new Date(lastVisit).getTime()) / (1000 * 60 * 60 * 24))
        if (daysSince >= 45) {
          match = true
          segmentLabel = `Inativo há ${daysSince} dias`
        }
      }
    } else if (segment === 'birthdays') {
      if (client.birth_date) {
        const parts = client.birth_date.split('-')
        const birthMonth = Number(parts[1])
        if (birthMonth === currentMonth) {
          match = true
          segmentLabel = 'Aniversariante do Mês'
        }
      }
    } else if (segment === 'barber_specific' && targetBarberId) {
      if (history?.barbersUsed.has(targetBarberId)) {
        match = true
        segmentLabel = 'Cliente do Barbeiro'
      }
    } else if (segment === 'beard_clients') {
      // Clientes que já fizeram barba (ou padrão de corte masculino)
      if (totalVisits >= 1) {
        match = true
        segmentLabel = 'Cliente de Barba'
      }
    }

    if (match) {
      matchedRecipients.push({
        clientId: client.id,
        name: client.full_name,
        phone: client.phone!,
        lastVisitDate: lastVisit,
        totalVisits,
        segmentMatched: segmentLabel,
      })
    }
  }

  return matchedRecipients
}
