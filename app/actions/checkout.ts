'use server'

import { calculateCommission } from '@/lib/financial/closings'
import { createPixCharge } from '@/lib/payments/gateways'
import { awardFidelityStamp } from '@/lib/retention/fidelity'
import { deductConsumablesForAppointment } from '@/lib/inventory/consumables'
import { dispatchAppointmentNotifications } from '@/lib/services/whatsapp'
import { requireCurrentTenant } from '@/lib/tenant'
import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'
import { createClient } from '@/utils/supabase/server'

type CounterMethod = Extract<Database['public']['Enums']['payment_method'], 'cash' | 'card_machine' | 'pix_tenant'>
const UUID = /^[0-9a-f-]{36}$/i

async function identity() { const supabase = await createClient(); const { data } = await supabase.auth.getClaims(); const id = typeof data?.claims?.sub === 'string' ? data.claims.sub : ''; const profile = id ? await supabase.from('profiles').select('tenant_id,role').eq('id', id).maybeSingle() : { data: null }; return { id, profile: profile.data } }

export async function generateReservationFeePix(appointmentId: string) {
  if (!UUID.test(appointmentId)) return { success: false as const, message: 'Agendamento inválido.' }
  const tenantContext = await requireCurrentTenant()
  const admin = createAdminClient(); const appointment = await admin.from('appointments').select('*').eq('id', appointmentId).eq('status', 'hold').single()
  if (appointment.error || !appointment.data.hold_expires_at || Date.parse(appointment.data.hold_expires_at) <= Date.now()) return { success: false as const, message: 'A reserva expirou.' }
  if (tenantContext.id !== appointment.data.tenant_id) return { success: false as const, message: 'Barbearia inválida.' }
  const client = appointment.data.client_id ? await admin.from('profiles').select('full_name,email,phone').eq('id', appointment.data.client_id).single() : { data: null, error: null }
  const name = client.data?.full_name ?? appointment.data.guest_name ?? 'Cliente'; const phone = client.data?.phone ?? appointment.data.guest_phone; if (!phone) return { success: false as const, message: 'WhatsApp do cliente não informado.' }
  const expiry = appointment.data.hold_expires_at; const feeCents = Math.round(appointment.data.reservation_fee * 100)
  if (feeCents === 0) { await admin.from('appointments').update({ status: 'scheduled', hold_expires_at: null }).eq('id', appointmentId).eq('status', 'hold'); await dispatchAppointmentNotifications(appointment.data.tenant_id, appointmentId, 'confirmation'); return { success: true as const, data: { externalId: appointmentId, qrCode: null, qrCodeImage: null, checkoutUrl: null, expiresAt: expiry } } }
  try { const charge = await createPixCharge(appointment.data.tenant_id, appointmentId, feeCents, expiry, { name, phone, email: client.data?.email }); const updated = await admin.from('appointments').update({ gateway_payment_id: charge.externalId, payment_method: 'online_gateway' }).eq('id', appointmentId).eq('status', 'hold'); if (updated.error) throw new Error('Unable to link checkout'); return { success: true as const, data: charge } } catch (error) { return { success: false as const, message: error instanceof Error ? error.message : 'Não foi possível gerar o Pix.' } }
}

export async function settleAppointmentBalance(appointmentId: string, paymentMethod: CounterMethod) {
  if (!UUID.test(appointmentId) || !['cash', 'card_machine', 'pix_tenant'].includes(paymentMethod)) return { success: false as const, message: 'Dados de quitação inválidos.' }
  const actor = await identity(); const admin = createAdminClient(); const appointment = await admin.from('appointments').select('*').eq('id', appointmentId).single()
  if (appointment.error || !actor.profile || actor.profile.tenant_id !== appointment.data.tenant_id || !['owner', 'barber', 'receptionist'].includes(actor.profile.role) || (actor.profile.role === 'barber' && actor.id !== appointment.data.barber_id)) return { success: false as const, message: 'Operação não autorizada.' }
  if (!['scheduled', 'confirmed'].includes(appointment.data.status)) return { success: false as const, message: 'Atendimento não está disponível para quitação.' }
  const balanceCents = Math.max(0, Math.round((appointment.data.total_amount - appointment.data.reservation_fee_paid) * 100)); const balance = balanceCents / 100
  const updated = await admin.from('appointments').update({ status: 'completed', balance_paid_amount: balance, cash_received_by_barber: paymentMethod === 'cash' ? balance : 0, payment_method: paymentMethod, payment_status: 'paid', settled_at: new Date().toISOString(), completed_at: new Date().toISOString() }).eq('id', appointmentId).in('status', ['scheduled', 'confirmed']).select('id').maybeSingle()
  if (updated.error || !updated.data) return { success: false as const, message: 'O atendimento já foi quitado ou alterado.' }
  if (appointment.data.client_id) {
    try {
      await awardFidelityStamp(appointment.data.tenant_id, appointment.data.client_id, appointmentId)
    } catch (stampErr) {
      console.error('Falha ao conceder selo automaticamente:', stampErr)
    }
  }
  try {
    await deductConsumablesForAppointment(appointmentId)
  } catch (consumablesErr) {
    console.error('Falha ao dar baixa automática nos insumos:', consumablesErr)
  }
  try {
    await admin
      .from('customer_tabs')
      .update({
        status: 'closed',
        payment_method: paymentMethod,
        closed_at: new Date().toISOString(),
      })
      .eq('appointment_id', appointmentId)
      .eq('status', 'open')
  } catch (tabErr) {
    console.error('Falha ao fechar comanda de bar vinculada:', tabErr)
  }
  try { const commission = await calculateCommission(appointment.data.barber_id, appointmentId); return { success: true as const, data: { balancePaid: balance, cashRetainedByBarber: paymentMethod === 'cash' ? balance : 0, commission } } } catch { return { success: false as const, message: 'Pagamento registrado, mas a comissão precisa de revisão.' } }
}
