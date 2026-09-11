import crypto from 'node:crypto'
import { createAdminClient } from '@/utils/supabase/admin'

export interface ICalEvent {
  id: string
  startsAt: string // ISO
  endsAt: string // ISO
  summary: string
  description?: string
  location?: string
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
}

/**
 * Formata uma data ISO para o formato UTC do padrão iCalendar RFC 5545: YYYYMMDDTHHMMSSZ
 */
export function formatToICalDate(isoString: string): string {
  const d = new Date(isoString)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Escapa caracteres especiais em strings de texto conforme RFC 5545
 */
export function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Gera um token criptográfico de autenticação para a URL de feed iCal do barbeiro
 */
export function generateBarberCalendarToken(barberId: string, tenantId: string): string {
  const secret =
    process.env.CALENDAR_FEED_SECRET ||
    process.env.SUPABASE_JWT_SECRET ||
    'barber-secret-calendar-feed-salt-token'
  return crypto.createHmac('sha256', secret).update(`${barberId}:${tenantId}`).digest('hex').slice(0, 32)
}

/**
 * Valida se o token fornecido confere com a assinatura autorizada para aquele barbeiro
 */
export function verifyBarberCalendarToken(barberId: string, tenantId: string, token: string): boolean {
  if (!token || typeof token !== 'string' || token.length !== 32) {
    return false
  }
  const expected = generateBarberCalendarToken(barberId, tenantId)
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf-8'), Buffer.from(token, 'utf-8'))
  } catch {
    return false
  }
}

/**
 * Constrói o corpo completo do arquivo de calendário iCal / Webcal (RFC 5545)
 */
export function buildICalFeed(barberName: string, events: ICalEvent[]): string {
  const nowUtc = formatToICalDate(new Date().toISOString())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//BarberSaaS//Agenda Barber Feed//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:Agenda Barber - ${escapeICalText(barberName)}`,
    'X-WR-TIMEZONE:America/Sao_Paulo',
  ]

  for (const event of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:appt-${event.id}@barbersaas.com`)
    lines.push(`DTSTAMP:${nowUtc}`)
    lines.push(`DTSTART:${formatToICalDate(event.startsAt)}`)
    lines.push(`DTEND:${formatToICalDate(event.endsAt)}`)
    lines.push(`SUMMARY:${escapeICalText(event.summary)}`)
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICalText(event.description)}`)
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeICalText(event.location)}`)
    }
    lines.push(`STATUS:${event.status || 'CONFIRMED'}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.join('\r\n') + '\r\n'
}

/**
 * Monta o feed iCal com os agendamentos ativos do barbeiro (últimos 14 dias até próximos 60 dias)
 */
