import 'server-only'

import type { Json } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

export type WhatsAppNotificationType = 'confirmation' | 'reminder' | 'cancellation'

export type WhatsAppDispatchResult = Readonly<{
  recipient: 'client' | 'internal'
  phone: string
  deliveredAutomatically: boolean
  manualUrl: string
  error?: string
}>

type MessageContext = {
  appointmentId: string
  clientName: string
  barberName: string
  services: string
  dateTime: string
  address: string
  cancellationUrl: string
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  throw new Error('Invalid Brazilian WhatsApp number')
}

export function createWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(message)}`
}

function formatAddress(address: Json): string {
  if (!address || Array.isArray(address) || typeof address !== 'object') return 'Consulte a unidade para o endereço.'
  const values = ['line1', 'city', 'state', 'postal_code']
    .map((key) => address[key])
    .filter((value): value is string | number => typeof value === 'string' || typeof value === 'number')
  return values.length > 0 ? values.join(', ') : 'Consulte a unidade para o endereço.'
}

function formatDateTime(isoDate: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(isoDate))
}

function buildMessage(type: WhatsAppNotificationType, context: MessageContext, internal: boolean): string {
  const audience = internal ? 'Novo atendimento na agenda' : `Olá, ${context.clientName}!`
  const details = [
    `Barbeiro: ${context.barberName}`,
    `Serviços: ${context.services}`,
    `Data e horário: ${context.dateTime}`,
    `Endereço: ${context.address}`,
  ].join('\n')

  if (type === 'confirmation') {
    return `${audience}\n\nAgendamento confirmado.\n${details}\n\nCancelar ou remarcar: ${context.cancellationUrl}`
  }
  if (type === 'reminder') {
    return `${audience}\n\nLembrete: seu atendimento começa em aproximadamente 4 horas.\n${details}\n\nCancelar ou remarcar: ${context.cancellationUrl}`
  }
  return `${audience}\n\nO agendamento foi cancelado.\n${details}\n\nCódigo do agendamento: ${context.appointmentId}`
}

function validateEvolutionUrl(value: string): URL {
  const url = new URL(value)
  const hostname = url.hostname.toLowerCase()
  const isPrivateIpv4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)
  if (url.protocol !== 'https:' || hostname === 'localhost' || hostname === '::1' || isPrivateIpv4) {
    throw new Error('Evolution API URL is not allowed')
  }
  return url
}

async function sendEvolutionMessage(
  apiUrl: string,
  apiKey: string,
  instance: string,
  phone: string,
  message: string,
): Promise<void> {
  const baseUrl = validateEvolutionUrl(apiUrl)
  const endpoint = new URL(`/message/sendText/${encodeURIComponent(instance)}`, baseUrl)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { apikey: apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({ number: normalizePhone(phone), text: message }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Evolution API returned HTTP ${response.status}`)
}

export async function dispatchAppointmentNotifications(
  tenantId: string,
  appointmentId: string,
  type: WhatsAppNotificationType,
): Promise<WhatsAppDispatchResult[]> {
  const admin = createAdminClient()
  const [appointmentResult, settingsResult, tenantResult, servicesResult] = await Promise.all([
    admin.from('appointments').select('*').eq('id', appointmentId).eq('tenant_id', tenantId).single(),
    admin.from('tenant_settings').select('*').eq('tenant_id', tenantId).single(),
    admin.from('tenants').select('address').eq('id', tenantId).single(),
    admin.from('appointment_services').select('service_name').eq('appointment_id', appointmentId),
  ])
  const queryError = [appointmentResult.error, settingsResult.error, tenantResult.error, servicesResult.error].find(Boolean)
  if (queryError) throw new Error(`Unable to prepare WhatsApp notification: ${queryError.message}`)

  const appointment = appointmentResult.data!
  const settings = settingsResult.data!
  const [barberResult, clientResult, receptionResult] = await Promise.all([
    admin.from('profiles').select('full_name,phone').eq('id', appointment.barber_id).single(),
    appointment.client_id
      ? admin.from('profiles').select('full_name,phone').eq('id', appointment.client_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    settings.notify_barber_on_booking
      ? admin.from('profiles').select('phone').eq('tenant_id', tenantId).eq('role', 'receptionist').eq('is_active', true)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (barberResult.error || clientResult.error || receptionResult.error) {
    throw new Error('Unable to load WhatsApp recipients')
  }

  const clientName = clientResult.data?.full_name ?? appointment.guest_name ?? 'cliente'
  const clientPhone = clientResult.data?.phone ?? appointment.guest_phone
  if (!clientPhone) throw new Error('Appointment does not have a client WhatsApp number')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) throw new Error('Missing NEXT_PUBLIC_APP_URL')
  const context: MessageContext = {
    appointmentId,
    clientName,
    barberName: barberResult.data!.full_name,
    services: servicesResult.data!.map((service) => service.service_name).join(', '),
    dateTime: formatDateTime(appointment.starts_at, settings.timezone),
    address: formatAddress(tenantResult.data!.address),
    cancellationUrl: new URL(`/cancelar/${appointmentId}`, appUrl).toString(),
  }
  const recipients: Array<{ recipient: 'client' | 'internal'; phone: string; message: string }> = [
    { recipient: 'client', phone: clientPhone, message: buildMessage(type, context, false) },
  ]

  if (settings.notify_barber_on_booking) {
    const internalPhones = [barberResult.data!.phone, ...(receptionResult.data ?? []).map((profile) => profile.phone)]
      .filter((phone): phone is string => Boolean(phone))
    for (const phone of new Set(internalPhones)) {
      recipients.push({ recipient: 'internal', phone, message: buildMessage(type, context, true) })
    }
  }

  return Promise.all(recipients.map(async ({ recipient, phone, message }) => {
    const manualUrl = createWhatsAppUrl(phone, message)
    if (!settings.evolution_api_enabled) {
      return Object.freeze({ recipient, phone: normalizePhone(phone), deliveredAutomatically: false, manualUrl })
    }
    if (!settings.evolution_api_url || !settings.evolution_api_key || !settings.evolution_instance) {
      return Object.freeze({ recipient, phone: normalizePhone(phone), deliveredAutomatically: false, manualUrl, error: 'Evolution API configuration is incomplete' })
    }
    try {
      await sendEvolutionMessage(settings.evolution_api_url, settings.evolution_api_key, settings.evolution_instance, phone, message)
      return Object.freeze({ recipient, phone: normalizePhone(phone), deliveredAutomatically: true, manualUrl })
    } catch (error) {
      return Object.freeze({ recipient, phone: normalizePhone(phone), deliveredAutomatically: false, manualUrl, error: error instanceof Error ? error.message : 'Evolution API request failed' })
    }
  }))
}
