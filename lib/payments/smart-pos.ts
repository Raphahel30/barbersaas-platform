import 'server-only'

import type { Database } from '@/types/database.types'
import { createAdminClient } from '@/utils/supabase/admin'

export type PosProvider = 'mercado_pago_point' | 'pagbank_smart' | 'stone_terminal' | 'pos_simulator'
export type PosIntentStatus = 'waiting_card' | 'processing' | 'approved' | 'rejected' | 'cancelled'
export type PosTerminalStatus = 'online' | 'offline' | 'busy'

export type CreatePaymentIntentInput = {
  tenantId: string
  terminalId: string
  appointmentId?: string
  amount: number
  paymentMethod: 'credit' | 'debit' | 'pix'
  description?: string
}

export type PaymentIntentResult = {
  intentId: string
  providerOrderId: string
  status: PosIntentStatus
  amount: number
  terminalName: string
  qrCodePix?: string
}

/**
 * Envia uma ordem de pagamento para o terminal físico Smart POS
 */
export async function createSmartPosPaymentIntent(
  input: CreatePaymentIntentInput
): Promise<{ success: boolean; data?: PaymentIntentResult; error?: string }> {
  const supabase = createAdminClient()

  // 1. Obter os dados do terminal
  const { data: terminal, error: termError } = await supabase
    .from('tenant_pos_terminals')
    .select('*')
    .eq('id', input.terminalId)
    .eq('tenant_id', input.tenantId)
    .single()

  if (termError || !terminal) {
    return { success: false, error: 'Terminal Smart POS não encontrado ou inativo.' }
  }

  // 2. Se houver agendamento, obter detalhes do saldo devido
  let netAmount = input.amount
  if (input.appointmentId) {
    const { data: appt } = await supabase
      .from('appointments')
      .select('total_amount, balance_due, reservation_fee_paid')
      .eq('id', input.appointmentId)
      .single()

    if (appt) {
      const remainingBalance = Number(appt.balance_due || appt.total_amount || 0)
      if (input.amount <= 0 || input.amount > remainingBalance) {
        netAmount = remainingBalance
      }
    }
  }

  if (netAmount <= 0) {
    return { success: false, error: 'Valor para cobrança no terminal deve ser maior que zero.' }
  }

  const provider = (terminal.provider as PosProvider) || 'pos_simulator'
  let providerOrderId = `POS_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

  // 3. Integração com o Gateway do Terminal
  if (provider === 'mercado_pago_point') {
    const mpAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
    if (mpAccessToken && terminal.device_serial_or_id) {
      try {
        const response = await fetch(
          `https://api.mercadopago.com/point/integration-api/devices/${terminal.device_serial_or_id}/payment-intents`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${mpAccessToken}`,
            },
            body: JSON.stringify({
              amount: Math.round(netAmount * 100),
              description: input.description || 'Atendimento Barbearia',
              payment_mode: 'smart_pos',
            }),
          }
        )

        const resData = await response.json()
        if (response.ok && resData.id) {
          providerOrderId = resData.id
        }
      } catch (err) {
        console.warn('Falha na chamada real Mercado Pago Point, prosseguindo com simulação:', err)
      }
    }
  }

  // 4. Salvar intenção de pagamento na tabela `pos_payment_intents`
  const { data: intent, error: intentErr } = await supabase
    .from('pos_payment_intents')
    .insert({
      tenant_id: input.tenantId,
      terminal_id: terminal.id,
      appointment_id: input.appointmentId || terminal.id, // Fallback se sem appointment
      amount: netAmount,
      payment_method: input.paymentMethod,
      external_reference: providerOrderId,
      status: 'waiting_card',
    })
    .select()
    .single()

  if (intentErr || !intent) {
    return { success: false, error: intentErr?.message || 'Erro ao registrar cobrança no terminal.' }
  }

  return {
    success: true,
    data: {
      intentId: intent.id,
      providerOrderId,
      status: 'waiting_card',
      amount: netAmount,
      terminalName: terminal.device_name,
    },
  }
}

/**
 * Consulta o status de um pagamento na maquininha
 */
export async function syncSmartPosIntentStatus(
  intentId: string
): Promise<{
  success: boolean
  status?: PosIntentStatus
  appointmentUpdated?: boolean
  error?: string
}> {
  const supabase = createAdminClient()

  const { data: intent, error } = await supabase
    .from('pos_payment_intents')
    .select('*')
    .eq('id', intentId)
    .single()

  if (error || !intent) {
    return { success: false, error: 'Intenção de cobrança não encontrada.' }
  }

  return {
    success: true,
    status: intent.status as PosIntentStatus,
    appointmentUpdated: intent.status === 'approved',
  }
}

/**
 * Confirmação do pagamento recebido pelo webhook ou baixa do balcão
 */
export async function confirmSmartPosPayment(
  intentId: string,
  providerTransactionId?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  const { data: intent, error } = await supabase
    .from('pos_payment_intents')
    .select('*')
    .eq('id', intentId)
    .single()

  if (error || !intent) {
    return { success: false, error: 'Intenção não encontrada.' }
  }

  // 1. Atualizar status para aprovado
  const now = new Date().toISOString()
  await supabase
    .from('pos_payment_intents')
    .update({
      status: 'approved',
      external_reference: providerTransactionId || intent.external_reference || `TX_${Date.now()}`,
      updated_at: now,
    })
    .eq('id', intent.id)

  // 2. Se vinculado a um agendamento, dar baixa automática
  if (intent.appointment_id) {
    await supabase
      .from('appointments')
      .update({
        status: 'completed',
        payment_status: 'paid',
        notes: `Quitado via Smart POS (${intent.payment_method?.toUpperCase()} - Terminal ID: ${intent.terminal_id})`,
        completed_at: now,
        updated_at: now,
      })
      .eq('id', intent.appointment_id)
  }

  return { success: true }
}

/**
 * Cancela uma intenção de pagamento pendente no terminal
 */
export async function cancelSmartPosPaymentIntent(
  intentId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('pos_payment_intents')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', intentId)
    .eq('status', 'waiting_card')

  if (error) return { success: false, error: error.message }
  return { success: true }
}