export async function generateBarberICalFeed(
  barberId: string,
  token: string
): Promise<{ success: boolean; icsContent?: string; message?: string }> {
  const admin = createAdminClient()

  // 1. Busca dados do barbeiro
  const { data: barber, error: barberErr } = await admin
    .from('profiles')
    .select('id, full_name, tenant_id, role')
    .eq('id', barberId)
    .maybeSingle()

  if (barberErr || !barber || !barber.tenant_id) {
    return { success: false, message: 'Barbeiro não encontrado.' }
  }

  // 2. Valida o token de segurança
  const isValid = verifyBarberCalendarToken(barber.id, barber.tenant_id, token)
  if (!isValid) {
    return { success: false, message: 'Token de autorização do calendário inválido ou expirado.' }
  }

  // 3. Busca dados do tenant para o nome da loja e endereço
  const { data: tenant } = await admin
    .from('tenants')
    .select('name, address')
    .eq('id', barber.tenant_id)
    .maybeSingle()

  const tenantName = tenant?.name || 'Barbearia'
  const addr = tenant?.address && typeof tenant.address === 'object' ? (tenant.address as any) : {}
  const locationString = [addr.street, addr.number, addr.neighborhood, addr.city]
    .filter(Boolean)
    .join(', ')

  // 4. Busca agendamentos ativos (-14 dias até +60 dias)
  const pastLimit = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const futureLimit = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString()

  const { data: appointments, error: apptErr } = await admin
    .from('appointments')
    .select(`
      id,
      starts_at,
      ends_at,
      status,
      guest_name,
      guest_phone,
      total_amount,
      notes,
      profiles!appointments_client_id_fkey(full_name, phone),
      appointment_services(services(name))
    `)
    .eq('barber_id', barberId)
    .gte('starts_at', pastLimit)
    .lte('starts_at', futureLimit)
    .in('status', ['scheduled', 'confirmed', 'completed', 'arrived'])
    .order('starts_at', { ascending: true })

  if (apptErr) {
    return { success: false, message: 'Erro ao consultar agendamentos.' }
  }

  const events: ICalEvent[] = (appointments || []).map((appt: any) => {
    const clientName = appt.profiles?.full_name || appt.guest_name || 'Cliente'
    const clientPhone = appt.profiles?.phone || appt.guest_phone || 'Não informado'
    const servicesList = (appt.appointment_services || [])
      .map((as: any) => as.services?.name)
      .filter(Boolean)
      .join(' + ') || 'Atendimento'

    const statusLabel =
      appt.status === 'completed'
        ? 'Concluído'
        : appt.status === 'arrived'
          ? 'Cliente na Recepção'
          : 'Confirmado'

    const description = [
      `Cliente: ${clientName}`,
      `Telefone: ${clientPhone}`,
      `Serviços: ${servicesList}`,
      `Valor: R$ ${Number(appt.total_amount || 0).toFixed(2)}`,
      `Status: ${statusLabel}`,
      appt.notes ? `Obs: ${appt.notes}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    return {
      id: appt.id,
      startsAt: appt.starts_at,
      endsAt: appt.ends_at,
      summary: `${servicesList} - ${clientName}`,
      description,
      location: `${tenantName} (${locationString})`,
      status: 'CONFIRMED',
    }
  })

  const icsContent = buildICalFeed(barber.full_name, events)
  return { success: true, icsContent }
}

/**
 * Parser simplificado de datas no padrão iCal (YYYYMMDD ou YYYYMMDDTHHMMSSZ)
 */
function parseICalDateTime(raw: string): string | null {
  const clean = raw.trim().replace(/^VALUE=DATE-TIME:/, '').replace(/^VALUE=DATE:/, '')
  if (/^\d{8}T\d{6}Z?$/.test(clean)) {
    const year = clean.slice(0, 4)
    const month = clean.slice(4, 6)
    const day = clean.slice(6, 8)
    const hour = clean.slice(9, 11)
    const min = clean.slice(11, 13)
    const sec = clean.slice(13, 15)
    return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`).toISOString()
  }
  if (/^\d{8}$/.test(clean)) {
    const year = clean.slice(0, 4)
    const month = clean.slice(4, 6)
    const day = clean.slice(6, 8)
    return new Date(`${year}-${month}-${day}T00:00:00Z`).toISOString()
  }
  const parsed = Date.parse(clean)
  return isNaN(parsed) ? null : new Date(parsed).toISOString()
}

/**
 * Importa compromissos de um arquivo .ics externo (ex: Google Calendar ou Apple Calendar pessoal do barbeiro)
 * e os registra como bloqueios na tabela barber_blocked_slots para impedir agendamentos concorrentes.
 */
export async function importExternalBusySlots(
  tenantId: string,
  barberId: string,
  icsRawContent: string
): Promise<{ success: boolean; importedCount: number; message: string }> {
  const admin = createAdminClient()

  // Extrai blocos BEGIN:VEVENT ... END:VEVENT
  const eventRegex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g
  const matches = [...icsRawContent.matchAll(eventRegex)]

  if (matches.length === 0) {
    return { success: false, importedCount: 0, message: 'Nenhum evento encontrado no arquivo iCal informado.' }
  }

  const blockedSlotsToInsert: {
    tenant_id: string
    barber_id: string
    starts_at: string
    ends_at: string
    reason: string
  }[] = []

  const now = new Date()

  for (const match of matches) {
    const block = match[1]

    const dtStartMatch = block.match(/DTSTART(?:;[^:]+)?:([^\r\n]+)/)
    const dtEndMatch = block.match(/DTEND(?:;[^:]+)?:([^\r\n]+)/)
    const summaryMatch = block.match(/SUMMARY(?:;[^:]+)?:([^\r\n]+)/)

    if (dtStartMatch) {
      const startsAt = parseICalDateTime(dtStartMatch[1])
      let endsAt = dtEndMatch ? parseICalDateTime(dtEndMatch[1]) : null

      if (startsAt) {
        // Se não houver fim explícito, assume 1 hora de compromisso
        if (!endsAt) {
          endsAt = new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString()
        }

        // Ignora eventos que já terminaram no passado
        if (new Date(endsAt) > now) {
          const reasonText = summaryMatch
            ? `Compromisso Pessoal: ${summaryMatch[1].trim()}`
            : 'Compromisso Pessoal (iCal Externo)'

          blockedSlotsToInsert.push({
            tenant_id: tenantId,
            barber_id: barberId,
            starts_at: startsAt,
            ends_at: endsAt,
            reason: reasonText.slice(0, 100),
          })
        }
      }
    }
  }

  if (blockedSlotsToInsert.length === 0) {
    return { success: true, importedCount: 0, message: 'Nenhum compromisso futuro identificado para bloqueio.' }
  }

  const { error } = await admin.from('barber_blocked_slots').insert(blockedSlotsToInsert)

  if (error) {
    return { success: false, importedCount: 0, message: 'Falha ao salvar horários de bloqueio.' }
  }

  return {
    success: true,
    importedCount: blockedSlotsToInsert.length,
    message: `${blockedSlotsToInsert.length} compromissos pessoais importados e bloqueados na grade com sucesso!`,
  }
}
