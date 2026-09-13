import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { getGatewayConnection, safeEqualHex, type GatewayProvider } from '@/lib/payments/gateways'
import { dispatchAppointmentNotifications } from '@/lib/services/whatsapp'
import { createAdminClient } from '@/utils/supabase/admin'

const PROVIDERS = new Set<GatewayProvider>(['mercado_pago', 'asaas', 'pagseguro', 'infinitepay'])
type Payload = Record<string, unknown>

const text = (value: unknown): string | null =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : null

function equal(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  return a.length === b.length && timingSafeEqual(a, b)
}

function verifyOrigin(provider: GatewayProvider, request: Request, payload: Payload): boolean {
  if (provider === 'mercado_pago') {
    const signature = request.headers.get('x-signature')
    const requestId = request.headers.get('x-request-id')
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
    const data = payload.data as Payload | undefined
    const dataId = text(data?.id)
    if (!signature || !requestId || !secret || !dataId) return false
    const parts = Object.fromEntries(
      signature.split(',').map((part) => part.trim().split('=', 2)),
    )
    if (!parts.ts || !parts.v1) return false
    return safeEqualHex(
      createHmac('sha256', secret)
        .update(`id:${dataId};request-id:${requestId};ts:${parts.ts};`)
        .digest('hex'),
      parts.v1,
    )
  }

  const expected =
    provider === 'asaas'
      ? process.env.ASAAS_GATEWAY_WEBHOOK_TOKEN
      : provider === 'pagseguro'
      ? process.env.PAGSEGURO_WEBHOOK_TOKEN
      : process.env.INFINITEPAY_WEBHOOK_TOKEN

  // Se o segredo do provedor não estiver configurado no ambiente, rejeitar imediatamente por segurança
  if (!expected) {
    console.error(`Webhook secret missing in environment variables for provider: ${provider}`)
    return false
  }

  const received =
    provider === 'asaas'
      ? request.headers.get('asaas-access-token')
      : request.headers.get('x-webhook-token') ??
        request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')

  return Boolean(received && equal(expected, received))
}

