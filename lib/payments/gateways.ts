import 'server-only'

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { requireOwner } from '@/lib/auth/guards'
import type { Database, Json } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

export type GatewayProvider = Database['public']['Enums']['gateway_provider']
export type GatewayCredentials = Record<string, string | number | boolean | null>
export type PixCharge = { externalId: string; qrCode: string | null; qrCodeImage: string | null; checkoutUrl: string | null; expiresAt: string }

type Envelope = { v: 1; alg: 'A256GCM'; iv: string; tag: string; ciphertext: string }

function encryptionKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY
  if (!raw) throw new Error('Missing ENCRYPTION_KEY')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes encoded as base64')
  return key
}

function encrypt(value: GatewayCredentials): Envelope {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])
  return { v: 1, alg: 'A256GCM', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') }
}

function decrypt(value: Json): GatewayCredentials {
  if (!value || Array.isArray(value) || typeof value !== 'object' || value.v !== 1 || value.alg !== 'A256GCM') throw new Error('Invalid gateway credential envelope')
  const iv = Buffer.from(String(value.iv), 'base64')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(Buffer.from(String(value.tag), 'base64'))
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(String(value.ciphertext), 'base64')), decipher.final()]).toString('utf8')) as GatewayCredentials
}

function credential(credentials: GatewayCredentials, key: string): string {
  const value = credentials[key]
  if (typeof value !== 'string' || !value) throw new Error(`Gateway credential ${key} is missing`)
  return value
}

export async function getGatewayConnection(tenantId: string) {
  const admin = createAdminClient()
  const { data, error } = await admin.from('tenants').select('active_gateway,gateway_credentials').eq('id', tenantId).single()
  if (error || !data.active_gateway) throw new Error('Tenant does not have an active gateway')
  return { provider: data.active_gateway, credentials: decrypt(data.gateway_credentials) }
}

export async function connectGateway(tenantId: string, provider: GatewayProvider, credentials: GatewayCredentials): Promise<void> {
  await requireOwner(tenantId)
  if (provider === 'infinitepay') credential(credentials, 'handle')
  else credential(credentials, 'access_token')
  const admin = createAdminClient()
  const current = await admin.from('tenants').select('active_gateway').eq('id', tenantId).single()
  if (current.error) throw new Error('Unable to read gateway configuration')
  if (current.data.active_gateway) throw new Error('Disconnect the active gateway before connecting another provider')
  const result = await admin.from('tenants').update({ active_gateway: provider, gateway_credentials: encrypt(credentials) as Json }).eq('id', tenantId).is('active_gateway', null).select('id').maybeSingle()
  if (result.error || !result.data) throw new Error('Gateway connection changed concurrently; try again')
}

export async function disconnectGateway(tenantId: string): Promise<void> {
  await requireOwner(tenantId)
  const admin = createAdminClient()
  const { error } = await admin.from('tenants').update({ active_gateway: null, gateway_credentials: {} }).eq('id', tenantId)
  if (error) throw new Error('Unable to disconnect gateway')
}

const oauthConfig: Record<Exclude<GatewayProvider, 'infinitepay'>, { authorize: string; token: string; clientId: string | undefined; secret: string | undefined }> = {
  mercado_pago: { authorize: 'https://auth.mercadopago.com.br/authorization', token: 'https://api.mercadopago.com/oauth/token', clientId: process.env.MERCADO_PAGO_CLIENT_ID, secret: process.env.MERCADO_PAGO_CLIENT_SECRET },
  asaas: { authorize: process.env.ASAAS_OAUTH_AUTHORIZE_URL ?? 'https://www.asaas.com/oauth/authorize', token: process.env.ASAAS_OAUTH_TOKEN_URL ?? 'https://api.asaas.com/v3/oauth/token', clientId: process.env.ASAAS_CLIENT_ID, secret: process.env.ASAAS_CLIENT_SECRET },
  pagseguro: { authorize: process.env.PAGSEGURO_OAUTH_AUTHORIZE_URL ?? 'https://connect.pagseguro.uol.com.br/oauth2/authorize', token: process.env.PAGSEGURO_OAUTH_TOKEN_URL ?? 'https://api.pagseguro.com/oauth2/token', clientId: process.env.PAGSEGURO_CLIENT_ID, secret: process.env.PAGSEGURO_CLIENT_SECRET },
}

