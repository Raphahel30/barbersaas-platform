import { createHash, timingSafeEqual } from 'node:crypto'

import { createAdminClient } from '@/utils/supabase/admin'

type AsaasEvent = { id?: string; event?: string; payment?: { customer?: string; subscription?: string; externalReference?: string } }

function secureEqual(left: string, right: string): boolean { const a = Buffer.from(left); const b = Buffer.from(right); return a.length === b.length && timingSafeEqual(a, b) }

export async function POST(request: Request) {
  const expected = process.env.ASAAS_SAAS_WEBHOOK_TOKEN; const received = request.headers.get('asaas-access-token')
  if (!expected || !received || !secureEqual(expected, received)) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const raw = await request.text(); let event: AsaasEvent
  try { event = JSON.parse(raw) as AsaasEvent } catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }) }
  if (!event.id || !event.event || !event.payment) return Response.json({ error: 'Invalid payload' }, { status: 400 })
  if (!['PAYMENT_OVERDUE', 'PAYMENT_RECEIVED'].includes(event.event)) return Response.json({ received: true, ignored: true })
  const admin = createAdminClient(); let query = admin.from('tenants').select('id')
  if (event.payment.subscription) query = query.eq('asaas_subscription_id', event.payment.subscription)
  else if (event.payment.customer) query = query.eq('asaas_customer_id', event.payment.customer)
  else if (event.payment.externalReference) query = query.eq('id', event.payment.externalReference)
  else return Response.json({ error: 'Tenant reference missing' }, { status: 400 })
  const tenant = await query.maybeSingle(); if (tenant.error || !tenant.data) return Response.json({ error: 'Tenant not found' }, { status: 404 })
  const update = event.event === 'PAYMENT_OVERDUE'
    ? await admin.from('tenants').update({ past_due_since: new Date().toISOString(), status: 'past_due' }).eq('id', tenant.data.id).is('past_due_since', null)
    : await admin.from('tenants').update({ past_due_since: null, status: 'active' }).eq('id', tenant.data.id)
  if (update.error) return Response.json({ error: 'Update failed', trace: createHash('sha256').update(event.id).digest('hex').slice(0, 12) }, { status: 500 })
  return Response.json({ received: true })
}