async function confirmedPayment(provider: GatewayProvider, payload: Payload) {
  const data = payload.data as Payload | undefined
  const externalId =
    provider === 'mercado_pago'
      ? text(data?.id)
      : provider === 'asaas'
      ? text((payload.payment as Payload | undefined)?.id)
      : provider === 'pagseguro'
      ? text(payload.id)
      : text(payload.order_nsu)

  const appointmentHint =
    provider === 'asaas'
      ? text((payload.payment as Payload | undefined)?.externalReference)
      : provider === 'pagseguro' || provider === 'infinitepay'
      ? text(payload.reference_id ?? payload.order_nsu)
      : null

  const admin = createAdminClient()
  const candidate = appointmentHint
    ? await admin.from('appointments').select('*').eq('id', appointmentHint).maybeSingle()
    : await admin
        .from('appointments')
        .select('*')
        .eq('gateway_payment_id', externalId ?? '')
        .maybeSingle()

  if (candidate.error || !candidate.data || !externalId) throw new Error('Appointment not found')
  const connection = await getGatewayConnection(candidate.data.tenant_id)
  if (connection.provider !== provider) throw new Error('Inactive gateway webhook')

  let paid = false
  let verifiedReference: string | null = null

  if (provider === 'mercado_pago') {
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(externalId)}`,
      {
        headers: { authorization: `Bearer ${String(connection.credentials.access_token)}` },
      },
    )
    const body = (await response.json()) as Payload
    paid = response.ok && body.status === 'approved'
    verifiedReference = text(body.external_reference)
  }

  if (provider === 'asaas') {
    const base = process.env.ASAAS_API_URL ?? 'https://api.asaas.com/v3'
    const response = await fetch(`${base}/payments/${encodeURIComponent(externalId)}`, {
      headers: { access_token: String(connection.credentials.access_token) },
    })
    const body = (await response.json()) as Payload
    paid = response.ok && ['RECEIVED', 'CONFIRMED'].includes(String(body.status))
    verifiedReference = text(body.externalReference)
  }

  if (provider === 'pagseguro') {
    const response = await fetch(
      `https://api.pagseguro.com/orders/${encodeURIComponent(externalId)}`,
      {
        headers: { authorization: `Bearer ${String(connection.credentials.access_token)}` },
      },
    )
    const body = (await response.json()) as Payload
    const charges = body.charges as Payload[] | undefined
    paid = response.ok && Boolean(charges?.some((charge) => charge.status === 'PAID'))
    verifiedReference = text(body.reference_id)
  }

  if (provider === 'infinitepay') {
    const response = await fetch('https://api.checkout.infinitepay.io/payment_check', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        handle: connection.credentials.handle,
        order_nsu: candidate.data.id,
        transaction_nsu: payload.transaction_nsu,
        slug: payload.slug,
      }),
    })
    const body = (await response.json()) as Payload
    paid =
      response.ok &&
      body.paid === true &&
      Number(body.amount) === Math.round(candidate.data.reservation_fee * 100)
    verifiedReference = candidate.data.id
  }

  if (!paid || verifiedReference !== candidate.data.id) throw new Error('Payment is not confirmed')
  return { appointment: candidate.data, externalId }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider: rawProvider } = await context.params
  if (!PROVIDERS.has(rawProvider as GatewayProvider)) {
    return Response.json({ error: 'Unknown provider' }, { status: 404 })
  }
  const provider = rawProvider as GatewayProvider

  const raw = await request.text()
  let payload: Payload
  try {
    payload = JSON.parse(raw) as Payload
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // 1. Validação estrita de assinatura / token de webhook
  if (!verifyOrigin(provider, request, payload)) {
    return Response.json({ error: 'Unauthorized webhook request' }, { status: 401 })
  }

  const externalEventId =
    text(payload.id) ??
    text((payload.data as Payload | undefined)?.id) ??
    createHash('sha256').update(raw).digest('hex')
  const hash = createHash('sha256').update(raw).digest('hex')
  const admin = createAdminClient()

  const event = await admin
    .from('gateway_webhook_events')
    .insert({
      provider,
      external_event_id: externalEventId,
      payload_hash: hash,
    })
    .select('id')
    .maybeSingle()

  if (event.error?.code === '23505') {
    return Response.json({ received: true, duplicate: true })
  }
  if (event.error || !event.data) {
    return Response.json({ error: 'Unable to register event' }, { status: 500 })
  }

  try {
    const verified = await confirmedPayment(provider, payload)
    const appointment = verified.appointment

    // 2. Confirmação idempotente: Se já estiver confirmado ou agendado, ignorar evento duplicado graciosamente
    if (
      appointment.status === 'scheduled' ||
      appointment.status === 'confirmed' ||
      appointment.status === 'completed'
    ) {
      await admin
        .from('gateway_webhook_events')
        .update({
          appointment_id: appointment.id,
          status: 'processed',
          processed_at: new Date().toISOString(),
        })
        .eq('id', event.data.id)

      return Response.json({ received: true, already_confirmed: true })
    }

    if (
      appointment.status !== 'hold' ||
      !appointment.hold_expires_at ||
      Date.parse(appointment.hold_expires_at) <= Date.now()
    ) {
      throw new Error('Hold expired')
    }

    // Atualização atômica para status 'scheduled'
    const update = await admin
      .from('appointments')
      .update({
        status: 'scheduled',
        reservation_fee_paid: appointment.reservation_fee,
        payment_status: 'paid',
        payment_method: 'online_gateway',
        gateway_payment_id: verified.externalId,
        hold_expires_at: null,
      })
      .eq('id', appointment.id)
      .eq('status', 'hold')

    if (update.error) throw update.error

    await admin
      .from('gateway_webhook_events')
      .update({
        appointment_id: appointment.id,
        status: 'processed',
        processed_at: new Date().toISOString(),
      })
      .eq('id', event.data.id)

    await dispatchAppointmentNotifications(appointment.tenant_id, appointment.id, 'confirmation')
    return Response.json({ received: true })
  } catch (error) {
    await admin
      .from('gateway_webhook_events')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        processed_at: new Date().toISOString(),
      })
      .eq('id', event.data.id)

    return Response.json({ error: 'Payment was not confirmed' }, { status: 422 })
  }
}