export async function beginGatewayOAuth(tenantId: string, provider: Exclude<GatewayProvider, 'infinitepay'>, redirectUri: string): Promise<string> {
  const owner = await requireOwner(tenantId)
  const config = oauthConfig[provider]
  if (!config.clientId || !config.secret) throw new Error(`${provider} OAuth credentials are not configured`)
  const state = randomBytes(32).toString('base64url')
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const secret = process.env.GATEWAY_OAUTH_STATE_SECRET
  if (!secret) throw new Error('Missing GATEWAY_OAUTH_STATE_SECRET')
  const stateHash = createHmac('sha256', secret).update(state).digest('hex')
  const admin = createAdminClient()
  const inserted = await admin.from('gateway_oauth_states').insert({ tenant_id: tenantId, provider, state_hash: stateHash, code_verifier_encrypted: encrypt({ verifier }) as Json, redirect_uri: redirectUri, created_by: owner.userId })
  if (inserted.error) throw new Error('Unable to initialize gateway authorization')
  const url = new URL(config.authorize)
  url.searchParams.set('response_type', 'code'); url.searchParams.set('client_id', config.clientId); url.searchParams.set('redirect_uri', redirectUri); url.searchParams.set('state', state); url.searchParams.set('code_challenge', challenge); url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

export async function completeGatewayOAuth(tenantId: string, provider: Exclude<GatewayProvider, 'infinitepay'>, state: string, code: string): Promise<void> {
  await requireOwner(tenantId)
  const secret = process.env.GATEWAY_OAUTH_STATE_SECRET
  if (!secret) throw new Error('Missing GATEWAY_OAUTH_STATE_SECRET')
  const hash = createHmac('sha256', secret).update(state).digest('hex')
  const admin = createAdminClient()
  const result = await admin.from('gateway_oauth_states').select('*').eq('tenant_id', tenantId).eq('provider', provider).eq('state_hash', hash).eq('status', 'pending').gt('expires_at', new Date().toISOString()).single()
  if (result.error) throw new Error('OAuth state is invalid or expired')
  const verifier = credential(decrypt(result.data.code_verifier_encrypted!), 'verifier')
  const config = oauthConfig[provider]
  const response = await fetch(config.token, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ grant_type: 'authorization_code', client_id: config.clientId, client_secret: config.secret, redirect_uri: result.data.redirect_uri, code, code_verifier: verifier }), cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`${provider} rejected OAuth token exchange`)
  const tokens = await response.json() as GatewayCredentials
  await connectGateway(tenantId, provider, tokens)
  await admin.from('gateway_oauth_states').update({ status: 'consumed' }).eq('id', result.data.id)
}

