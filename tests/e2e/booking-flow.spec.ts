import { test, expect } from '@playwright/test'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

function getTestAdminClient(): SupabaseClient {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    const envPath = path.resolve(process.cwd(), '.env.local')
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8')
      envContent.split('\n').forEach((line) => {
        const [key, ...vals] = line.split('=')
        if (key && vals.length) {
          const v = vals.join('=').trim().replace(/^["']|["']$/g, '')
          if (key.trim() === 'NEXT_PUBLIC_SUPABASE_URL' && !url) url = v
          if (key.trim() === 'SUPABASE_SERVICE_ROLE_KEY' && !serviceRoleKey) serviceRoleKey = v
        }
      })
    }
  }

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase environment variables are missing for tests')
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

test.describe('Fluxo Crítico de Agendamento Transacional e Pix', () => {
  let admin: SupabaseClient

  test.beforeAll(() => {
    admin = getTestAdminClient()
  })

  test('Cenário 1: Criação de reserva gera registro real no banco em status hold', async () => {
    // 1. Busca um tenant ativo com barbeiro e serviço
    const { data: tenant } = await admin
      .from('tenants')
      .select('id, slug')
      .eq('status', 'active')
      .limit(1)
      .single()

    expect(tenant).not.toBeNull()
    const tenantId = tenant!.id

    const { data: barber } = await admin
      .from('profiles')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('role', ['barber', 'owner'])
      .limit(1)
      .single()

    expect(barber).not.toBeNull()

    const { data: service } = await admin
      .from('services')
      .select('id, price, reservation_fee')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(1)
      .single()

    expect(service).not.toBeNull()

    // 2. Criação do hold atômico
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 2)
    tomorrow.setHours(10, 0, 0, 0)
    const startsAt = tomorrow.toISOString()
    const endsAt = new Date(tomorrow.getTime() + 30 * 60000).toISOString()

    const { data: rpcRes, error: rpcError } = await (admin as any).rpc(
      'create_appointment_hold_atomic',
      {
        p_tenant_id: tenantId,
        p_barber_id: barber!.id,
        p_service_ids: [service!.id],
        p_client_name: 'Teste E2E Hold',
        p_client_phone: '11999990001',
        p_starts_at: startsAt,
        p_ends_at: endsAt,
        p_total_amount: Number(service!.price),
        p_reservation_fee: Number(service!.reservation_fee),
        p_notes: 'E2E Hold Test',
      },
    )

    expect(rpcError).toBeNull()
    expect(rpcRes.success).toBe(true)
    expect(rpcRes.appointment_id).toBeDefined()

    const appointmentId = rpcRes.appointment_id

    // 3. Validação do registro no banco
    const { data: apt, error: aptError } = await admin
      .from('appointments')
      .select('id, status, hold_expires_at')
      .eq('id', appointmentId)
      .single()

    expect(aptError).toBeNull()
    expect(apt?.status).toBe('hold')
    expect(apt?.hold_expires_at).not.toBeNull()

    // Limpeza
    await admin.from('appointments').delete().eq('id', appointmentId)
  })

  test('Cenário 2: Simulação de confirmação de Pix altera status para scheduled/confirmed', async () => {
    const { data: tenant } = await admin
      .from('tenants')
      .select('id')
      .eq('status', 'active')
      .limit(1)
      .single()
    const tenantId = tenant!.id

    const { data: barber } = await admin
      .from('profiles')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('role', ['barber', 'owner'])
      .limit(1)
      .single()

    const { data: service } = await admin
      .from('services')
      .select('id, price, reservation_fee')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(1)
      .single()

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 3)
    futureDate.setHours(11, 0, 0, 0)
    const startsAt = futureDate.toISOString()
    const endsAt = new Date(futureDate.getTime() + 30 * 60000).toISOString()

    const { data: rpcRes } = await (admin as any).rpc('create_appointment_hold_atomic', {
      p_tenant_id: tenantId,
      p_barber_id: barber!.id,
      p_service_ids: [service!.id],
      p_client_name: 'Teste E2E Pix',
      p_client_phone: '11999990002',
      p_starts_at: startsAt,
      p_ends_at: endsAt,
      p_total_amount: Number(service!.price),
      p_reservation_fee: Number(service!.reservation_fee),
      p_notes: 'E2E Pix Test',
    })

    const appointmentId = rpcRes.appointment_id

    // Simular confirmação via Webhook / Gateway
    const { error: updateError } = await admin
      .from('appointments')
      .update({
        status: 'scheduled',
        payment_status: 'paid',
        payment_method: 'online_gateway',
        gateway_payment_id: 'gw_e2e_test_123',
        hold_expires_at: null,
      })
      .eq('id', appointmentId)

    expect(updateError).toBeNull()

    const { data: updatedApt } = await admin
      .from('appointments')
      .select('status, payment_status, gateway_payment_id')
      .eq('id', appointmentId)
      .single()

    expect(updatedApt?.status).toBe('scheduled')
    expect(updatedApt?.payment_status).toBe('paid')
    expect(updatedApt?.gateway_payment_id).toBe('gw_e2e_test_123')

    // Limpeza
    await admin.from('appointments').delete().eq('id', appointmentId)
  })

  test('Cenário 3: Mensalista identificado tem sinal zerado e corte debitado atomicamente', async () => {
    const { data: tenant } = await admin
      .from('tenants')
      .select('id')
      .eq('status', 'active')
      .limit(1)
      .single()
    const tenantId = tenant!.id

    const { data: barber } = await admin
      .from('profiles')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('role', ['barber', 'owner'])
      .limit(1)
      .single()

    const { data: service } = await admin
      .from('services')
      .select('id, price, reservation_fee')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(1)
      .single()

    const mensalistaPhone = '11988887777'
    const today = new Date().toISOString().slice(0, 10)
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

    const { data: sub, error: subError } = await admin
      .from('monthly_subscriptions')
      .insert({
        tenant_id: tenantId,
        client_name: 'Cliente VIP E2E',
        client_phone: mensalistaPhone,
        plan_name: 'Plano E2E VIP',
        cuts_included: 4,
        cuts_remaining: 3,
        price_monthly: 150,
        status: 'active',
        cycle_start_date: today,
        cycle_end_date: nextMonth,
      })
      .select('id, cuts_remaining')
      .single()

    expect(subError).toBeNull()
    expect(sub).not.toBeNull()

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 4)
    futureDate.setHours(14, 0, 0, 0)
    const startsAt = futureDate.toISOString()
    const endsAt = new Date(futureDate.getTime() + 30 * 60000).toISOString()

    // 2. Agendamento atômico
    const { data: rpcRes, error: rpcError } = await (admin as any).rpc(
      'create_appointment_hold_atomic',
      {
        p_tenant_id: tenantId,
        p_barber_id: barber!.id,
        p_service_ids: [service!.id],
        p_client_name: 'Cliente VIP E2E',
        p_client_phone: mensalistaPhone,
        p_starts_at: startsAt,
        p_ends_at: endsAt,
        p_total_amount: Number(service!.price),
        p_reservation_fee: Number(service!.reservation_fee),
        p_notes: 'E2E Mensalista Test',
      },
    )

    expect(rpcError).toBeNull()
    expect(rpcRes.success).toBe(true)
    expect(rpcRes.is_monthly).toBe(true)
    expect(rpcRes.requires_pix).toBe(false)

    // 3. Verifica se o corte foi debitado (de 3 para 2)
    const { data: updatedSub } = await admin
      .from('monthly_subscriptions')
      .select('cuts_remaining')
      .eq('id', sub!.id)
      .single()

    expect(updatedSub?.cuts_remaining).toBe(2)

    // Limpeza
    await admin.from('appointments').delete().eq('id', rpcRes.appointment_id)
    await admin.from('monthly_subscriptions').delete().eq('id', sub!.id)
  })

  test('Cenário 4: Tentativa de agendamento no mesmo horário por outro usuário recebe erro de conflito', async () => {
    const { data: tenant } = await admin
      .from('tenants')
      .select('id')
      .eq('status', 'active')
      .limit(1)
      .single()
    const tenantId = tenant!.id

    const { data: barber } = await admin
      .from('profiles')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('role', ['barber', 'owner'])
      .limit(1)
      .single()

    const { data: service } = await admin
      .from('services')
      .select('id, price, reservation_fee')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(1)
      .single()

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 5)
    futureDate.setHours(16, 0, 0, 0)
    const startsAt = futureDate.toISOString()
    const endsAt = new Date(futureDate.getTime() + 30 * 60000).toISOString()

    // Primeiro agendamento (sucesso)
    const { data: res1 } = await (admin as any).rpc('create_appointment_hold_atomic', {
      p_tenant_id: tenantId,
      p_barber_id: barber!.id,
      p_service_ids: [service!.id],
      p_client_name: 'Cliente 1 Conflito',
      p_client_phone: '11999990003',
      p_starts_at: startsAt,
      p_ends_at: endsAt,
      p_total_amount: Number(service!.price),
      p_reservation_fee: Number(service!.reservation_fee),
      p_notes: 'E2E Slot 1',
    })

    expect(res1.success).toBe(true)

    // Segundo agendamento no mesmo horário para o mesmo barbeiro (deve falhar por conflito)
    const { data: res2 } = await (admin as any).rpc('create_appointment_hold_atomic', {
      p_tenant_id: tenantId,
      p_barber_id: barber!.id,
      p_service_ids: [service!.id],
      p_client_name: 'Cliente 2 Conflito',
      p_client_phone: '11999990004',
      p_starts_at: startsAt,
      p_ends_at: endsAt,
      p_total_amount: Number(service!.price),
      p_reservation_fee: Number(service!.reservation_fee),
      p_notes: 'E2E Slot 2',
    })

    expect(res2.success).toBe(false)
    expect(res2.error).toContain('Horário indisponível ou já reservado')

    // Limpeza
    await admin.from('appointments').delete().eq('id', res1.appointment_id)
  })
})
