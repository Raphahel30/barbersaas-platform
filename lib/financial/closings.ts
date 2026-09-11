import 'server-only'

import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

type ClosingPeriod = Database['public']['Enums']['closing_period']
const UUID = /^[0-9a-f-]{36}$/i
const DATE = /^\d{4}-\d{2}-\d{2}$/
const cents = (value: number) => Math.round(value * 100)
const money = (value: number) => value / 100

export type CommissionCalculation = { serviceCommission: number; productCommission: number; totalCommission: number }
export type CashClosingResult = { id: string; servicesGross: number; productsGross: number; grossAmount: number; commissionDue: number; cashInHand: number; netTransferAmount: number; direction: 'owner_pays_barber' | 'barber_pays_owner' | 'settled' }

export async function calculateCommission(barberId: string, appointmentId: string): Promise<CommissionCalculation> {
  if (!UUID.test(barberId) || !UUID.test(appointmentId)) throw new Error('Invalid commission identifiers')
  const admin = createAdminClient()
  const [appointmentResult, barberResult] = await Promise.all([
    admin.from('appointments').select('*').eq('id', appointmentId).eq('barber_id', barberId).single(),
    admin.from('profiles').select('tenant_id,commission_percent').eq('id', barberId).eq('role', 'barber').single(),
  ])
  if (appointmentResult.error || barberResult.error) throw new Error('Appointment or barber was not found')
  const appointment = appointmentResult.data
  if (!['completed', 'no_show'].includes(appointment.status)) throw new Error('Commission requires a completed or no-show appointment')

  const existing = await admin.from('commissions').select('product_id,commission_amount,is_no_show').eq('appointment_id', appointmentId).eq('barber_id', barberId)
  if (existing.error) throw new Error('Unable to read existing commissions')
  const existingService = existing.data.find((item) => item.product_id === null)
  let serviceCents = existingService ? cents(existingService.commission_amount) : 0
  if (!existingService) {
    const base = appointment.status === 'no_show' ? cents(appointment.reservation_fee_paid) : cents(appointment.total_amount)
    const rate = appointment.status === 'no_show' ? 100 : barberResult.data.commission_percent
    serviceCents = Math.round(base * rate / 100)
    const inserted = await admin.from('commissions').insert({ tenant_id: appointment.tenant_id, barber_id: barberId, appointment_id: appointmentId, base_amount: money(base), rate_percent: rate, commission_amount: money(serviceCents), status: 'payable', is_no_show: appointment.status === 'no_show' })
    if (inserted.error && inserted.error.code !== '23505') throw new Error('Unable to register service commission')
  }

  const settings = await admin.from('tenant_settings').select('enable_product_commission').eq('tenant_id', appointment.tenant_id).single()
  if (settings.error) throw new Error('Unable to load product commission setting')
  let productCents = 0
  if (settings.data.enable_product_commission) {
    const sales = await admin.from('product_sales').select('*').eq('appointment_id', appointmentId).eq('barber_id', barberId)
    if (sales.error) throw new Error('Unable to load product sales')
    for (const sale of sales.data) {
      const already = existing.data.find((item) => item.product_id === sale.product_id)
      if (already) { productCents += cents(already.commission_amount); continue }
      const product = await admin.from('products').select('commission_percent,commission_fixed').eq('id', sale.product_id).single()
      if (product.error) throw new Error('Unable to load product commission rule')
      const calculated = product.data.commission_fixed > 0 ? cents(product.data.commission_fixed) * sale.quantity : Math.round(cents(sale.total_amount) * product.data.commission_percent / 100)
      productCents += calculated
      const inserted = await admin.from('commissions').insert({ tenant_id: appointment.tenant_id, barber_id: barberId, appointment_id: appointmentId, product_id: sale.product_id, base_amount: sale.total_amount, rate_percent: product.data.commission_percent, fixed_amount: product.data.commission_fixed, commission_amount: money(calculated), status: 'payable' })
      if (inserted.error) throw new Error('Unable to register product commission')
    }
  }
  return { serviceCommission: money(serviceCents), productCommission: money(productCents), totalCommission: money(serviceCents + productCents) }
}

export async function generateCashClosing(tenantId: string, barberId: string, periodType: ClosingPeriod, startDate: string, endDate: string): Promise<CashClosingResult> {
  if (!UUID.test(tenantId) || !UUID.test(barberId) || !DATE.test(startDate) || !DATE.test(endDate) || startDate > endDate) throw new Error('Invalid closing parameters')
  const admin = createAdminClient(); const from = `${startDate}T00:00:00.000Z`; const toDate = new Date(`${endDate}T00:00:00.000Z`); toDate.setUTCDate(toDate.getUTCDate() + 1)
  const [appointments, sales, commissions] = await Promise.all([
    admin.from('appointments').select('total_amount,cash_received_by_barber').eq('tenant_id', tenantId).eq('barber_id', barberId).eq('status', 'completed').gte('completed_at', from).lt('completed_at', toDate.toISOString()),
    admin.from('product_sales').select('total_amount').eq('tenant_id', tenantId).eq('barber_id', barberId).gte('sold_at', from).lt('sold_at', toDate.toISOString()),
    admin.from('commissions').select('commission_amount').eq('tenant_id', tenantId).eq('barber_id', barberId).in('status', ['payable', 'pending']).gte('created_at', from).lt('created_at', toDate.toISOString()),
  ])
  if (appointments.error || sales.error || commissions.error) throw new Error('Unable to consolidate closing data')
  const serviceCents = appointments.data.reduce((sum, row) => sum + cents(row.total_amount), 0); const productCents = sales.data.reduce((sum, row) => sum + cents(row.total_amount), 0); const commissionCents = commissions.data.reduce((sum, row) => sum + cents(row.commission_amount), 0); const cashCents = appointments.data.reduce((sum, row) => sum + cents(row.cash_received_by_barber), 0); const net = commissionCents - cashCents
  const saved = await admin.from('cash_closings').upsert({ tenant_id: tenantId, barber_id: barberId, period: periodType, period_start: startDate, period_end: endDate, gross_amount: money(serviceCents + productCents), services_gross_amount: money(serviceCents), products_gross_amount: money(productCents), commission_amount: money(commissionCents), cash_in_hand: money(cashCents), closed_at: new Date().toISOString() }, { onConflict: 'tenant_id,barber_id,period,period_start,period_end' }).select('id').single()
  if (saved.error) throw new Error('Unable to save cash closing')
  return { id: saved.data.id, servicesGross: money(serviceCents), productsGross: money(productCents), grossAmount: money(serviceCents + productCents), commissionDue: money(commissionCents), cashInHand: money(cashCents), netTransferAmount: money(net), direction: net > 0 ? 'owner_pays_barber' : net < 0 ? 'barber_pays_owner' : 'settled' }
}