export async function createPixCharge(tenantId: string, appointmentId: string, amountCents: number, expiresAt: string, customer: { name: string; email?: string; phone: string }): Promise<PixCharge> {
  const { provider, credentials } = await getGatewayConnection(tenantId)
  const webhook = new URL(`/api/webhooks/gateways/${provider}`, process.env.NEXT_PUBLIC_APP_URL).toString()
  if (provider === 'infinitepay') {
    const response = await fetch('https://api.checkout.infinitepay.io/links', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handle: credential(credentials, 'handle'), order_nsu: appointmentId, items: [{ quantity: 1, price: amountCents, description: 'Sinal de reserva' }], webhook_url: webhook, redirect_url: process.env.NEXT_PUBLIC_APP_URL }), signal: AbortSignal.timeout(15_000) })
    const body = await response.json() as { url?: string; slug?: string }; if (!response.ok || !body.url) throw new Error('InfinitePay could not create checkout')
    return { externalId: body.slug ?? appointmentId, checkoutUrl: body.url, qrCode: null, qrCodeImage: null, expiresAt }
  }
  if (provider === 'asaas') {
    const token = credential(credentials, 'access_token'); const base = process.env.ASAAS_API_URL ?? 'https://api.asaas.com/v3'
    const customerResponse = await fetch(`${base}/customers`, { method: 'POST', headers: { access_token: token, 'content-type': 'application/json' }, body: JSON.stringify({ name: customer.name, email: customer.email, mobilePhone: customer.phone.replace(/^55/, ''), externalReference: `booking-${appointmentId}` }), signal: AbortSignal.timeout(15_000) })
    const customerBody = await customerResponse.json() as { id?: string }; if (!customerResponse.ok || !customerBody.id) throw new Error('Asaas could not create customer')
    const created = await fetch(`${base}/lean/payments`, { method: 'POST', headers: { access_token: token, 'content-type': 'application/json' }, body: JSON.stringify({ customer: customerBody.id, billingType: 'PIX', value: amountCents / 100, dueDate: expiresAt.slice(0, 10), externalReference: appointmentId }), signal: AbortSignal.timeout(15_000) })
    const payment = await created.json() as { id?: string }; if (!created.ok || !payment.id) throw new Error('Asaas could not create payment')
    const qr = await fetch(`${base}/payments/${payment.id}/pixQrCode`, { headers: { access_token: token }, signal: AbortSignal.timeout(15_000) }); const qrBody = await qr.json() as { payload?: string; encodedImage?: string }; if (!qr.ok) throw new Error('Asaas could not create Pix QR code')
    return { externalId: payment.id, qrCode: qrBody.payload ?? null, qrCodeImage: qrBody.encodedImage ?? null, checkoutUrl: null, expiresAt }
  }
  if (provider === 'mercado_pago') {
    if (!customer.email) throw new Error('Mercado Pago requires the customer email')
    const response = await fetch('https://api.mercadopago.com/v1/payments', { method: 'POST', headers: { authorization: `Bearer ${credential(credentials, 'access_token')}`, 'content-type': 'application/json', 'x-idempotency-key': appointmentId }, body: JSON.stringify({ transaction_amount: amountCents / 100, description: 'Sinal de reserva', payment_method_id: 'pix', external_reference: appointmentId, notification_url: webhook, payer: { email: customer.email } }), signal: AbortSignal.timeout(15_000) })
    const body = await response.json() as { id?: number; point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string } } }; if (!response.ok || !body.id) throw new Error('Mercado Pago could not create Pix payment'); const data = body.point_of_interaction?.transaction_data
    return { externalId: String(body.id), qrCode: data?.qr_code ?? null, qrCodeImage: data?.qr_code_base64 ?? null, checkoutUrl: data?.ticket_url ?? null, expiresAt }
  }
  const response = await fetch('https://api.pagseguro.com/orders', { method: 'POST', headers: { authorization: `Bearer ${credential(credentials, 'access_token')}`, 'content-type': 'application/json' }, body: JSON.stringify({ reference_id: appointmentId, customer: { name: customer.name, email: customer.email }, items: [{ reference_id: appointmentId, name: 'Sinal de reserva', quantity: 1, unit_amount: amountCents }], qr_codes: [{ amount: { value: amountCents }, expiration_date: expiresAt }], notification_urls: [webhook] }), signal: AbortSignal.timeout(15_000) })
  const body = await response.json() as { id?: string; qr_codes?: Array<{ text?: string; links?: Array<{ rel: string; href: string }> }> }; if (!response.ok || !body.id) throw new Error('PagBank could not create Pix order'); const qr = body.qr_codes?.[0]
  return { externalId: body.id, qrCode: qr?.text ?? null, qrCodeImage: qr?.links?.find((link) => link.rel === 'QRCODE.PNG')?.href ?? null, checkoutUrl: null, expiresAt }
}

export function safeEqualHex(left: string, right: string): boolean { const a = Buffer.from(left, 'hex'); const b = Buffer.from(right, 'hex'); return a.length === b.length && timingSafeEqual(a, b) }
